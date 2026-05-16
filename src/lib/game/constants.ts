/** Legacy default (timeouts / cleanup hints) */
export const DEFAULT_TURN_SECONDS = 45;

/** Default question phase length (random match & fallback) */
export const QUESTION_PHASE_SECONDS = 20;

/** Default answer phase length */
export const ANSWER_PHASE_SECONDS = 15;

/** Private room timer sliders (seconds) */
export const ROOM_TIMER_MIN_SECONDS = 5;
export const ROOM_TIMER_MAX_SECONDS = 60;

/** Match total cap (optional safety) */
export const MATCH_MAX_MINUTES = 12;

/** Room inactivity before eligible for cleanup (ms) */
export const ROOM_INACTIVE_MS = 45 * 60 * 1000;

/** After a match ends, schedule full room deletion (cron respects `cleanupAt`) */
export const ROOM_POST_MATCH_CLEANUP_MS = 5 * 60 * 1000;

/** Min interval between chat sends (client hint; server should enforce too) */
export const CHAT_COOLDOWN_MS = 1200;

/** Typing indicator TTL */
export const TYPING_TTL_MS = 4000;

export const MATCHMAKING_POOL_ALL = "all";

export const TUTORIAL_BOT_UID = "__tutorial_bot__";
