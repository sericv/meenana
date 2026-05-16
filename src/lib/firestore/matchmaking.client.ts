"use client";

/**
 * @deprecated Use REST helpers in `@/lib/api/matchmaking-client` instead.
 * Kept as a thin alias so older imports keep working.
 */
export {
  matchmakingAck as ackMatchmakingResult,
  matchmakingJoin as joinMatchmakingViaApi,
  matchmakingLeave as leaveMatchmakingViaApi,
} from "@/lib/api/matchmaking-client";
