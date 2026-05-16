export const GAME_PRESENCE = [
  "online",
  "offline",
  "in_match",
  "in_lobby",
  "matchmaking",
  "away",
] as const;

export type GamePresence = (typeof GAME_PRESENCE)[number];

const LABEL_AR: Record<GamePresence, string> = {
  online: "متصل",
  offline: "غير متصل",
  in_match: "في مباراة",
  in_lobby: "في غرفة",
  matchmaking: "يبحث عن مباراة",
  away: "بالخارج",
};

export function presenceLabelAr(p: GamePresence | string | undefined | null): string {
  if (!p) return LABEL_AR.offline;
  return LABEL_AR[p as GamePresence] ?? LABEL_AR.offline;
}

/** Server-side: block room invites when invitee is in these states. */
export const INVITE_BLOCKING_PRESENCE: ReadonlySet<GamePresence> = new Set([
  "in_match",
  "matchmaking",
]);
