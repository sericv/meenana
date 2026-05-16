import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { col, userSub } from "@/lib/firestore/paths";
import { HttpError } from "@/lib/server/auth";
import {
  effectivePresence,
  INVITE_BLOCKING_PRESENCE,
} from "@/lib/social/game-presence";
import { validateUsernameInput } from "@/lib/social/username";
import { roomInviteDocId } from "@/lib/social/room-invite-id";
import type { RoomPlayer } from "@/types";

const USERNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const ROOM_INVITE_TTL_MS = 3 * 60 * 1000;

/** Social APIs: Google sign-in or passwordless email link (Firebase `password` + email on user). */
export async function assertGoogleUid(uid: string): Promise<void> {
  const auth = getAdminAuth();
  const rec = await auth.getUser(uid);
  const hasGoogle = rec.providerData?.some((p) => p.providerId === "google.com") ?? false;
  const hasEmailLink =
    Boolean(rec.email) && (rec.providerData?.some((p) => p.providerId === "password") ?? false);
  if (!hasGoogle && !hasEmailLink) {
    throw new HttpError(403, "هذه الميزة متاحة بعد تسجيل الدخول بـ Google أو رابط البريد.");
  }
}

async function readUserPublic(uid: string): Promise<Record<string, unknown> | null> {
  const db = getAdminDb();
  const snap = await db.collection(col.users).doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() ?? null;
}

export async function assertUserHasUsername(uid: string): Promise<{
  displayName: string;
  usernameLower: string;
  usernameDisplay: string;
}> {
  const data = await readUserPublic(uid);
  if (!data) throw new HttpError(400, "ملف اللاعب غير موجود.");
  const usernameLower = String(data.usernameLower ?? "").trim().toLowerCase();
  const usernameDisplay = String(data.username ?? data.usernameDisplay ?? "").trim();
  if (!usernameLower || !usernameDisplay) {
    throw new HttpError(400, "أنشئ اسم مستخدم أولاً من صفحة الأصدقاء.");
  }
  const displayName = String(data.displayName ?? "لاعب").trim() || "لاعب";
  return { displayName, usernameLower, usernameDisplay };
}

export async function setUsernameForUid(uid: string, raw: string): Promise<{ username: string }> {
  await assertGoogleUid(uid);
  const parsed = validateUsernameInput(raw);
  if (!parsed.ok) throw new HttpError(400, parsed.error);

  const db = getAdminDb();
  const userRef = db.collection(col.users).doc(uid);
  const newClaimRef = db.collection(col.usernameClaims).doc(parsed.usernameLower);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpError(400, "ملف اللاعب غير موجود.");
    const u = userSnap.data() ?? {};
    const prevLower = String(u.usernameLower ?? "").trim().toLowerCase() || null;

    if (prevLower && prevLower !== parsed.usernameLower) {
      const changedAt = u.usernameChangedAt as Timestamp | undefined;
      if (changedAt && typeof changedAt.toMillis === "function") {
        if (Date.now() - changedAt.toMillis() < USERNAME_COOLDOWN_MS) {
          throw new HttpError(429, "يمكن تغيير اسم المستخدم مرة واحدة كل 24 ساعة.");
        }
      }
    }

    const claimSnap = await tx.get(newClaimRef);
    if (claimSnap.exists) {
      const owner = String(claimSnap.data()?.uid ?? "");
      if (owner && owner !== uid) {
        throw new HttpError(409, "اسم المستخدم مأخوذ.");
      }
    }

    if (prevLower && prevLower !== parsed.usernameLower) {
      const oldRef = db.collection(col.usernameClaims).doc(prevLower);
      const oldSnap = await tx.get(oldRef);
      if (oldSnap.exists && String(oldSnap.data()?.uid ?? "") === uid) {
        tx.delete(oldRef);
      }
    }

    tx.set(newClaimRef, {
      uid,
      usernameLower: parsed.usernameLower,
      usernameDisplay: parsed.usernameDisplay,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      userRef,
      {
        username: parsed.usernameDisplay,
        usernameLower: parsed.usernameLower,
        usernameChangedAt: FieldValue.serverTimestamp(),
        lastSeen: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { username: parsed.usernameDisplay };
}

export async function searchUsernamesByPrefix(prefixRaw: string): Promise<
  Array<{
    uid: string;
    username: string;
    usernameLower: string;
    displayName: string;
    photoURL: string | null;
  }>
> {
  const inner = prefixRaw.trim().replace(/^@+/, "").toLowerCase();
  if (inner.length < 1) return [];
  const db = getAdminDb();
  const end = `${inner}\uf8ff`;
  const qs = await db
    .collection(col.usernameClaims)
    .where("usernameLower", ">=", inner)
    .where("usernameLower", "<=", end)
    .limit(24)
    .get();

  const out: Array<{
    uid: string;
    username: string;
    usernameLower: string;
    displayName: string;
    photoURL: string | null;
  }> = [];

  for (const doc of qs.docs) {
    const d = doc.data();
    const uid = String(d.uid ?? "");
    if (!uid) continue;
    const uSnap = await db.collection(col.users).doc(uid).get();
    const u = uSnap.data() ?? {};
    if (u.isGuest === true) continue;
    out.push({
      uid,
      username: String(d.usernameDisplay ?? u.username ?? doc.id),
      usernameLower: String(d.usernameLower ?? doc.id),
      displayName: String(u.displayName ?? "").trim() || "لاعب",
      photoURL: u.photoURL != null ? String(u.photoURL) : null,
    });
  }
  return out;
}

async function areFriends(a: string, b: string): Promise<boolean> {
  const db = getAdminDb();
  const snap = await db.collection(col.users).doc(a).collection(userSub.friends).doc(b).get();
  return snap.exists;
}

export async function sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
  if (fromUid === toUid) throw new HttpError(400, "لا يمكن إرسال طلب لنفسك.");
  await assertGoogleUid(fromUid);
  await assertGoogleUid(toUid);
  await assertUserHasUsername(fromUid);
  await assertUserHasUsername(toUid);

  const db = getAdminDb();
  if (await areFriends(fromUid, toUid)) {
    throw new HttpError(409, "أنتما أصدقاء بالفعل.");
  }

  const inboxRef = db.collection(col.users).doc(toUid).collection(userSub.friendInbox).doc(fromUid);
  const inboxSnap = await inboxRef.get();
  if (inboxSnap.exists) {
    throw new HttpError(409, "يوجد طلب معلّق بالفعل.");
  }

  const reverseInbox = await db
    .collection(col.users)
    .doc(fromUid)
    .collection(userSub.friendInbox)
    .doc(toUid)
    .get();
  if (reverseInbox.exists) {
    throw new HttpError(409, "لديك طلب وارد من هذا اللاعب — راجع صندوق الطلبات.");
  }

  const from = await readUserPublic(fromUid);
  if (!from) throw new HttpError(400, "ملف المرسل غير موجود.");

  await inboxRef.set({
    fromUid,
    displayName: String(from.displayName ?? "لاعب"),
    photoURL: from.photoURL != null ? String(from.photoURL) : null,
    username: String(from.username ?? ""),
    usernameLower: String(from.usernameLower ?? "").toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
    status: "pending",
  });
}

export async function respondFriendRequest(
  toUid: string,
  fromUid: string,
  accept: boolean,
): Promise<void> {
  await assertGoogleUid(toUid);
  const db = getAdminDb();
  const inboxRef = db.collection(col.users).doc(toUid).collection(userSub.friendInbox).doc(fromUid);
  const inboxSnap = await inboxRef.get();
  if (!inboxSnap.exists) throw new HttpError(404, "الطلب غير موجود.");

  if (!accept) {
    await inboxRef.delete();
    const reverse = db.collection(col.users).doc(fromUid).collection(userSub.friendInbox).doc(toUid);
    const revSnap = await reverse.get();
    if (revSnap.exists) await reverse.delete();
    return;
  }

  await db.runTransaction(async (tx) => {
    const aFriends = db.collection(col.users).doc(fromUid).collection(userSub.friends).doc(toUid);
    const bFriends = db.collection(col.users).doc(toUid).collection(userSub.friends).doc(fromUid);
    const reverseRef = db.collection(col.users).doc(fromUid).collection(userSub.friendInbox).doc(toUid);

    // Firestore requires every read before any write in a transaction.
    const inbox = await tx.get(inboxRef);
    const already = await tx.get(aFriends);
    const rev = await tx.get(reverseRef);

    if (!inbox.exists) throw new HttpError(404, "الطلب غير موجود.");
    if (already.exists) {
      tx.delete(inboxRef);
      return;
    }

    const now = FieldValue.serverTimestamp();
    tx.set(aFriends, { friendUid: toUid, since: now });
    tx.set(bFriends, { friendUid: fromUid, since: now });
    tx.delete(inboxRef);
    if (rev.exists) tx.delete(reverseRef);
  });
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  await assertGoogleUid(uid);
  const db = getAdminDb();
  const a = db.collection(col.users).doc(uid).collection(userSub.friends).doc(friendUid);
  const b = db.collection(col.users).doc(friendUid).collection(userSub.friends).doc(uid);
  await db.runTransaction(async (tx) => {
    tx.delete(a);
    tx.delete(b);
  });
}

export async function sendRoomInvite(args: {
  fromUid: string;
  toUid: string;
  roomId: string;
  message?: string;
}): Promise<{ inviteId: string }> {
  const { fromUid, toUid, roomId } = args;
  const message = (args.message ?? "انضم إلى غرفتي!").trim().slice(0, 120);
  if (fromUid === toUid) throw new HttpError(400, "لا يمكن دعوة نفسك.");

  await assertGoogleUid(fromUid);
  await assertGoogleUid(toUid);
  const hostProfile = await assertUserHasUsername(fromUid);
  await assertUserHasUsername(toUid);

  if (!(await areFriends(fromUid, toUid))) {
    throw new HttpError(403, "يمكنك دعوة الأصدقاء فقط.");
  }

  const db = getAdminDb();
  const roomSnap = await db.collection(col.rooms).doc(roomId).get();
  if (!roomSnap.exists) throw new HttpError(404, "الغرفة غير موجودة.");
  const room = roomSnap.data() ?? {};
  if (String(room.hostUid ?? "") !== fromUid) throw new HttpError(403, "فقط المضيف يمكنه الإرسال.");
  if (room.status !== "lobby") throw new HttpError(409, "الغرفة لم تعد في الاستقبال.");
  const uids = (room.playerUids as string[]) ?? [];
  if (uids.includes(toUid)) throw new HttpError(409, "اللاعب في الغرفة بالفعل.");
  if (uids.length >= 2) throw new HttpError(409, "الغرفة ممتلئة.");

  const target = await readUserPublic(toUid);
  if (!target) throw new HttpError(400, "ملف المدعو غير موجود.");
  const gp = effectivePresence(
    String(target.gamePresence ?? "offline"),
    target.gamePresenceUpdatedAt as Timestamp | undefined,
  );
  if (INVITE_BLOCKING_PRESENCE.has(gp)) {
    throw new HttpError(409, "اللاعب غير متاح للدعوة الآن.");
  }

  const from = await readUserPublic(fromUid);
  if (!from) throw new HttpError(400, "ملف المضيف غير موجود.");

  const inviteId = roomInviteDocId(fromUid, roomId);
  const ref = db.collection(col.users).doc(toUid).collection(userSub.roomInvites).doc(inviteId);

  await ref.set({
    fromUid,
    toUid,
    roomId,
    roomCode: String(room.code ?? ""),
    message,
    hostDisplayName: String(from.displayName ?? "مضيف"),
    hostPhotoURL: from.photoURL != null ? String(from.photoURL) : null,
    hostUsername: hostProfile.usernameDisplay,
    hostAvatarId: from.avatarId != null ? String(from.avatarId) : null,
    hostAvatarFrameId: from.avatarFrameId != null ? String(from.avatarFrameId) : null,
    createdAt: FieldValue.serverTimestamp(),
    status: "pending",
  });

  return { inviteId };
}

async function joinRoomAsPlayer(roomId: string, uid: string, displayName: string): Promise<void> {
  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const roomRef = db.collection(col.rooms).doc(roomId);
    const rs = await tx.get(roomRef);
    if (!rs.exists) throw new HttpError(404, "الغرفة غير موجودة");
    const r = rs.data() ?? {};
    const uids = (r.playerUids as string[]) ?? [];
    if (uids.includes(uid)) return;
    if (uids.length >= 2) throw new HttpError(409, "الغرفة ممتلئة");
    if (r.status !== "lobby") throw new HttpError(409, "لا يمكن الانضمام الآن");
    const players = (r.players as RoomPlayer[]) ?? [];
    const nextPlayers: RoomPlayer[] = [
      ...players,
      {
        uid,
        displayName,
        ready: false,
        joinedAt: null,
      },
    ];
    tx.update(roomRef, {
      playerUids: [...uids, uid],
      players: nextPlayers,
      [`playerJoinedAt.${uid}`]: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function respondRoomInvite(args: {
  toUid: string;
  inviteId: string;
  accept: boolean;
}): Promise<{ roomId?: string }> {
  const { toUid, inviteId, accept } = args;
  await assertGoogleUid(toUid);
  const db = getAdminDb();
  const ref = db.collection(col.users).doc(toUid).collection(userSub.roomInvites).doc(inviteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "الدعوة غير موجودة.");
  const inv = snap.data() ?? {};
  if (String(inv.toUid ?? "") !== toUid) throw new HttpError(403, "دعوة غير صالحة.");
  const fromUid = String(inv.fromUid ?? "");
  const roomId = String(inv.roomId ?? "");
  if (!fromUid || !roomId) throw new HttpError(400, "دعوة تالفة.");

  const createdAt = inv.createdAt as Timestamp | undefined;
  if (createdAt && typeof createdAt.toMillis === "function") {
    if (Date.now() - createdAt.toMillis() > ROOM_INVITE_TTL_MS) {
      await ref.delete();
      throw new HttpError(410, "انتهت صلاحية الدعوة.");
    }
  }

  if (!accept) {
    await ref.delete();
    const inboxRef = db.collection(col.users).doc(fromUid).collection(userSub.socialInbox).doc();
    await inboxRef.set({
      type: "invite_declined",
      fromUid: toUid,
      text: "رفض اللاعب الدعوة.",
      createdAt: FieldValue.serverTimestamp(),
    });
    return {};
  }

  const me = await readUserPublic(toUid);
  const displayName = String(me?.displayName ?? "لاعب").trim() || "لاعب";

  await joinRoomAsPlayer(roomId, toUid, displayName);
  await ref.delete();
  return { roomId };
}
