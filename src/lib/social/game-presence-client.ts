import type { Timestamp } from "firebase/firestore";
import { GAME_PRESENCE, type GamePresence } from "@/lib/social/presence-constants";

const STALE_MS = 120_000;

export function clientEffectivePresence(
  raw: string | undefined | null,
  updatedAt: Timestamp | null | undefined,
): GamePresence {
  const p = (raw as GamePresence) || "offline";
  if (p === "offline") return "offline";
  const ms = updatedAt && typeof updatedAt.toMillis === "function" ? updatedAt.toMillis() : 0;
  if (!ms || Date.now() - ms > STALE_MS) {
    if (p === "away") return "away";
    return "offline";
  }
  return GAME_PRESENCE.includes(p as GamePresence) ? (p as GamePresence) : "offline";
}
