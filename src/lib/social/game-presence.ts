import type { Timestamp } from "firebase-admin/firestore";
import {
  GAME_PRESENCE,
  type GamePresence,
  INVITE_BLOCKING_PRESENCE,
  presenceLabelAr,
} from "@/lib/social/presence-constants";

export { GAME_PRESENCE, type GamePresence, INVITE_BLOCKING_PRESENCE, presenceLabelAr };

const STALE_MS = 120_000;

export function presenceIsStale(updatedAt: Timestamp | null | undefined): boolean {
  if (!updatedAt || typeof updatedAt.toMillis !== "function") return true;
  return Date.now() - updatedAt.toMillis() > STALE_MS;
}

export function effectivePresence(
  raw: string | undefined | null,
  updatedAt: Timestamp | null | undefined,
): GamePresence {
  const p = (raw as GamePresence) || "offline";
  if (p === "offline") return "offline";
  if (presenceIsStale(updatedAt)) {
    if (p === "away") return "away";
    return "offline";
  }
  return GAME_PRESENCE.includes(p as GamePresence) ? (p as GamePresence) : "offline";
}
