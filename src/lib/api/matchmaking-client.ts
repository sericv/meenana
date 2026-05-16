"use client";

import { postGame } from "@/lib/api/game-client";

export async function matchmakingJoin(body: {
  poolId?: string;
  categoryId?: string;
  displayName?: string;
}) {
  return postGame("/api/matchmaking/join", body as Record<string, unknown>) as Promise<{
    ok: true;
    status: string;
    roomId?: string;
  }>;
}

export async function matchmakingLeave(body: { poolId?: string }) {
  return postGame("/api/matchmaking/leave", body);
}

export async function matchmakingAck() {
  return postGame("/api/matchmaking/ack", {});
}
