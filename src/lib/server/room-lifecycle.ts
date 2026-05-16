import { FieldValue, type CollectionReference, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { col } from "@/lib/firestore/paths";

const SUBS = ["messages", "presence", "typing", "playerCards", "serverRate"] as const;

async function deleteCollectionInChunks(db: Firestore, coll: CollectionReference): Promise<void> {
  const snap = await coll.limit(500).get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
  await deleteCollectionInChunks(db, coll);
}

export async function clearRoomSubcollections(roomId: string): Promise<void> {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(roomId);
  for (const s of SUBS) {
    await deleteCollectionInChunks(db, roomRef.collection(s));
  }
}

/**
 * Deletes room doc, join code, match doc, matchmaking result stubs, and all subcollections.
 */
export async function deleteRoomFully(roomId: string, roomData: FirebaseFirestore.DocumentData): Promise<void> {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(roomId);
  await clearRoomSubcollections(roomId);

  const batch = db.batch();
  const code = String(roomData.code ?? "");
  if (code) batch.delete(db.collection(col.roomCodes).doc(code));
  const matchId = String(roomData.matchId ?? "");
  if (matchId) batch.delete(db.collection(col.matches).doc(matchId));
  const uids = (roomData.playerUids as string[]) ?? [];
  for (const uid of uids) {
    batch.delete(db.collection(col.matchmakingResults).doc(uid));
  }
  batch.delete(roomRef);
  await batch.commit();
}

export async function replayEndedPrivateRoom(args: { roomId: string; actingUid: string }): Promise<void> {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(args.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw new Error("ROOM_NOT_FOUND");
  const room = roomSnap.data()!;
  if (room.randomMatch === true) throw new Error("NO_REPLAY");
  const uids = (room.playerUids as string[]) ?? [];
  if (!uids.includes(args.actingUid)) throw new Error("NOT_IN_ROOM");
  if (String(room.status) !== "ended") throw new Error("NOT_ENDED");

  const matchId = String(room.matchId ?? "");

  await clearRoomSubcollections(args.roomId);
  if (matchId) {
    await db.collection(col.matches).doc(matchId).delete().catch(() => undefined);
  }

  const players = (room.players as Array<{ uid: string; displayName: string; ready: boolean; joinedAt: unknown }>) ?? [];
  await roomRef.set(
    {
      status: "lobby",
      matchId: null,
      leftByUid: FieldValue.delete(),
      lobbyLeftByUid: FieldValue.delete(),
      cleanupAt: null,
      lastActivityAt: FieldValue.serverTimestamp(),
      players: players.map((p) => ({ ...p, ready: false })),
      customOpponentSelections: {},
      customOpponentCardAssigned: {},
    },
    { merge: true },
  );
}
