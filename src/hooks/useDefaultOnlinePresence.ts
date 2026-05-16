"use client";

import { useGamePresenceReporter } from "@/hooks/useGamePresenceReporter";
import type { GamePresence } from "@/lib/social/presence-constants";

export function useDefaultOnlinePresence(uid: string | null, google: boolean): void {
  useGamePresenceReporter({
    uid,
    enabled: Boolean(uid && google),
    presence: "online" as GamePresence,
    roomId: null,
    resetOnUnmount: true,
  });
}
