import type { Timestamp } from "firebase/firestore";

export type RoomStatus = "lobby" | "playing" | "ended";

export type MatchStatus = "active" | "ended";

export interface RoomPlayer {
  uid: string;
  displayName: string;
  ready: boolean;
  joinedAt: Timestamp | null;
}

/** One custom card a player assigns for their opponent (image as data URL). */
export interface StoredCustomRoomCard {
  id: string;
  nameAr: string;
  /** Optional Latin / display name — defaults to nameAr when omitted */
  name?: string;
  imageUrl: string;
  /** Client-precomputed alias hints; server merges with `generateGuessAliases` */
  aliases: string[];
  /** Server timestamp when card was last saved (lobby confirmation) */
  savedAt?: Timestamp | null;
}

export interface Room {
  id: string;
  code: string;
  hostUid: string;
  players: RoomPlayer[];
  playerJoinedAt?: Record<string, Timestamp | null>;
  playerUids: string[];
  status: RoomStatus;
  categoryId: string;
  matchId: string | null;
  tutorial: boolean;
  openJoin: boolean;
  /** True when created via random matchmaking (hide room code in UI) */
  randomMatch?: boolean;
  /** Lobby-only: custom timers for private rooms (seconds) */
  questionTimerSec?: number;
  answerTimerSec?: number;
  /** Set when opponent forfeits mid-match (remaining player sees & exits) */
  leftByUid?: string;
  /** Lobby: peer navigated away (optional notice) */
  lobbyLeftByUid?: string;
  /** Private room only: hide chat, use voice action buttons instead */
  voiceMode?: boolean;
  /** Premium: each player picks one image card for their opponent in lobby */
  customCardsEnabled?: boolean;
  /** Solo mode: the second player is an automated bot (uid starts with "bot:") */
  vsBot?: boolean;
  /** Solo mode: the bot's player uid (synthetic). Present iff `vsBot` is true. */
  botUid?: string;
  /**
   * Map giverUid → card they chose for their opponent.
   * Recipient sees opponentCard from playerCards; assignment at match start: `selections[opponentUid]`.
   */
  customOpponentSelections?: Record<string, StoredCustomRoomCard>;
  /** Server-set: uid → true after successful opponent-custom save (cleared on replay) */
  customOpponentCardAssigned?: Record<string, boolean>;
  createdAt: Timestamp | null;
  lastActivityAt: Timestamp | null;
  cleanupAt: Timestamp | null;
}

export type ChatPhase = "question" | "answer";

export interface MatchState {
  id: string;
  roomId: string;
  status: MatchStatus;
  playerOrder: string[];
  /** Who must speak next (ask a question or give an answer) */
  actorUid: string | null;
  chatPhase: ChatPhase;
  turnDeadline: Timestamp | null;
  /** Effective timer lengths for this match (copied from room at start) */
  questionSeconds: number;
  answerSeconds: number;
  winnerUid: string | null;
  winReason: "guess" | "forfeit" | null;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
}

export type ChatMessageType = "chat" | "question" | "guess" | "system";

export interface ChatMessage {
  id: string;
  roomId: string;
  senderUid: string;
  senderName: string;
  type: ChatMessageType;
  text: string;
  correct?: boolean;
  createdAt: Timestamp | null;
}

export interface Category {
  id: string;
  nameAr: string;
  slug: string;
  order: number;
}

export interface GameCard {
  id: string;
  name: string;
  nameAr: string;
  imageUrl: string;
  categoryId: string;
  tags: string[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  isGuest: boolean;
  createdAt: Timestamp | null;
  lastSeen: Timestamp | null;
  /** Preset illustrated avatar key when `photoURL` is empty (see `AVATAR_PRESETS`). */
  avatarId?: string;
  /** Animated GIF frame id (see `FRAME_REGISTRY`). */
  avatarFrameId?: string;
}

export interface OpponentCardView {
  card: GameCard;
}
