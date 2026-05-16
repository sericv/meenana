"use client";

import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col } from "@/lib/firestore/paths";
import { logFsListenAttach, logFsOpFailure } from "@/lib/firestore/fs-op-debug";
import {
  ANSWER_PHASE_SECONDS,
  QUESTION_PHASE_SECONDS,
} from "@/lib/game/constants";
import { isOpponentCustomCardComplete } from "@/lib/custom-cards/opponent-card-gate";
import type { ChatMessage, GameCard, MatchState, Room, StoredCustomRoomCard } from "@/types";

function parseCustomOpponentAssigned(raw: unknown): Room["customOpponentCardAssigned"] | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true) out[k] = true;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseOpponentSelections(raw: unknown): Room["customOpponentSelections"] | undefined {
  if (raw == null) return undefined;
  const entries: [string, unknown][] =
    raw instanceof Map
      ? [...raw.entries()].map(([k, v]) => [String(k), v])
      : typeof raw === "object" && !Array.isArray(raw)
        ? Object.entries(raw as Record<string, unknown>)
        : [];
  if (!entries.length) return undefined;

  const out: Record<string, StoredCustomRoomCard> = {};
  for (const [key, val] of entries) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const v = val as Record<string, unknown>;
    const nameAr = String(v.nameAr ?? "").trim();
    const imageUrl = String(v.imageUrl ?? "").trim();
    const id = String(v.id ?? "").trim() || key;
    const savedAt =
      v.savedAt && typeof v.savedAt === "object" && "toMillis" in (v.savedAt as object)
        ? (v.savedAt as Timestamp)
        : null;
    const card: StoredCustomRoomCard = {
      id,
      nameAr,
      name: v.name !== undefined ? String(v.name) : undefined,
      imageUrl,
      aliases: Array.isArray(v.aliases) ? v.aliases.map((x) => String(x)) : [],
      savedAt: savedAt ?? undefined,
    };
    if (!isOpponentCustomCardComplete(card)) continue;
    out[key] = card;
  }
  return Object.keys(out).length ? out : undefined;
}

function tsMillis(t: Timestamp | null | undefined): number | null {
  if (!t || typeof (t as Timestamp).toMillis !== "function") return null;
  return (t as Timestamp).toMillis();
}

/** Fingerprint room for snapshot dedup (avoids rerenders when Firestore echoes identical data). */
function roomWireSignature(r: Room): string {
  return JSON.stringify({
    id: r.id,
    code: r.code,
    hostUid: r.hostUid,
    players: r.players.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      ready: p.ready,
      joinedAt: tsMillis(p.joinedAt),
    })),
    playerJoinedAt: r.playerJoinedAt
      ? Object.fromEntries(
          Object.entries(r.playerJoinedAt).map(([k, v]) => [k, tsMillis(v)]),
        )
      : {},
    playerUids: r.playerUids,
    status: r.status,
    categoryId: r.categoryId,
    matchId: r.matchId,
    tutorial: r.tutorial,
    openJoin: r.openJoin,
    randomMatch: r.randomMatch,
    vsBot: r.vsBot,
    botUid: r.botUid,
    questionTimerSec: r.questionTimerSec,
    answerTimerSec: r.answerTimerSec,
    leftByUid: r.leftByUid,
    lobbyLeftByUid: r.lobbyLeftByUid,
    voiceMode: r.voiceMode,
    customCardsEnabled: r.customCardsEnabled,
    customOpponentSelections: r.customOpponentSelections
      ? Object.fromEntries(
          Object.entries(r.customOpponentSelections).map(([k, c]) => [
            k,
            {
              id: c.id,
              nameAr: c.nameAr,
              name: c.name,
              imageUrlLen: (c.imageUrl ?? "").length,
              imageHeadTail: (() => {
                const u = c.imageUrl ?? "";
                if (!u) return "";
                return u.length <= 160 ? u : `${u.slice(0, 80)}…${u.slice(-80)}`;
              })(),
              aliases: c.aliases,
              savedAt: tsMillis(c.savedAt ?? null),
            },
          ]),
        )
      : undefined,
    customOpponentCardAssigned: r.customOpponentCardAssigned,
    createdAt: tsMillis(r.createdAt),
    lastActivityAt: tsMillis(r.lastActivityAt),
    cleanupAt: tsMillis(r.cleanupAt),
  });
}

function matchWireSignature(m: MatchState): string {
  return JSON.stringify({
    id: m.id,
    roomId: m.roomId,
    status: m.status,
    playerOrder: m.playerOrder,
    actorUid: m.actorUid,
    chatPhase: m.chatPhase,
    turnDeadline: tsMillis(m.turnDeadline),
    questionSeconds: m.questionSeconds,
    answerSeconds: m.answerSeconds,
    winnerUid: m.winnerUid,
    winReason: m.winReason,
    startedAt: tsMillis(m.startedAt),
    endedAt: tsMillis(m.endedAt),
  });
}

function messagesWireSignature(list: ChatMessage[]): string {
  return list
    .map(
      (m) =>
        `${m.id}\t${m.senderUid}\t${m.senderName}\t${m.type}\t${m.text}\t${m.correct ?? ""}\t${m.createdAt?.toMillis() ?? "n"}`,
    )
    .join("\n");
}

function opponentCardWireSignature(c: GameCard | null): string {
  if (!c) return "";
  const u = c.imageUrl ?? "";
  const tail = u.length <= 120 ? u : `${u.slice(0, 60)}…${u.slice(-60)}`;
  return `${c.id}\t${c.name}\t${c.nameAr}\t${c.categoryId}\t${u.length}\t${tail}`;
}

export function useRoomWire(roomId: string | null, myUid: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [opponentCard, setOpponentCard] = useState<GameCard | null>(null);
  const [wireError, setWireError] = useState<string | null>(null);

  const roomSigRef = useRef<string | null>(null);
  const matchSigRef = useRef<string | null>(null);
  const messagesSigRef = useRef<string | null>(null);
  const opponentCardSigRef = useRef<string | null>(null);

  const opponentUid = useMemo(() => {
    if (!room || !myUid) return null;
    return room.playerUids.find((u) => u !== myUid) ?? null;
  }, [room, myUid]);

  /** Last successful room/match snapshots — for error diagnostics (race-aware). */
  const lastRoomRef = useRef<Room | null>(null);
  const lastMatchRef = useRef<MatchState | null>(null);

  // Room snapshot
  useEffect(() => {
    if (!roomId) {
      roomSigRef.current = null;
      setRoom(null);
      lastRoomRef.current = null;
      return;
    }
    let cancelled = false;
    const db = getFirebaseDb();
    const path = `${col.rooms}/${roomId}`;
    logFsListenAttach("useRoomWire.room", path, { roomId, myUid });
    const unsub = onSnapshot(
      doc(db, col.rooms, roomId),
      (snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          roomSigRef.current = null;
          lastRoomRef.current = null;
          setRoom(null);
          return;
        }
        const d = snap.data();
        const next: Room = {
          id: snap.id,
          code: String(d.code ?? ""),
          hostUid: String(d.hostUid ?? ""),
          players: (d.players as Room["players"]) ?? [],
          playerJoinedAt: (d.playerJoinedAt as Record<string, Timestamp | null> | undefined) ?? {},
          playerUids: (d.playerUids as string[]) ?? [],
          status: d.status as Room["status"],
          categoryId: String(d.categoryId ?? ""),
          matchId: (d.matchId as string | null) ?? null,
          tutorial: Boolean(d.tutorial),
          openJoin: Boolean(d.openJoin),
          randomMatch: Boolean(d.randomMatch),
          vsBot: d.vsBot !== undefined ? Boolean(d.vsBot) : undefined,
          botUid: d.botUid != null ? String(d.botUid) : undefined,
          questionTimerSec: d.questionTimerSec !== undefined ? Number(d.questionTimerSec) : undefined,
          answerTimerSec: d.answerTimerSec !== undefined ? Number(d.answerTimerSec) : undefined,
          leftByUid: d.leftByUid !== undefined ? String(d.leftByUid) : undefined,
          lobbyLeftByUid: d.lobbyLeftByUid !== undefined ? String(d.lobbyLeftByUid) : undefined,
          voiceMode: d.voiceMode !== undefined ? Boolean(d.voiceMode) : undefined,
          customCardsEnabled:
            d.customCardsEnabled !== undefined ? Boolean(d.customCardsEnabled) : undefined,
          customOpponentSelections: parseOpponentSelections(d.customOpponentSelections),
          customOpponentCardAssigned: parseCustomOpponentAssigned(d.customOpponentCardAssigned),
          createdAt: (d.createdAt as Timestamp | null) ?? null,
          lastActivityAt: (d.lastActivityAt as Timestamp | null) ?? null,
          cleanupAt: (d.cleanupAt as Timestamp | null) ?? null,
        };
        const sig = roomWireSignature(next);
        if (sig === roomSigRef.current) return;
        roomSigRef.current = sig;
        lastRoomRef.current = next;
        setRoom(next);
      },
      (e) => {
        if (cancelled) return;
        setWireError((e as Error).message);
        const lr = lastRoomRef.current;
        const uids = lr?.playerUids ?? null;
        logFsOpFailure({
          area: "useRoomWire.room.onSnapshot",
          op: "listen",
          path,
          err: e,
          roomId,
          matchId: lr?.matchId ?? null,
          myUid,
          roomPlayerUids: uids,
          amInRoomPlayerUids: myUid && uids ? uids.includes(myUid) : null,
          extra: { lastKnownRoomStatus: lr?.status ?? null, lastKnownMatchId: lr?.matchId ?? null },
        });
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [roomId]);

  // Match snapshot (simplified — no turn fields)
  useEffect(() => {
    if (!room?.matchId) {
      matchSigRef.current = null;
      setMatch(null);
      lastMatchRef.current = null;
      return;
    }
    let cancelled = false;
    const db = getFirebaseDb();
    const mid = room.matchId;
    const path = `${col.matches}/${mid}`;
    logFsListenAttach("useRoomWire.match", path, {
      roomId,
      matchId: mid,
      myUid,
      roomPlayerUids: lastRoomRef.current?.playerUids ?? room.playerUids,
      amInRoomPlayerUids:
        myUid && room.playerUids ? room.playerUids.includes(myUid) : null,
    });
    const matchRef = doc(db, col.matches, mid);

    const applyMatchSnap = (snap: DocumentSnapshot) => {
      if (cancelled) return;
      if (!snap.exists()) {
        matchSigRef.current = null;
        lastMatchRef.current = null;
        setMatch(null);
        return;
      }
      const d = snap.data();
      const qs = Number(d.questionSeconds ?? QUESTION_PHASE_SECONDS);
      const as = Number(d.answerSeconds ?? ANSWER_PHASE_SECONDS);
      const next: MatchState = {
        id: snap.id,
        roomId: String(d.roomId ?? ""),
        status: d.status as MatchState["status"],
        playerOrder: (d.playerOrder as string[]) ?? [],
        actorUid: (d.actorUid as string | null) ?? null,
        chatPhase: (d.chatPhase as MatchState["chatPhase"]) ?? "question",
        turnDeadline: (d.turnDeadline as Timestamp | null) ?? null,
        questionSeconds: Number.isFinite(qs) ? qs : QUESTION_PHASE_SECONDS,
        answerSeconds: Number.isFinite(as) ? as : ANSWER_PHASE_SECONDS,
        winnerUid: (d.winnerUid as string | null) ?? null,
        winReason: (d.winReason as MatchState["winReason"]) ?? null,
        startedAt: (d.startedAt as Timestamp | null) ?? null,
        endedAt: (d.endedAt as Timestamp | null) ?? null,
      };
      const sig = matchWireSignature(next);
      if (sig === matchSigRef.current) return;
      matchSigRef.current = sig;
      lastMatchRef.current = next;
      setMatch(next);
    };

    void getDoc(matchRef)
      .then((snap) => {
        applyMatchSnap(snap);
      })
      .catch(() => {
        /* cold read can fail transiently; listener still converges */
      });

    const unsub = onSnapshot(
      matchRef,
      applyMatchSnap,
      (e) => {
        if (cancelled) return;
        setWireError((e as Error).message);
        const lr = lastRoomRef.current;
        const lm = lastMatchRef.current;
        const uids = lr?.playerUids ?? null;
        const po = lm?.playerOrder ?? null;
        logFsOpFailure({
          area: "useRoomWire.match.onSnapshot",
          op: "listen",
          path,
          err: e,
          roomId: lr?.id ?? roomId,
          matchId: mid,
          myUid,
          roomPlayerUids: uids,
          amInRoomPlayerUids: myUid && uids ? uids.includes(myUid) : null,
          matchPlayerOrder: po,
          amInMatchPlayerOrder: myUid && po ? po.includes(myUid) : null,
          extra: {
            wireRoomMatchId: room.matchId,
            lastKnownMatchStatus: lm?.status ?? null,
          },
        });
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [roomId, room?.matchId, myUid]);

  // Opponent card — read directly from `playerCards/{opponentUid}` via a
  // realtime snapshot. If Firestore Rules block the read (e.g. deployed rules
  // are out of sync with the repo) we fall back to a server endpoint that
  // surfaces the same card using the Admin SDK.
  useEffect(() => {
    if (!roomId || !opponentUid) {
      opponentCardSigRef.current = null;
      setOpponentCard(null);
      return;
    }
    const db = getFirebaseDb();
    const ouid = opponentUid;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let snapCancelled = false;

    const applyCard = (c: {
      cardId?: unknown; name?: unknown; nameAr?: unknown;
      imageUrl?: unknown; categoryId?: unknown;
    } | null) => {
      if (cancelled) return;
      if (!c) {
        opponentCardSigRef.current = null;
        setOpponentCard(null);
        return;
      }
      const next: GameCard = {
        id: String(c.cardId ?? ""),
        name: String(c.name ?? ""),
        nameAr: String(c.nameAr ?? ""),
        imageUrl: String(c.imageUrl ?? ""),
        categoryId: String(c.categoryId ?? ""),
        tags: [],
      };
      const sig = opponentCardWireSignature(next);
      if (sig === opponentCardSigRef.current) return;
      opponentCardSigRef.current = sig;
      setOpponentCard(next);
    };

    const fetchViaServer = async () => {
      try {
        const { postGame } = await import("@/lib/api/game-client");
        const res = (await postGame("/api/game/reveal-cards", { roomId })) as {
          opponentCard?: {
            cardId: string; name: string; nameAr: string;
            imageUrl: string; categoryId: string;
          } | null;
        };
        applyCard(res.opponentCard ?? null);
      } catch {
        // ignored — endpoint refuses until match has actually started
      }
    };

    const pcPath = `${col.rooms}/${roomId}/playerCards/${ouid}`;
    logFsListenAttach("useRoomWire.playerCards", pcPath, { roomId, opponentUid: ouid, myUid });
    const unsub = onSnapshot(
      doc(db, col.rooms, roomId, "playerCards", ouid),
      (snap) => {
        if (snapCancelled) return;
        if (!snap.exists()) {
          opponentCardSigRef.current = null;
          setOpponentCard(null);
          return;
        }
        applyCard(snap.data());
      },
      (err) => {
        if (snapCancelled) return;
        const lr = lastRoomRef.current;
        const uids = lr?.playerUids ?? null;
        logFsOpFailure({
          area: "useRoomWire.playerCards.onSnapshot",
          op: "listen",
          path: pcPath,
          err,
          roomId,
          matchId: lr?.matchId ?? null,
          opponentUid: ouid,
          myUid,
          roomPlayerUids: uids,
          amInRoomPlayerUids: myUid && uids ? uids.includes(myUid) : null,
          extra: { note: "fallback_to_reveal_cards_api" },
        });
        // Permission denied (rules drift) or transient error: switch to
        // server-driven polling until the match ends.
        setWireError(null);
        if (fallbackTimer) return;
        void fetchViaServer();
        fallbackTimer = setInterval(() => void fetchViaServer(), 2000);
      },
    );

    return () => {
      snapCancelled = true;
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      unsub();
    };
  }, [roomId, opponentUid]);

  // Messages
  useEffect(() => {
    if (!roomId) {
      messagesSigRef.current = null;
      setMessages([]);
      return;
    }
    let cancelled = false;
    const db = getFirebaseDb();
    const rid = roomId;
    const q = query(
      collection(db, col.rooms, rid, "messages"),
      orderBy("createdAt", "asc"),
      limit(150),
    );
    const msgPath = `${col.rooms}/${rid}/messages`;
    logFsListenAttach("useRoomWire.messages", msgPath, { roomId: rid, myUid });
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        const next: ChatMessage[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            roomId: rid,
            senderUid: String(x.senderUid ?? ""),
            senderName: String(x.senderName ?? ""),
            type: x.type as ChatMessage["type"],
            text: String(x.text ?? ""),
            correct: x.correct as boolean | undefined,
            createdAt: (x.createdAt as Timestamp | null) ?? null,
          };
        });
        const sig = messagesWireSignature(next);
        if (sig === messagesSigRef.current) return;
        messagesSigRef.current = sig;
        setMessages(next);
      },
      (e) => {
        if (cancelled) return;
        setWireError((e as Error).message);
        const lr = lastRoomRef.current;
        const uids = lr?.playerUids ?? null;
        logFsOpFailure({
          area: "useRoomWire.messages.onSnapshot",
          op: "listen",
          path: msgPath,
          err: e,
          roomId: rid,
          matchId: lr?.matchId ?? null,
          myUid,
          roomPlayerUids: uids,
          amInRoomPlayerUids: myUid && uids ? uids.includes(myUid) : null,
        });
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [roomId]);

  // Presence heartbeat
  useEffect(() => {
    if (!roomId || !myUid) return;
    const db = getFirebaseDb();
    const ref = doc(db, col.rooms, roomId, "presence", myUid);
    const prPath = `${col.rooms}/${roomId}/presence/${myUid}`;
    const tick = () =>
      void setDoc(ref, { lastSeen: serverTimestamp(), state: "online" }, { merge: true }).catch((err) => {
        const lr = lastRoomRef.current;
        const uids = lr?.playerUids ?? null;
        logFsOpFailure({
          area: "useRoomWire.presence.setDoc",
          op: "write",
          path: prPath,
          err,
          roomId,
          matchId: lr?.matchId ?? null,
          myUid,
          roomPlayerUids: uids,
          amInRoomPlayerUids: myUid && uids ? uids.includes(myUid) : null,
        });
      });
    void tick();
    const id = window.setInterval(() => void tick(), 15000);
    return () => window.clearInterval(id);
  }, [roomId, myUid]);

  return { room, match, messages, opponentCard, opponentUid, wireError };
}
