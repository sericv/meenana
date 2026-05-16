"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col } from "@/lib/firestore/paths";
import { normalizeCosmetic, type PlayerCosmetic } from "@/lib/profile/cosmetics";

/**
 * Live cosmetics for one or more user ids (avatar, frame, photoURL from
 * Firestore `users/{uid}`). Unsubscribes automatically.
 */
export function usePlayerCosmetics(uids: (string | null | undefined)[]): Record<string, PlayerCosmetic> {
  const key = useMemo(() => [...new Set(uids.filter(Boolean))].sort().join(","), [uids]);
  const list = useMemo(() => (key ? key.split(",") : []) as string[], [key]);

  const [map, setMap] = useState<Record<string, PlayerCosmetic>>({});

  useEffect(() => {
    if (list.length === 0) {
      setMap({});
      return;
    }
    const db = getFirebaseDb();
    const unsubs = list.map((uid) =>
      onSnapshot(
        doc(db, col.users, uid),
        (snap) => {
          if (!snap.exists()) {
            setMap((prev) => ({ ...prev, [uid]: normalizeCosmetic(undefined) }));
            return;
          }
          setMap((prev) => ({
            ...prev,
            [uid]: normalizeCosmetic(snap.data() as Record<string, unknown>),
          }));
        },
        () => {
          // offline / permission — keep last known or empty defaults
          setMap((prev) => ({ ...prev, [uid]: prev[uid] ?? normalizeCosmetic(undefined) }));
        },
      ),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [list]);

  return map;
}
