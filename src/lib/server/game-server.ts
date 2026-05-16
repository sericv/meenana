import { randomUUID } from "node:crypto";
import { FieldPath, FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { col, roomPlayerCardsCol } from "@/lib/firestore/paths";
import {
  ANSWER_PHASE_SECONDS,
  QUESTION_PHASE_SECONDS,
  ROOM_POST_MATCH_CLEANUP_MS,
} from "@/lib/game/constants";
import { ALL_CARDS, pickTwoCards } from "@/lib/game/cards";
import { generateGuessAliases } from "@/lib/game/guess-alias-generator";
import { guessMatchesCard } from "@/lib/game/validation";

/** Synthetic bot uids always start with this prefix. */
export const BOT_UID_PREFIX = "bot:";
export function isBotUid(uid: string | null | undefined): boolean {
  return typeof uid === "string" && uid.startsWith(BOT_UID_PREFIX);
}

function messagesRef(db: Firestore, roomId: string) {
  return db.collection(col.rooms).doc(roomId).collection("messages");
}

function opponentOf(order: string[], uid: string): string | null {
  return order.find((u) => u !== uid) ?? null;
}

function readRoomTimers(room: Record<string, unknown>): {
  q: number;
  a: number;
} {
  const qRaw = Number(room.questionTimerSec ?? QUESTION_PHASE_SECONDS);
  const aRaw = Number(room.answerTimerSec ?? ANSWER_PHASE_SECONDS);
  const q = Number.isFinite(qRaw) && qRaw >= 3 ? Math.min(120, qRaw) : QUESTION_PHASE_SECONDS;
  const a = Number.isFinite(aRaw) && aRaw >= 3 ? Math.min(120, aRaw) : ANSWER_PHASE_SECONDS;
  return { q, a };
}

function readMatchTimers(m: Record<string, unknown>): { q: number; a: number } {
  const qRaw = Number(m.questionSeconds ?? QUESTION_PHASE_SECONDS);
  const aRaw = Number(m.answerSeconds ?? ANSWER_PHASE_SECONDS);
  return {
    q: Number.isFinite(qRaw) ? qRaw : QUESTION_PHASE_SECONDS,
    a: Number.isFinite(aRaw) ? aRaw : ANSWER_PHASE_SECONDS,
  };
}

/** Firestore document max ~1 MiB; two cards + room fields — hard cap per image */
const MAX_CUSTOM_DATA_URL_CHARS = 180_000;

type CardAssignment = {
  cardId: string;
  name: string;
  nameAr: string;
  imageUrl: string;
  categoryId: string;
  guessAliases: string[];
};

function storedCardToAssignment(
  item: Record<string, unknown>,
  categoryId: string,
): CardAssignment {
  const id = String(item.id ?? "").trim();
  const nameAr = String(item.nameAr ?? "").trim();
  const imageUrl = String(item.imageUrl ?? "").trim();
  const name = String(item.name ?? nameAr).trim();
  const clientAliases = Array.isArray(item.aliases)
    ? item.aliases.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (!id || nameAr.length < 1) throw new Error("CUSTOM_OPPONENT_INVALID");
  // Accept either a data URL (uploaded by human) or a public asset URL
  // (auto-picked from the catalog for a bot opponent).
  const isDataUrl = imageUrl.startsWith("data:image/");
  const isAssetUrl = imageUrl.startsWith("/") || /^https?:\/\//i.test(imageUrl);
  if (!isDataUrl && !isAssetUrl) throw new Error("CUSTOM_OPPONENT_INVALID");
  if (isDataUrl && imageUrl.length > MAX_CUSTOM_DATA_URL_CHARS) throw new Error("CUSTOM_IMAGE_TOO_LARGE");
  const guessAliases = [
    ...new Set([
      ...generateGuessAliases(nameAr),
      ...generateGuessAliases(name),
      ...clientAliases,
    ]),
  ];
  return {
    cardId: `custom:${id}`,
    name,
    nameAr,
    imageUrl,
    categoryId,
    guessAliases,
  };
}

/**
 * Build the per-player card assignments for custom-cards mode.
 *
 * Storage contract:
 *   `customOpponentSelections[uid]` = the card that the player with `uid`
 *   uploaded *for the opponent to guess*.
 *
 * So the secret card that lives behind player P0's identity (i.e. the card
 * P0 must guess about himself, which P1 can see) is what P1 uploaded — and
 * vice-versa. We swap on the way out:
 *     forP0 ← fromP1     forP1 ← fromP0
 *
 * The result is later written to `rooms/{roomId}/playerCards/{playerUid}`
 * (P0's hidden card under doc P0; P1's hidden card under doc P1). The wire
 * shows the *opponent's* doc to each client, so each player ends up looking
 * at the card their opponent chose for them. Never the card they uploaded.
 */
function readOpponentCustomAssignments(
  room: Record<string, unknown>,
  p0: string,
  p1: string,
): { forP0: CardAssignment; forP1: CardAssignment } | null {
  if (room.customCardsEnabled !== true) return null;

  const raw = room.customOpponentSelections;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("CUSTOM_OPPONENT_INCOMPLETE");

  const map = raw as Record<string, unknown>;
  const fromP1 = map[p1]; // card P1 uploaded → belongs to P0 in match
  const fromP0 = map[p0]; // card P0 uploaded → belongs to P1 in match

  if (!fromP1 || typeof fromP1 !== "object" || Array.isArray(fromP1)) {
    throw new Error("CUSTOM_OPPONENT_INCOMPLETE");
  }
  if (!fromP0 || typeof fromP0 !== "object" || Array.isArray(fromP0)) {
    throw new Error("CUSTOM_OPPONENT_INCOMPLETE");
  }

  const categoryId = typeof room.categoryId === "string" ? room.categoryId : "general";

  return {
    forP0: storedCardToAssignment(fromP1 as Record<string, unknown>, categoryId),
    forP1: storedCardToAssignment(fromP0 as Record<string, unknown>, categoryId),
  };
}

// ─── Start match ─────────────────────────────────────────────────────────────

export async function startMatchForRoom(args: {
  roomId: string;
  actingUid: string;
}): Promise<{ matchId: string }> {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(args.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw new Error("ROOM_NOT_FOUND");

  const room = roomSnap.data()!;
  if (room.hostUid !== args.actingUid) throw new Error("NOT_HOST");
  if (room.status !== "lobby") throw new Error("ROOM_NOT_LOBBY");

  const playerUids = (room.playerUids as string[]) ?? [];
  if (playerUids.length !== 2) throw new Error("NEED_TWO_PLAYERS");
  if (!room.players?.every((p: { ready?: boolean }) => p.ready)) {
    throw new Error("NOT_READY");
  }

  const { q: qSec, a: aSec } = readRoomTimers(room);

  const categoryId = typeof room.categoryId === "string" ? room.categoryId : undefined;

  // Bot mode: if custom cards are enabled and a bot is present, auto-pick
  // a random card from the catalog for the bot to give to the human player.
  if (room.customCardsEnabled === true) {
    const sels = (room.customOpponentSelections as Record<string, unknown>) ?? {};
    const botUid = playerUids.find(isBotUid);
    if (botUid && !sels[botUid]) {
      const pool = ALL_CARDS.filter((c) => !categoryId || c.categoryId === categoryId);
      const src = pool.length >= 1 ? pool : ALL_CARDS;
      const pick = src[Math.floor(Math.random() * src.length)]!;
      const botStored = {
        id: pick.id,
        nameAr: pick.nameAr,
        name: pick.name,
        imageUrl: pick.imageUrl,
        aliases: [
          ...new Set([
            ...generateGuessAliases(pick.nameAr),
            ...generateGuessAliases(pick.name),
            ...(pick.tags ?? []),
          ]),
        ],
        savedAt: FieldValue.serverTimestamp(),
      };
      await roomRef.update({
        [`customOpponentSelections.${botUid}`]: botStored,
        [`customOpponentCardAssigned.${botUid}`]: true,
        lastActivityAt: FieldValue.serverTimestamp(),
      });
      // Re-read room with bot selection now present.
      const fresh = await roomRef.get();
      Object.assign(room, fresh.data()!);
    }
  }

  const customPair = readOpponentCustomAssignments(room, playerUids[0]!, playerUids[1]!);
  let c0: CardAssignment;
  let c1: CardAssignment;
  if (customPair) {
    c0 = customPair.forP0;
    c1 = customPair.forP1;
    console.log(
      `[startMatch] custom cards bound — p0=${playerUids[0]} will guess "${c0.nameAr}" (uploaded by p1=${playerUids[1]}); p1 will guess "${c1.nameAr}" (uploaded by p0)`,
    );
  } else {
    const pair = pickTwoCards(categoryId);
    if (!pair) throw new Error("NOT_ENOUGH_CARDS");
    const [g0, g1] = pair;
    c0 = {
      cardId: g0.id,
      name: g0.name,
      nameAr: g0.nameAr,
      imageUrl: g0.imageUrl,
      categoryId: g0.categoryId,
      guessAliases: [],
    };
    c1 = {
      cardId: g1.id,
      name: g1.name,
      nameAr: g1.nameAr,
      imageUrl: g1.imageUrl,
      categoryId: g1.categoryId,
      guessAliases: [],
    };
  }
  const [p0, p1] = [playerUids[0]!, playerUids[1]!];

  const matchRef = db.collection(col.matches).doc();
  const matchId = matchRef.id;
  const now = FieldValue.serverTimestamp();
  const qDeadline = Timestamp.fromMillis(Date.now() + qSec * 1000);

  const batch = db.batch();

  batch.set(roomRef, { status: "playing", matchId, lastActivityAt: now, cleanupAt: null }, { merge: true });

  batch.set(matchRef, {
    roomId: args.roomId,
    status: "active",
    playerOrder: [p0, p1],
    chatPhase: "question",
    actorUid: p0,
    turnDeadline: qDeadline,
    questionSeconds: qSec,
    answerSeconds: aSec,
    winnerUid: null,
    winReason: null,
    startedAt: now,
    endedAt: null,
  });

  // New contract: `playerCards/{uid}` holds the card that `uid` must guess
  // (i.e. the card the OPPONENT uploaded for `uid`). This is also the card
  // that `uid` sees on their own screen during the match. With custom mode:
  //   c0 = forP0 = fromP1   → stored under playerCards/p0
  //   c1 = forP1 = fromP0   → stored under playerCards/p1
  const pc0 = db.doc(`${roomPlayerCardsCol(args.roomId)}/${p0}`);
  const pc1 = db.doc(`${roomPlayerCardsCol(args.roomId)}/${p1}`);
  batch.set(pc0, {
    cardId: c0.cardId,
    name: c0.name,
    nameAr: c0.nameAr,
    imageUrl: c0.imageUrl,
    categoryId: c0.categoryId,
    guessAliases: c0.guessAliases,
  });
  batch.set(pc1, {
    cardId: c1.cardId,
    name: c1.name,
    nameAr: c1.nameAr,
    imageUrl: c1.imageUrl,
    categoryId: c1.categoryId,
    guessAliases: c1.guessAliases,
  });

  const sysRef = messagesRef(db, args.roomId).doc();
  batch.set(sysRef, {
    senderUid: "system",
    senderName: "النظام",
    type: "system",
    text: `انطلقت المباراة! ${qSec} ثانية لطرح سؤال، ثم ${aSec} ثانية للإجابة. يبدأ اللاعب الأول.`,
    createdAt: now,
  });

  await batch.commit();
  return { matchId };
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function handleChat(args: {
  roomId: string;
  matchId: string;
  uid: string;
  displayName: string;
  text: string;
}) {
  const db = getAdminDb();
  const matchRef = db.collection(col.matches).doc(args.matchId);
  const roomRef = db.collection(col.rooms).doc(args.roomId);

  await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) throw new Error("MATCH_NOT_FOUND");
    const m = matchSnap.data()!;
    if (m.status !== "active") throw new Error("MATCH_ENDED");

    const { q: qSec, a: aSec } = readMatchTimers(m);

    const order = m.playerOrder as string[];
    if (!order.includes(args.uid)) throw new Error("NOT_IN_MATCH");

    const phase = (m.chatPhase as string) === "answer" ? "answer" : "question";
    const actorUid = String(m.actorUid ?? "");
    const dl = m.turnDeadline as Timestamp | undefined;
    const dlMs = dl?.toMillis?.() ?? 0;
    if (actorUid && args.uid !== actorUid) throw new Error("NOT_YOUR_TURN");
    if (dlMs && Date.now() > dlMs + 800) throw new Error("TURN_EXPIRED");

    const msgRef = messagesRef(db, args.roomId).doc();

    if (phase === "question") {
      const opp = opponentOf(order, args.uid);
      if (!opp) throw new Error("BAD_MATCH");
      tx.set(msgRef, {
        senderUid: args.uid,
        senderName: args.displayName,
        type: "question",
        text: args.text,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        matchRef,
        {
          chatPhase: "answer",
          actorUid: opp,
          turnDeadline: Timestamp.fromMillis(Date.now() + aSec * 1000),
        },
        { merge: true },
      );
    } else {
      tx.set(msgRef, {
        senderUid: args.uid,
        senderName: args.displayName,
        type: "chat",
        text: args.text,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        matchRef,
        {
          chatPhase: "question",
          actorUid: args.uid,
          turnDeadline: Timestamp.fromMillis(Date.now() + qSec * 1000),
        },
        { merge: true },
      );
    }

    tx.set(roomRef, { lastActivityAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

export async function handleTurnTimeout(args: {
  roomId: string;
  matchId: string;
  uid: string;
}): Promise<{ advanced: boolean }> {
  const db = getAdminDb();
  const matchRef = db.collection(col.matches).doc(args.matchId);
  const roomRef = db.collection(col.rooms).doc(args.roomId);

  const result = await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) throw new Error("MATCH_NOT_FOUND");
    const m = matchSnap.data()!;
    if (m.status !== "active") return { advanced: false };

    const { q: qSec, a: aSec } = readMatchTimers(m);

    const order = m.playerOrder as string[];
    if (!order.includes(args.uid)) throw new Error("NOT_IN_MATCH");

    const dl = m.turnDeadline as Timestamp | undefined;
    const dlMs = dl?.toMillis?.() ?? 0;
    // Server-authoritative: once the deadline has passed, either player may
    // invoke this. That way the opponent's client can advance the match when
    // the actor's tab is backgrounded and timers are throttled (previously
    // only the actor could call, which caused stuck turns and frozen timers).
    if (!dlMs || Date.now() < dlMs - 500) return { advanced: false };

    const phase = (m.chatPhase as string) === "answer" ? "answer" : "question";
    const actorUid = String(m.actorUid ?? "");
    if (!actorUid) return { advanced: false };

    const sysRef = messagesRef(db, args.roomId).doc();

    if (phase === "question") {
      const opp = opponentOf(order, actorUid);
      if (!opp) throw new Error("BAD_MATCH");
      tx.set(sysRef, {
        senderUid: "system",
        senderName: "النظام",
        type: "system",
        text: "انتهى وقت السؤال — انتقل الدور للخصم.",
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        matchRef,
        {
          chatPhase: "question",
          actorUid: opp,
          turnDeadline: Timestamp.fromMillis(Date.now() + qSec * 1000),
        },
        { merge: true },
      );
    } else {
      const opp = opponentOf(order, actorUid);
      if (!opp) throw new Error("BAD_MATCH");
      tx.set(sysRef, {
        senderUid: "system",
        senderName: "النظام",
        type: "system",
        text: "انتهى وقت الإجابة — دور سؤال جديد.",
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        matchRef,
        {
          chatPhase: "question",
          actorUid: opp,
          turnDeadline: Timestamp.fromMillis(Date.now() + qSec * 1000),
        },
        { merge: true },
      );
    }

    tx.set(roomRef, { lastActivityAt: FieldValue.serverTimestamp() }, { merge: true });
    return { advanced: true };
  });

  return result;
}

// ─── Guess (only on your turn as actor) ─────────────────────────────────────

export async function handleGuess(args: {
  roomId: string;
  matchId: string;
  uid: string;
  displayName: string;
  guess: string;
}): Promise<{ correct: boolean }> {
  const db = getAdminDb();
  const matchRef = db.collection(col.matches).doc(args.matchId);
  const cardRef = db.doc(`${roomPlayerCardsCol(args.roomId)}/${args.uid}`);
  const roomRef = db.collection(col.rooms).doc(args.roomId);
  const msgs = messagesRef(db, args.roomId);

  const result = await db.runTransaction(async (tx) => {
    const [matchSnap, cardSnap] = await Promise.all([tx.get(matchRef), tx.get(cardRef)]);

    if (!matchSnap.exists) throw new Error("MATCH_NOT_FOUND");
    const m = matchSnap.data()!;
    if (m.status !== "active") throw new Error("MATCH_ENDED");

    const actorUid = String(m.actorUid ?? "");
    if (actorUid !== args.uid) throw new Error("NOT_YOUR_TURN_GUESS");

    if (!cardSnap.exists) throw new Error("NO_HIDDEN_CARD");

    const card = cardSnap.data()!;
    const storedAliases = Array.isArray(card.guessAliases)
      ? (card.guessAliases as unknown[]).map((x) => String(x))
      : undefined;
    const correct = guessMatchesCard(
      args.guess,
      String(card.name ?? ""),
      String(card.nameAr ?? ""),
      typeof card.cardId === "string" ? card.cardId : undefined,
      storedAliases,
    );

    tx.set(msgs.doc(), {
      senderUid: args.uid,
      senderName: args.displayName,
      type: "guess",
      text: args.guess,
      correct,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (correct) {
      tx.set(msgs.doc(), {
        senderUid: "system",
        senderName: "النظام",
        type: "system",
        text: `🎉 ${args.displayName} خمّن البطاقة بشكل صحيح وفاز!`,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(matchRef, { status: "ended", winnerUid: args.uid, winReason: "guess", endedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(
        roomRef,
        {
          status: "ended",
          lastActivityAt: FieldValue.serverTimestamp(),
          cleanupAt: Timestamp.fromMillis(Date.now() + ROOM_POST_MATCH_CLEANUP_MS),
        },
        { merge: true },
      );
    } else {
      tx.set(msgs.doc(), {
        senderUid: "system",
        senderName: "النظام",
        type: "system",
        text: `${args.displayName} خمن بشكل خاطئ`,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(roomRef, { lastActivityAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    return { correct };
  });

  return result;
}

/** Active player forfeits — opponent wins. */
export async function handleLeaveMatch(args: { roomId: string; uid: string }) {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(args.roomId);

  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) throw new Error("ROOM_NOT_FOUND");
    const room = roomSnap.data()!;
    const uids = (room.playerUids as string[]) ?? [];
    if (!uids.includes(args.uid)) throw new Error("NOT_IN_ROOM");
    const opp = opponentOf(uids, args.uid);
    const matchId = String(room.matchId ?? "");
    const status = String(room.status ?? "");

    if (status === "ended") return;

    if (status === "lobby") {
      if (opp) {
        tx.set(roomRef, {
          lobbyLeftByUid: args.uid,
          lastActivityAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      return;
    }

    if (!opp) throw new Error("NO_OPPONENT");

    if (status === "playing" && matchId) {
      const matchRef = db.collection(col.matches).doc(matchId);
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists) throw new Error("MATCH_NOT_FOUND");
      const ms = matchSnap.data()!;
      if (ms.status !== "active") throw new Error("MATCH_ALREADY_ENDED");

      const sysRef = messagesRef(db, args.roomId).doc();
      tx.set(sysRef, {
        senderUid: "system",
        senderName: "النظام",
        type: "system",
        text: `غادر اللاعب الغرفة.`,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(matchRef, {
        status: "ended",
        winnerUid: opp,
        winReason: "forfeit",
        endedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.set(roomRef, {
        status: "ended",
        leftByUid: args.uid,
        lastActivityAt: FieldValue.serverTimestamp(),
        cleanupAt: Timestamp.fromMillis(Date.now() + ROOM_POST_MATCH_CLEANUP_MS),
      }, { merge: true });
      return;
    }
  });
}

export async function setOpponentCustomCard(args: {
  roomId: string;
  uid: string;
  card: {
    id?: string;
    nameAr: string;
    name?: string;
    imageUrl: string;
    aliases?: string[];
  };
}) {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(args.roomId);

  let legacyKeys: string[] = [];

  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) throw new Error("ROOM_NOT_FOUND");
    const room = roomSnap.data()!;
    if (String(room.status) !== "lobby") throw new Error("ROOM_NOT_LOBBY");
    const uids = (room.playerUids as string[]) ?? [];
    if (!uids.includes(args.uid)) throw new Error("NOT_IN_ROOM");
    if (room.customCardsEnabled !== true) throw new Error("CUSTOM_NOT_ENABLED");
    // Allow uploading the opponent's custom card before the opponent has joined.
    // The selection is keyed by the giver's uid; when the match starts the
    // server reads `selections[opponentUid]`, so order of arrival doesn't matter.
    // Players still can't mark themselves ready until both selections exist.

    const img = String(args.card.imageUrl ?? "").trim();
    if (!img.startsWith("data:image/")) throw new Error("CUSTOM_OPPONENT_INVALID");
    if (img.length > MAX_CUSTOM_DATA_URL_CHARS) throw new Error("CUSTOM_IMAGE_TOO_LARGE");
    const nameAr = String(args.card.nameAr ?? "").trim();
    if (nameAr.length < 1) throw new Error("CUSTOM_OPPONENT_INVALID");

    const name = String(args.card.name ?? nameAr).trim();
    const id = String(args.card.id ?? "").trim() || randomUUID();
    const clientAliases = Array.isArray(args.card.aliases)
      ? args.card.aliases.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const aliases = [
      ...new Set([
        ...generateGuessAliases(nameAr),
        ...generateGuessAliases(name),
        ...clientAliases,
      ]),
    ];

    const stored = {
      id,
      nameAr,
      name,
      imageUrl: img,
      aliases,
      savedAt: FieldValue.serverTimestamp(),
    };

    // Detect legacy literal-name top-level fields produced by the previous
    // `set({...}, {merge:true})` bug (their NAME contains a dot).
    legacyKeys = Object.keys(room).filter(
      (k) =>
        k.startsWith("customOpponentSelections.") ||
        k.startsWith("customOpponentCardAssigned."),
    );

    // IMPORTANT: use `update` (not `set({...}, {merge:true})`) so the dotted
    // keys below are interpreted as nested field paths instead of literal
    // field names. The parent maps are seeded as {} on room creation, so this
    // is safe even on the very first save.
    tx.update(roomRef, {
      [`customOpponentSelections.${args.uid}`]: stored,
      [`customOpponentCardAssigned.${args.uid}`]: true,
      lastActivityAt: FieldValue.serverTimestamp(),
    });
  });

  // Best-effort cleanup of legacy garbage fields, after the transaction.
  // Each is deleted via FieldPath so Firestore treats the dot-bearing name
  // as a single literal field (not as a nested path).
  if (legacyKeys.length > 0) {
    try {
      const path = new FieldPath(legacyKeys[0]!);
      const extra: unknown[] = [];
      for (let i = 1; i < legacyKeys.length; i++) {
        extra.push(new FieldPath(legacyKeys[i]!), FieldValue.delete());
      }
      // Admin SDK supports the (firstPath, firstValue, ...more) variadic form.
      await (
        roomRef.update as (
          field: FieldPath,
          value: unknown,
          ...more: unknown[]
        ) => Promise<unknown>
      )(path, FieldValue.delete(), ...extra);
    } catch (e) {
      console.warn("[opponent-custom-card] legacy-field cleanup failed:", String(e));
    }
  }

  console.log(
    `[opponent-custom-card] saved room=${args.roomId} giver=${args.uid} name="${args.card.nameAr}" imgLen=${(args.card.imageUrl ?? "").length}${legacyKeys.length ? ` legacyCleaned=${legacyKeys.length}` : ""}`,
  );
}

// ─── Bot AI ────────────────────────────────────────────────────────────────
//
// Bots are synthetic players (uid prefixed "bot:") whose moves are produced
// here on the server. The host's client polls /api/game/bot-tick; if it's
// currently the bot's turn we advance one phase (question / answer / guess).
//
// The strategy is intentionally simple:
//   • Question phase: ask one of a few generic Arabic yes/no questions.
//   • Answer phase: reply yes/no by inspecting the LAST question message and
//     comparing it against the bot's hidden card (nameAr/categoryId).
//   • Guess: only fire when many turns have passed; pick a random card from
//     the catalog. The bot wins occasionally — keeps games fair.

const BOT_QUESTIONS: readonly string[] = [
  "هل أنا شخصية حقيقية؟",
  "هل أنا حيوان؟",
  "هل أنا مشهور؟",
  "هل أنا من الشرق الأوسط؟",
  "هل أنا رجل؟",
  "هل أنا امرأة؟",
  "هل أنا ألعب الكرة؟",
  "هل أنا في فيلم أو مسلسل؟",
  "هل أنا في لعبة فيديو؟",
  "هل أنا من الأنمي؟",
  "هل أنا صغير الحجم؟",
  "هل لون شعري داكن؟",
  "هل أعيش في البر؟",
  "هل أنا قوي؟",
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Yes/no for the answer phase given the question text + the bot's own card. */
function botAnswerForQuestion(question: string, ownCard: Record<string, unknown> | null): string {
  const q = String(question).toLowerCase();
  const cardCat = String(ownCard?.categoryId ?? "");
  const cardName = String(ownCard?.nameAr ?? "");

  // Lightweight Arabic keyword heuristics — better than random.
  const isHuman = ["celebrities", "general"].includes(cardCat) && !/قط|كلب|أسد|حيوان/.test(cardName);
  const isAnimal = cardCat === "animals";
  const isGame = cardCat === "games";
  const isAnime = cardCat === "anime";

  if (/حيوان/.test(q)) return isAnimal ? "نعم" : "لا";
  if (/مشهور|شخصية حقيقي/.test(q)) return cardCat === "celebrities" ? "نعم" : "لا";
  if (/أنمي|انمي/.test(q)) return isAnime ? "نعم" : "لا";
  if (/لعبة|ألعاب|video/.test(q)) return isGame ? "نعم" : "لا";
  if (/إنسان|رجل|امرأة|بشر/.test(q)) return isHuman ? "نعم" : "لا";

  // Default: 50/50 with a slight bias to "no" (most yes/no questions are
  // narrower than the truth space).
  return Math.random() < 0.55 ? "لا" : "نعم";
}

/**
 * Bot tick — advances one phase if it's the bot's turn. Safe to call on a
 * loop from the host's client; uses a transaction so concurrent ticks are
 * idempotent. Returns whether any move was made.
 */
export async function botTick(args: {
  roomId: string;
  callerUid: string;
}): Promise<{ acted: boolean; reason?: string }> {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(args.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) return { acted: false, reason: "ROOM_NOT_FOUND" };
  const room = roomSnap.data()!;
  if (room.vsBot !== true) return { acted: false, reason: "NOT_BOT_ROOM" };
  if (String(room.hostUid ?? "") !== args.callerUid) return { acted: false, reason: "NOT_HOST" };
  if (String(room.status ?? "") !== "playing") return { acted: false, reason: "NOT_PLAYING" };

  const matchId = String(room.matchId ?? "");
  if (!matchId) return { acted: false, reason: "NO_MATCH" };
  const matchRef = db.collection(col.matches).doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) return { acted: false, reason: "MATCH_NOT_FOUND" };
  const m = matchSnap.data()!;
  if (m.status !== "active") return { acted: false, reason: "MATCH_NOT_ACTIVE" };

  const botUid = String(room.botUid ?? "");
  if (!botUid || !isBotUid(botUid)) return { acted: false, reason: "NO_BOT_UID" };

  const actor = String(m.actorUid ?? "");
  if (actor !== botUid) return { acted: false, reason: "NOT_BOT_TURN" };

  const phase = (m.chatPhase as string) === "answer" ? "answer" : "question";
  const order = m.playerOrder as string[];
  const opp = order.find((u) => u !== botUid) ?? null;
  if (!opp) return { acted: false, reason: "NO_OPPONENT" };

  const { q: qSec, a: aSec } = readMatchTimers(m);
  const msgs = messagesRef(db, args.roomId);

  if (phase === "question") {
    // Decide whether to GUESS instead of asking another question — small
    // probability scales with how many questions the bot has asked.
    const allMsgs = await msgs.where("senderUid", "==", botUid).get();
    const botQuestionCount = allMsgs.docs.filter((d) => d.data().type === "question").length;
    const guessChance = Math.min(0.35, 0.05 + botQuestionCount * 0.05);
    if (botQuestionCount >= 3 && Math.random() < guessChance) {
      // Pick a random card name from the bot's category as a guess.
      const cardSnap = await db.doc(`${roomPlayerCardsCol(args.roomId)}/${botUid}`).get();
      const cardCat = String(cardSnap.data()?.categoryId ?? "");
      const pool = ALL_CARDS.filter((c) => !cardCat || c.categoryId === cardCat);
      const src = pool.length ? pool : ALL_CARDS;
      const guess = pickRandom(src).nameAr;
      await handleGuess({
        roomId: args.roomId,
        matchId,
        uid: botUid,
        displayName: "البوت",
        guess,
      }).catch(() => undefined);
      return { acted: true };
    }

    const text = pickRandom(BOT_QUESTIONS);
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(matchRef);
      const fm = fresh.data()!;
      if (fm.status !== "active") return;
      if (String(fm.actorUid ?? "") !== botUid) return;
      const msgRef = msgs.doc();
      tx.set(msgRef, {
        senderUid: botUid,
        senderName: "البوت",
        type: "question",
        text,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        matchRef,
        {
          chatPhase: "answer",
          actorUid: opp,
          turnDeadline: Timestamp.fromMillis(Date.now() + aSec * 1000),
        },
        { merge: true },
      );
      tx.set(roomRef, { lastActivityAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return { acted: true };
  }

  // Answer phase: respond yes/no to the last question.
  const recent = await msgs.orderBy("createdAt", "desc").limit(10).get();
  const lastQ = recent.docs.find((d) => d.data().type === "question");
  const questionText = String(lastQ?.data()?.text ?? "");
  const cardSnap = await db.doc(`${roomPlayerCardsCol(args.roomId)}/${botUid}`).get();
  const text = botAnswerForQuestion(questionText, cardSnap.data() ?? null);

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(matchRef);
    const fm = fresh.data()!;
    if (fm.status !== "active") return;
    if (String(fm.actorUid ?? "") !== botUid) return;
    const msgRef = msgs.doc();
    tx.set(msgRef, {
      senderUid: botUid,
      senderName: "البوت",
      type: "chat",
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      matchRef,
      {
        chatPhase: "question",
        actorUid: botUid,
        turnDeadline: Timestamp.fromMillis(Date.now() + qSec * 1000),
      },
      { merge: true },
    );
    tx.set(roomRef, { lastActivityAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { acted: true };
}

// ─── Reveal both cards after match end ──────────────────────────────────────
// Firestore rules forbid a player from reading their own `playerCards/{uid}`
// document during play (anti-cheat). After the match is ENDED we expose both
// cards via this server endpoint so the result screen can show them.

type RevealedCard = {
  cardId: string;
  name: string;
  nameAr: string;
  imageUrl: string;
  categoryId: string;
};

export async function revealMatchCards(args: {
  roomId: string;
  uid: string;
}): Promise<{ myCard: RevealedCard | null; opponentCard: RevealedCard | null; opponentUid: string | null }> {
  const db = getAdminDb();
  const roomRef = db.collection(col.rooms).doc(args.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw new Error("ROOM_NOT_FOUND");
  const room = roomSnap.data()!;
  const uids = (room.playerUids as string[]) ?? [];
  if (!uids.includes(args.uid)) throw new Error("NOT_IN_ROOM");

  const status = String(room.status ?? "");
  if (status !== "ended" && status !== "playing") {
    throw new Error("MATCH_NOT_STARTED");
  }

  // Whether the match itself has ended (we reveal MY hidden card only then).
  let matchEnded = false;
  if (status === "ended") {
    matchEnded = true;
  } else {
    const matchId = String(room.matchId ?? "");
    if (matchId) {
      const m = await db.collection(col.matches).doc(matchId).get();
      if (m.exists && m.data()?.status === "ended") matchEnded = true;
    }
  }

  const opponentUid = uids.find((u) => u !== args.uid) ?? null;

  // The opponent's card (which the human is trying to guess "about himself"
  // — i.e. what shows on his screen) is always readable: it's the card the
  // opponent uploaded for me. We expose it via this server endpoint to bypass
  // any client-side Firestore Rules issue (deployed rules drifting, etc.).
  const oppDoc = opponentUid
    ? await db.doc(`${roomPlayerCardsCol(args.roomId)}/${opponentUid}`).get()
    : null;

  // MY hidden card is gated until match end (anti-cheat: would let me see
  // the answer the opponent is asking about).
  const myDoc = matchEnded
    ? await db.doc(`${roomPlayerCardsCol(args.roomId)}/${args.uid}`).get()
    : null;

  const pick = (snap: FirebaseFirestore.DocumentSnapshot | null): RevealedCard | null => {
    if (!snap || !snap.exists) return null;
    const d = snap.data()!;
    return {
      cardId: String(d.cardId ?? ""),
      name: String(d.name ?? ""),
      nameAr: String(d.nameAr ?? ""),
      imageUrl: String(d.imageUrl ?? ""),
      categoryId: String(d.categoryId ?? ""),
    };
  };

  return {
    myCard: pick(myDoc),
    opponentCard: pick(oppDoc),
    opponentUid,
  };
}

export async function enforceChatRate(roomId: string, uid: string, minIntervalMs: number) {
  const db = getAdminDb();
  const ref = db.collection(col.rooms).doc(roomId).collection("serverRate").doc(uid);
  const snap = await ref.get();
  const last = snap.exists
    ? (snap.data()!.lastAt as Timestamp | undefined)?.toMillis?.() ?? 0
    : 0;
  if (last && Date.now() - last < minIntervalMs) {
    throw new Error("RATE_LIMIT");
  }
  await ref.set({ lastAt: FieldValue.serverTimestamp() }, { merge: true });
}
