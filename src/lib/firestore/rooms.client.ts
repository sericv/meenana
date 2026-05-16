"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { logFsOpFailure, isFirebaseFirestoreError } from "@/lib/firestore/fs-op-debug";
import {
  ANSWER_PHASE_SECONDS,
  QUESTION_PHASE_SECONDS,
} from "@/lib/game/constants";
import { generateRoomCode } from "@/lib/game/room-code";
import { col } from "@/lib/firestore/paths";
import type { RoomPlayer } from "@/types";

function db(): Firestore {
  return getFirebaseDb();
}

/** Synthetic uid for a bot opponent. Stable per-room so realtime sync works. */
export function makeBotUid(seed: string): string {
  return `bot:${seed}`;
}

function baseRoomFields(args: {
  uid: string;
  displayName: string;
  categoryId: string;
  tutorial: boolean;
  openJoin: boolean;
  questionTimerSec?: number;
  answerTimerSec?: number;
  voiceMode?: boolean;
  customCardsEnabled?: boolean;
  vsBot?: boolean;
  botUid?: string;
}) {
  const code = generateRoomCode();
  const now = serverTimestamp();
  const qSec = args.questionTimerSec ?? QUESTION_PHASE_SECONDS;
  const aSec = args.answerTimerSec ?? ANSWER_PHASE_SECONDS;

  const me: RoomPlayer = {
    uid: args.uid,
    displayName: args.displayName,
    ready: false,
    joinedAt: null,
  };
  const players: RoomPlayer[] = [me];
  const playerUids: string[] = [args.uid];
  const playerJoinedAt: Record<string, unknown> = { [args.uid]: now };

  if (args.vsBot && args.botUid) {
    const bot: RoomPlayer = {
      uid: args.botUid,
      displayName: "البوت",
      ready: true,
      joinedAt: null,
    };
    players.push(bot);
    playerUids.push(args.botUid);
    playerJoinedAt[args.botUid] = now;
  }

  return {
    code,
    hostUid: args.uid,
    playerUids,
    players,
    playerJoinedAt,
    status: "lobby" as const,
    categoryId: args.categoryId,
    tutorial: args.tutorial,
    matchId: null,
    openJoin: args.openJoin && !args.vsBot,
    voiceMode: args.voiceMode ?? false,
    customCardsEnabled: Boolean(args.customCardsEnabled),
    customOpponentSelections: {},
    customOpponentCardAssigned: {},
    questionTimerSec: qSec,
    answerTimerSec: aSec,
    vsBot: Boolean(args.vsBot),
    botUid: args.vsBot ? args.botUid ?? null : null,
    createdAt: now,
    lastActivityAt: now,
    cleanupAt: null,
  };
}

export async function createPrivateRoom(args: {
  uid: string;
  displayName: string;
  categoryId: string;
  questionTimerSec?: number;
  answerTimerSec?: number;
  voiceMode?: boolean;
  customCardsEnabled?: boolean;
  vsBot?: boolean;
}): Promise<{ roomId: string; code: string }> {
  const roomRef = doc(collection(db(), col.rooms));
  // Bot uid is bound to the room id so subscriptions key cleanly.
  const botUid = args.vsBot ? makeBotUid(roomRef.id) : undefined;
  const fields = baseRoomFields({ ...args, tutorial: false, openJoin: false, botUid });
  const codeRef = doc(db(), col.roomCodes, fields.code);
  const uids = (fields.playerUids as string[]) ?? [];
  const roomPath = `${col.rooms}/${roomRef.id}`;
  const codePath = `${col.roomCodes}/${fields.code}`;

  // Two sequential writes (not one batch): security rules evaluate each write in isolation.
  // `roomCodes` create requires `exists(/rooms/{roomId})`, which is false for a room doc
  // that only exists in the same uncommitted batch as the code doc.
  try {
    await setDoc(roomRef, fields);
  } catch (err) {
    logFsOpFailure({
      area: "rooms.client.createPrivateRoom.setDoc_room",
      op: "write",
      path: roomPath,
      err,
      roomId: roomRef.id,
      myUid: args.uid,
      roomPlayerUids: uids,
      amInRoomPlayerUids: uids.includes(args.uid),
      extra: { roomCode: fields.code, vsBot: Boolean(args.vsBot), step: "room_doc" },
    });
    throw err;
  }

  try {
    await setDoc(codeRef, { roomId: roomRef.id });
  } catch (err) {
    logFsOpFailure({
      area: "rooms.client.createPrivateRoom.setDoc_roomCodes",
      op: "write",
      path: codePath,
      err,
      roomId: roomRef.id,
      myUid: args.uid,
      roomPlayerUids: uids,
      amInRoomPlayerUids: uids.includes(args.uid),
      extra: { roomCode: fields.code, vsBot: Boolean(args.vsBot), step: "room_codes_after_room" },
    });
    try {
      await deleteDoc(roomRef);
    } catch {
      // best-effort rollback — room exists without join code until host cleans up
    }
    throw err;
  }

  return { roomId: roomRef.id, code: fields.code };
}

export async function createOpenLobbyRoom(args: {
  uid: string;
  displayName: string;
  categoryId: string;
}): Promise<{ roomId: string; code: string }> {
  const roomRef = doc(collection(db(), col.rooms));
  const fields = baseRoomFields({ ...args, tutorial: false, openJoin: true });
  const codeRef = doc(db(), col.roomCodes, fields.code);
  const uids = (fields.playerUids as string[]) ?? [];
  const roomPath = `${col.rooms}/${roomRef.id}`;
  const codePath = `${col.roomCodes}/${fields.code}`;

  try {
    await setDoc(roomRef, fields);
  } catch (err) {
    logFsOpFailure({
      area: "rooms.client.createOpenLobbyRoom.setDoc_room",
      op: "write",
      path: roomPath,
      err,
      roomId: roomRef.id,
      myUid: args.uid,
      roomPlayerUids: uids,
      amInRoomPlayerUids: uids.includes(args.uid),
      extra: { roomCode: fields.code, openJoin: true, step: "room_doc" },
    });
    throw err;
  }

  try {
    await setDoc(codeRef, { roomId: roomRef.id });
  } catch (err) {
    logFsOpFailure({
      area: "rooms.client.createOpenLobbyRoom.setDoc_roomCodes",
      op: "write",
      path: codePath,
      err,
      roomId: roomRef.id,
      myUid: args.uid,
      roomPlayerUids: uids,
      amInRoomPlayerUids: uids.includes(args.uid),
      extra: { roomCode: fields.code, openJoin: true, step: "room_codes_after_room" },
    });
    try {
      await deleteDoc(roomRef);
    } catch {
      // best-effort rollback
    }
    throw err;
  }

  return { roomId: roomRef.id, code: fields.code };
}

export async function joinRoomByCode(args: {
  code: string;
  uid: string;
  displayName: string;
}): Promise<{ roomId: string }> {
  const norm = args.code.trim().toUpperCase();
  const codePath = `${col.roomCodes}/${norm}`;
  let codeSnap;
  try {
    codeSnap = await getDoc(doc(db(), col.roomCodes, norm));
  } catch (err) {
    if (isFirebaseFirestoreError(err)) {
      logFsOpFailure({
        area: "rooms.client.joinRoomByCode.getDoc",
        op: "read",
        path: codePath,
        err,
        myUid: args.uid,
        extra: { codeEntered: norm },
      });
    }
    throw err;
  }
  if (!codeSnap.exists()) throw new Error("الرمز غير صالح");
  const roomId = String(codeSnap.data().roomId ?? "");
  if (!roomId) throw new Error("الرمز غير صالح");

  try {
    await runTransaction(db(), async (tx) => {
      const roomRef = doc(db(), col.rooms, roomId);
      const rs = await tx.get(roomRef);
      if (!rs.exists()) throw new Error("الغرفة غير موجودة");
      const r = rs.data();
      const uids = (r.playerUids as string[]) ?? [];
      if (uids.includes(args.uid)) return;
      if (uids.length >= 2) throw new Error("الغرفة ممتلئة");
      if (r.status !== "lobby") throw new Error("لا يمكن الانضمام الآن");
      const players = (r.players as RoomPlayer[]) ?? [];
      const nextPlayers: RoomPlayer[] = [
        ...players,
        {
          uid: args.uid,
          displayName: args.displayName,
          ready: false,
          joinedAt: null,
        },
      ];
      tx.update(roomRef, {
        playerUids: [...uids, args.uid],
        players: nextPlayers,
        [`playerJoinedAt.${args.uid}`]: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (isFirebaseFirestoreError(err)) {
      logFsOpFailure({
        area: "rooms.client.joinRoomByCode.runTransaction",
        op: "transaction",
        path: `${col.rooms}/${roomId}`,
        err,
        roomId,
        myUid: args.uid,
        extra: { roomCodesPath: codePath },
      });
    }
    throw err;
  }

  return { roomId };
}

export async function setPlayerReady(roomId: string, uid: string, ready: boolean) {
  try {
    await runTransaction(db(), async (tx) => {
      const roomRef = doc(db(), col.rooms, roomId);
      const rs = await tx.get(roomRef);
      if (!rs.exists()) throw new Error("ROOM_GONE");
      const players = (rs.data().players as RoomPlayer[]) ?? [];
      const next = players.map((p) => (p.uid === uid ? { ...p, ready } : p));
      tx.update(roomRef, { players: next, lastActivityAt: serverTimestamp() });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ROOM_GONE") throw err;
    if (isFirebaseFirestoreError(err)) {
      logFsOpFailure({
        area: "rooms.client.setPlayerReady.runTransaction",
        op: "transaction",
        path: `${col.rooms}/${roomId}`,
        err,
        roomId,
        myUid: uid,
        extra: { ready },
      });
    }
    throw err;
  }
}

export async function tryJoinOpenRoom(args: {
  roomId: string;
  uid: string;
  displayName: string;
}): Promise<void> {
  try {
    await runTransaction(db(), async (tx) => {
      const roomRef = doc(db(), col.rooms, args.roomId);
      const rs = await tx.get(roomRef);
      if (!rs.exists()) throw new Error("ROOM_GONE");
      const r = rs.data();
      if (r.openJoin !== true) throw new Error("ROOM_NOT_OPEN");
      const uids = (r.playerUids as string[]) ?? [];
      if (uids.includes(args.uid)) return;
      if (uids.length >= 2) throw new Error("ROOM_FULL");
      const players = (r.players as RoomPlayer[]) ?? [];
      const nextPlayers: RoomPlayer[] = [
        ...players,
        {
          uid: args.uid,
          displayName: args.displayName,
          ready: false,
          joinedAt: null,
        },
      ];
      tx.update(roomRef, {
        playerUids: [...uids, args.uid],
        players: nextPlayers,
        openJoin: false,
        [`playerJoinedAt.${args.uid}`]: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (isFirebaseFirestoreError(err)) {
      logFsOpFailure({
        area: "rooms.client.tryJoinOpenRoom.runTransaction",
        op: "transaction",
        path: `${col.rooms}/${args.roomId}`,
        err,
        roomId: args.roomId,
        myUid: args.uid,
      });
    }
    throw err;
  }
}
