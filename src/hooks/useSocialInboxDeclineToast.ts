"use client";

import { useEffect, useRef } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col, userSub } from "@/lib/firestore/paths";

/**
 * Host-only: listens for server-written `socialInbox` events (invite declined).
 * Skips the initial snapshot so old inbox rows do not toast on mount.
 */
export function useSocialInboxDeclineToast(
  uid: string | null,
  enabled: boolean,
  onToast: (message: string) => void,
): void {
  const skipFirst = useRef(true);
  useEffect(() => {
    if (!uid || !enabled) {
      skipFirst.current = true;
      return;
    }
    const db = getFirebaseDb();
    const q = query(
      collection(db, col.users, uid, userSub.socialInbox),
      orderBy("createdAt", "desc"),
      limit(6),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (skipFirst.current) {
        skipFirst.current = false;
        return;
      }
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const d = ch.doc.data() as { type?: string; text?: string; createdAt?: Timestamp };
        if (d.type === "invite_declined") {
          onToast(String(d.text ?? "رفض اللاعب الدعوة."));
        }
      }
    });
    return () => {
      unsub();
      skipFirst.current = true;
    };
  }, [uid, enabled, onToast]);
}
