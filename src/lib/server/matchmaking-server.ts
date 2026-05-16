import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { col } from "@/lib/firestore/paths";
import {
  ANSWER_PHASE_SECONDS,
  QUESTION_PHASE_SECONDS,
} from "@/lib/game/constants";
import { generateRoomCode } from "@/lib/game/room-code";

type PoolState = {
  waitingUid: string | null;
  waitingDisplayName: string | null;
};

function poolRef(poolId: string) {
  return getAdminDb().collection(col.matchmakingPool).doc(poolId);
}

function resultRef(uid: string) {
  return getAdminDb().collection(col.matchmakingResults).doc(uid);
}

/**
 * Atomically join queue or pair with a waiter. Creates room via Admin when paired.
 *
 * Stability hardening:
 *  - Always clear THIS user's stale `matchmakingResults` doc before searching,
 *    so a previously-acked-but-leftover redirect cannot fire instantly and
 *    land them in an ended room ("ghost match" / "instant defeat").
 *  - When pairing, write a `matchmakingResults` doc for BOTH players (the
 *    waiter (who is listening via snapshot) AND the joiner (resilient to
 *    navigation hiccups). Joiner page may also navigate from the response.
 */
export async function joinMatchmakingQueue(args: {
  poolId: string;
  uid: string;
  displayName: string;
  categoryId: string;
}): Promise<{ status: "waiting" } | { status: "matched"; roomId: string }> {
  const db = getAdminDb();
  const pref = poolRef(args.poolId);

  // 1) Clear any stale matchmakingResults doc this user may still have from
  //    a previous match. This is the #1 cause of "instant victory" reports.
  await resultRef(args.uid).delete().catch(() => undefined);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(pref);
    const data = (snap.exists ? snap.data() : {}) as Partial<PoolState>;
    const waitingUid = (data.waitingUid as string | undefined) ?? null;
    const waitingDisplayName = (data.waitingDisplayName as string | undefined) ?? null;

    if (!waitingUid) {
      tx.set(
        pref,
        {
          waitingUid: args.uid,
          waitingDisplayName: args.displayName,
          waitingSince: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { kind: "wait" as const };
    }

    if (waitingUid === args.uid) {
      // Same user re-joining (e.g. quick double tap). Stay waiting.
      return { kind: "wait" as const };
    }

    const waiterUid = waitingUid;
    const waiterName = waitingDisplayName || "لاعب";
    const joinerUid = args.uid;
    const joinerName = args.displayName;

    tx.set(
      pref,
      {
        waitingUid: null,
        waitingDisplayName: null,
        waitingSince: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      kind: "pair" as const,
      waiterUid,
      waiterName,
      joinerUid,
      joinerName,
    };
  });

  if (outcome.kind === "wait") {
    return { status: "waiting" };
  }

  const code = generateRoomCode();
  const roomRef = db.collection(col.rooms).doc();
  const roomId = roomRef.id;
  const now = FieldValue.serverTimestamp();

  const waiterUid = outcome.waiterUid;
  const joinerUid = outcome.joinerUid;

  const batch = db.batch();

  batch.set(roomRef, {
    code,
    hostUid: waiterUid,
    playerUids: [waiterUid, joinerUid],
    players: [
      { uid: waiterUid, displayName: outcome.waiterName, ready: true, joinedAt: null },
      { uid: joinerUid, displayName: outcome.joinerName, ready: true, joinedAt: null },
    ],
    playerJoinedAt: {
      [waiterUid]: now,
      [joinerUid]: now,
    },
    status: "lobby",
    categoryId: args.categoryId,
    tutorial: false,
    matchId: null,
    openJoin: false,
    randomMatch: true,
    questionTimerSec: QUESTION_PHASE_SECONDS,
    answerTimerSec: ANSWER_PHASE_SECONDS,
    createdAt: now,
    lastActivityAt: now,
    cleanupAt: null,
  });

  batch.set(db.collection(col.roomCodes).doc(code), { roomId });

  // Write redirect doc for BOTH players. The waiter relies on it (they have
  // an onSnapshot listener). The joiner has the roomId in the API response,
  // but writing it makes them resilient to transient navigation failures.
  batch.set(resultRef(waiterUid), {
    roomId,
    poolId: args.poolId,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(resultRef(joinerUid), {
    roomId,
    poolId: args.poolId,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { status: "matched", roomId };
}

/** Clear queue if this uid is currently waiting. Also clears any pending
 *  redirect doc IF the user is still the current waiter (i.e. unmatched),
 *  so cancelling can never leave a stale redirect that fires on next search. */
export async function leaveMatchmakingQueue(poolId: string, uid: string): Promise<void> {
  const db = getAdminDb();
  const pref = poolRef(poolId);

  const wasWaiting = await db.runTransaction(async (tx) => {
    const snap = await tx.get(pref);
    if (!snap.exists) return false;
    const waitingUid = (snap.data()?.waitingUid as string | undefined) ?? null;
    if (waitingUid !== uid) return false;
    tx.set(
      pref,
      {
        waitingUid: null,
        waitingDisplayName: null,
        waitingSince: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });

  // Only clear the redirect doc if the user was still waiting (unmatched).
  // If they had already been paired, the doc points to a real room they
  // (or their next page) still need to navigate to — don't touch it.
  if (wasWaiting) {
    await resultRef(uid).delete().catch(() => undefined);
  }
}

export async function deleteMatchmakingResult(uid: string): Promise<void> {
  await resultRef(uid).delete().catch(() => undefined);
}
