"use client";

import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { col } from "@/lib/firestore/paths";

const TAG = "[FS:OP]";

export type FsOpKind = "listen" | "read" | "write" | "transaction" | "batch";

function extractFsError(err: unknown): { code: string; message: string } {
  if (err && typeof err === "object" && "code" in err) {
    return {
      code: String((err as { code: unknown }).code),
      message: "message" in err ? String((err as { message: unknown }).message) : String(err),
    };
  }
  return { code: "unknown", message: err instanceof Error ? err.message : String(err) };
}

/** True for errors thrown by the Firebase Web SDK (have a string `code`, e.g. permission-denied). */
export function isFirebaseFirestoreError(err: unknown): err is { code: string; message?: string } {
  return typeof err === "object" && err !== null && typeof (err as { code?: unknown }).code === "string";
}

/** Firebase Web SDK uses `permission-denied`; REST sometimes surfaces as messaging text. */
export function isFsPermissionDenied(err: unknown): boolean {
  const { code, message } = extractFsError(err);
  return code === "permission-denied" || /insufficient permissions/i.test(message);
}

export function fsAuthSnapshot(): {
  authUid: string | null;
  authAnonymous: boolean | null;
  authInitialized: boolean;
} {
  try {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    return {
      authUid: u?.uid ?? null,
      authAnonymous: u != null ? Boolean(u.isAnonymous) : null,
      authInitialized: true,
    };
  } catch {
    return { authUid: null, authAnonymous: null, authInitialized: false };
  }
}

let fsListenSeq = 0;

function fsDebugVerbose(): boolean {
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_FIRESTORE_OP_DEBUG === "1";
}

/** Optional: log listener attach order (set NEXT_PUBLIC_FIRESTORE_OP_DEBUG=1). */
export function logFsListenAttach(
  area: string,
  path: string,
  ctx: Record<string, unknown> = {},
): void {
  if (!fsDebugVerbose()) return;
  const seq = ++fsListenSeq;
  console.info(TAG, "ATTACH_LISTENER", {
    seq,
    area,
    path,
    ...fsAuthSnapshot(),
    ...ctx,
    ts: new Date().toISOString(),
  });
}

/**
 * Second-pass reads after a failure (often permission-denied) to see whether
 * the doc exists from the client's perspective and what `playerUids` look like.
 * These reads may also fail with permission — that is diagnostic too.
 */
export async function fsPeekAfterFailure(roomId: string | null | undefined, matchId: string | null | undefined) {
  const db = getFirebaseDb();
  if (roomId) {
    try {
      const rs = await getDoc(doc(db, col.rooms, roomId));
      const d = rs.data() as { playerUids?: unknown; status?: unknown } | undefined;
      console.error(TAG, "PEEK_POST_FAILURE rooms/{roomId}", {
        path: `${col.rooms}/${roomId}`,
        op: "read(getDoc)",
        exists: rs.exists(),
        status: d?.status,
        playerUids: Array.isArray(d?.playerUids) ? d?.playerUids : d?.playerUids ?? null,
        ...fsAuthSnapshot(),
      });
    } catch (e) {
      console.error(TAG, "PEEK_ROOM_FAILED", { path: `${col.rooms}/${roomId}`, ...extractFsError(e) });
    }
  }
  if (matchId) {
    try {
      const ms = await getDoc(doc(db, col.matches, matchId));
      const d = ms.data() as { playerOrder?: unknown; roomId?: unknown } | undefined;
      console.error(TAG, "PEEK_POST_FAILURE matches/{matchId}", {
        path: `${col.matches}/${matchId}`,
        op: "read(getDoc)",
        exists: ms.exists(),
        playerOrder: Array.isArray(d?.playerOrder) ? d?.playerOrder : d?.playerOrder ?? null,
        matchRoomId: d?.roomId ?? null,
        ...fsAuthSnapshot(),
      });
    } catch (e) {
      console.error(TAG, "PEEK_MATCH_FAILED", { path: `${col.matches}/${matchId}`, ...extractFsError(e) });
    }
  }
}

function safeJsonForDiag(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Error) return { name: v.name, message: v.message };
      return v;
    });
  } catch {
    return '"<json stringify failed>"';
  }
}

/**
 * Log a failed Firestore client operation with the maximum synchronous context.
 * Always logs to console.error (temporary production diagnostics).
 */
export function logFsOpFailure(args: {
  area: string;
  op: FsOpKind;
  path: string;
  err: unknown;
  roomId?: string | null;
  matchId?: string | null;
  opponentUid?: string | null;
  myUid?: string | null;
  roomPlayerUids?: string[] | null;
  amInRoomPlayerUids?: boolean | null;
  matchPlayerOrder?: string[] | null;
  amInMatchPlayerOrder?: boolean | null;
  extra?: Record<string, unknown>;
}): void {
  const fe = extractFsError(args.err);
  const auth = fsAuthSnapshot();
  // Keep `extra` nested so caller fields can never overwrite firebaseCode / path / message.
  // Also avoids odd console expansion when spreading unknown-shaped `extra`.
  const payload = {
    tag: TAG,
    area: args.area,
    op: args.op,
    path: args.path,
    firebaseCode: fe.code,
    message: fe.message,
    authUid: auth.authUid,
    authAnonymous: auth.authAnonymous,
    authInitialized: auth.authInitialized,
    roomId: args.roomId ?? null,
    matchId: args.matchId ?? null,
    opponentUid: args.opponentUid ?? null,
    myUid: args.myUid ?? null,
    roomPlayerUids: args.roomPlayerUids ?? null,
    amInRoomPlayerUids: args.amInRoomPlayerUids ?? null,
    matchPlayerOrder: args.matchPlayerOrder ?? null,
    amInMatchPlayerOrder: args.amInMatchPlayerOrder ?? null,
    ts: new Date().toISOString(),
    extra: args.extra ?? null,
  };
  console.error(TAG, "OPERATION_FAILED", payload);
  // Duplicate as one string line — survives hosts that mishandle object logging / grouping.
  console.error(`${TAG} OPERATION_FAILED_JSON ${safeJsonForDiag(payload)}`);

  if (isFsPermissionDenied(args.err)) {
    void fsPeekAfterFailure(args.roomId ?? undefined, args.matchId ?? undefined);
  }
}
