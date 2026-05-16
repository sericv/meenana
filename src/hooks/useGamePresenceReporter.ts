"use client";

import { deleteField, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useRef } from "react";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { col } from "@/lib/firestore/paths";
import { isFirebaseFirestoreError, logFsOpFailure } from "@/lib/firestore/fs-op-debug";
import type { GamePresence } from "@/lib/social/presence-constants";

type Args = {
  uid: string | null;
  enabled: boolean;
  presence: GamePresence;
  roomId?: string | null;
  /** Heartbeat to keep `gamePresenceUpdatedAt` fresh for friends list. */
  heartbeatMs?: number;
  /** When the component unmounts, mark player as online (lobby exit, etc.). */
  resetOnUnmount?: boolean;
};

/**
 * Writes `gamePresence` + `gamePresenceUpdatedAt` on the signed-in user's
 * Firestore profile for friends / invites. Google-only callers should pass
 * `enabled: isFullAccountUser(...)` (Google or email link).
 */
export function useGamePresenceReporter({
  uid,
  enabled,
  presence,
  roomId = null,
  heartbeatMs = 22_000,
  resetOnUnmount = true,
}: Args): void {
  const lastSig = useRef<string>("");

  useEffect(() => {
    if (!uid || !enabled) return;
    const db = getFirebaseDb();
    const ref = doc(db, col.users, uid);
    const sig = `${presence}\t${roomId ?? ""}`;
    const write = () => {
      const patch: Record<string, unknown> = {
        gamePresence: presence,
        gamePresenceUpdatedAt: serverTimestamp(),
      };
      if (roomId) patch.gamePresenceRoomId = roomId;
      else patch.gamePresenceRoomId = deleteField();
      // merge create — avoids permission/NOT_FOUND when `users/{uid}` is missing
      // before the first successful `upsertUserDocument`.
      void setDoc(ref, patch, { merge: true }).catch((err) => {
        if (isFirebaseFirestoreError(err)) {
          logFsOpFailure({
            area: "useGamePresenceReporter.setDoc",
            op: "write",
            path: `${col.users}/${uid}`,
            err,
            roomId,
            myUid: uid,
            extra: { presence, heartbeat: true },
          });
        }
      });
    };
    if (lastSig.current !== sig) {
      lastSig.current = sig;
      write();
    }
    const id = window.setInterval(write, heartbeatMs);
    return () => {
      window.clearInterval(id);
      if (resetOnUnmount) {
        // Guard: auth may have changed (new sign-in) since this effect captured
        // `uid`. Writing to a different user's doc would be denied by Firestore rules.
        const currentUid = getFirebaseAuth().currentUser?.uid;
        if (currentUid !== uid) return;
        void setDoc(
          ref,
          {
            gamePresence: "online",
            gamePresenceRoomId: deleteField(),
            gamePresenceUpdatedAt: serverTimestamp(),
          },
          { merge: true },
        ).catch((err) => {
          if (isFirebaseFirestoreError(err)) {
            logFsOpFailure({
              area: "useGamePresenceReporter.resetOnUnmount_setDoc",
              op: "write",
              path: `${col.users}/${uid}`,
              err,
              roomId,
              myUid: uid,
              extra: { resetOnUnmount: true },
            });
          }
        });
      }
    };
  }, [uid, enabled, presence, roomId, heartbeatMs, resetOnUnmount]);
}
