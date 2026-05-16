"use client";

import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { playMatchFound, resumeAudioContext } from "@/lib/audio/game-sounds";
import { matchmakingAck, matchmakingJoin, matchmakingLeave } from "@/lib/api/matchmaking-client";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col } from "@/lib/firestore/paths";
import { isFirebaseFirestoreError, logFsListenAttach, logFsOpFailure } from "@/lib/firestore/fs-op-debug";
import { DEFAULT_CATEGORY_ID } from "@/lib/game/categories";
import { MATCHMAKING_POOL_ALL } from "@/lib/game/constants";
import { usePlayerCosmetics } from "@/hooks/usePlayerCosmetics";
import { useGamePresenceReporter } from "@/hooks/useGamePresenceReporter";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { normalizeCosmetic, type PlayerCosmetic } from "@/lib/profile/cosmetics";

const DEFAULT_CATEGORY = DEFAULT_CATEGORY_ID;

/* Countdown before navigating into the room, in ms.
   Long enough for the "Match found" reveal to feel intentional and social,
   short enough to not feel like a stall. */
const MATCH_FOUND_REVEAL_MS = 2400;

/* ═══════════════════════════════════════════════════════════════════
   ROOT EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export default function RandomPlayPage() {
  return (
    <AuthGate>
      <RandomInner />
    </AuthGate>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INLINE SVG ICONS
   ═══════════════════════════════════════════════════════════════════ */
function IcoX() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M5 5l10 10M15 5L5 15" stroke="#8a3f16" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AMBIENT PAGE DECORATION
   ═══════════════════════════════════════════════════════════════════ */
function PageDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* blurred ambient blobs */}
      <motion.div
        animate={{ y: [0, -24, 0], x: [0, 12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFCB8A]/50 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -left-28 top-1/3 h-80 w-80 rounded-full bg-[#FFB574]/38 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute bottom-28 right-1/4 h-56 w-56 rounded-full bg-[#FFD9A6]/46 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 14, 0], x: [0, 8, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 3.5 }}
        className="absolute -bottom-20 left-1/3 h-60 w-60 rounded-full bg-[#FFCF8A]/36 blur-3xl"
      />

      {/* floating glyphs */}
      {([
        { char: "؟", top: "6%",  left: "4%",   delay: 0,   size: 56, tint: "rgba(176,92,255,0.11)" },
        { char: "؟", top: "27%", right: "5%",  delay: 1.4, size: 44, tint: "rgba(255,138,30,0.16)" },
        { char: "؟", top: "64%", left: "6%",   delay: 3,   size: 50, tint: "rgba(78,163,255,0.12)" },
        { char: "؟", top: "83%", right: "9%",  delay: 5,   size: 38, tint: "rgba(255,138,30,0.12)" },
        { char: "✦", top: "15%", right: "13%", delay: 0.7, size: 18, tint: "rgba(255,180,90,0.68)"  },
        { char: "✦", top: "47%", left: "17%",  delay: 2.6, size: 14, tint: "rgba(155,89,255,0.58)"  },
        { char: "✦", top: "71%", right: "19%", delay: 4.3, size: 20, tint: "rgba(78,163,255,0.54)"  },
        { char: "✦", top: "89%", left: "26%",  delay: 1.9, size: 12, tint: "rgba(255,180,90,0.58)"  },
      ] as const).map((s, i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            top: s.top,
            left: "left" in s ? s.left : undefined,
            right: "right" in s ? s.right : undefined,
            fontSize: s.size,
            color: s.tint,
            fontWeight: 900,
            userSelect: "none",
          }}
          animate={{ y: [0, -12, 0], rotate: [0, 7, 0] }}
          transition={{ duration: 6 + s.delay, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
        >
          {s.char}
        </motion.span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PLAYER FACE (cosmetics + warm glow)
   ═══════════════════════════════════════════════════════════════════ */
function MatchProfileFace({
  name,
  active,
  cosmetic,
  fallbackPhotoURL,
  size = "md",
}: {
  name: string;
  active: boolean;
  cosmetic?: PlayerCosmetic | null;
  fallbackPhotoURL?: string | null;
  size?: "md" | "lg";
}) {
  const isLg = size === "lg";
  return (
    <div className={`flex flex-col items-center ${isLg ? "gap-2" : "gap-1.5"}`}>
      <div className="relative">
        <motion.div
          aria-hidden
          animate={active ? { opacity: [0.5, 1, 0.5], scale: [0.92, 1.08, 0.92] } : { opacity: 0.35, scale: 1 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 -z-10 rounded-full blur-xl"
          style={{ background: "rgba(255,149,0,0.55)" }}
        />
        <ProfileAvatar
          cosmetic={cosmetic ?? undefined}
          fallbackPhotoURL={fallbackPhotoURL}
          displayName={name}
          size={isLg ? "lg" : "md"}
          active={active}
          idle
          showPulseDot={active}
        />
      </div>
      <p
        className={
          isLg
            ? "max-w-[96px] truncate text-center text-sm font-extrabold text-[#8a3f16] sm:max-w-[120px] sm:text-base"
            : "max-w-[72px] truncate text-center text-xs font-extrabold text-[#8a3f16] sm:max-w-[88px] sm:text-sm"
        }
      >
        {name}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MYSTERY OPPONENT (right side, before match)
   ═══════════════════════════════════════════════════════════════════ */
function OpponentSlot({ matched }: { matched: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <motion.div
          aria-hidden
          animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.9, 1.08, 0.9] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute inset-0 -z-10 rounded-full blur-xl"
          style={{ background: "rgba(255,179,0,0.35)" }}
        />
        <motion.div
          animate={matched ? {} : { rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(rgba(255,179,0,0.6) 0deg, transparent 120deg, rgba(255,122,0,0.4) 240deg, transparent 360deg)",
          }}
        />
        <div
          className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full sm:h-20 sm:w-20"
          style={{
            background: "linear-gradient(135deg,#F5E0C0 0%,#EAC898 100%)",
            boxShadow:
              "0 0 0 3px rgba(255,179,0,0.35), 0 6px 20px rgba(196,134,82,0.3)",
          }}
        >
          <svg viewBox="0 0 56 56" fill="none" className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden>
            <circle cx="28" cy="22" r="10" fill="rgba(139,100,50,0.25)" />
            <ellipse cx="28" cy="44" rx="14" ry="9" fill="rgba(139,100,50,0.2)" />
            <circle cx="24.5" cy="21" r="1.8" fill="rgba(139,100,50,0.3)" />
            <circle cx="31.5" cy="21" r="1.8" fill="rgba(139,100,50,0.3)" />
          </svg>
          <motion.div
            aria-hidden
            animate={{ opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 40% 35%, rgba(255,220,150,0.5), transparent 65%)",
            }}
          />
        </div>
        <motion.span
          animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0.4, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFB300] ring-2 ring-white text-[8px] font-black text-white"
        >
          ?
        </motion.span>
      </div>
      <p className="text-xs font-extrabold text-[#bc7a45] sm:text-sm">خصمك؟</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CENTER QUESTION MARK (heart of the screen)
   ═══════════════════════════════════════════════════════════════════ */
function CenterMystery({ active, found }: { active: boolean; found?: boolean }) {
  return (
    <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center sm:h-24 sm:w-24">
      <motion.div
        aria-hidden
        animate={active
          ? { scale: [1, 1.22, 1], opacity: [0.3, 0.08, 0.3] }
          : { scale: 1, opacity: 0.15 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full border-2 border-[#FF9F0A]/70"
      />
      <motion.div
        aria-hidden
        animate={active
          ? { scale: [1, 1.42, 1], opacity: [0.22, 0.04, 0.22] }
          : { scale: 1, opacity: 0.1 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        className="absolute inset-0 rounded-full border border-[#FF9F0A]/50"
      />
      <motion.div
        aria-hidden
        animate={active
          ? { opacity: [0.5, 1, 0.5], scale: [0.85, 1.05, 0.85] }
          : { opacity: 0.25, scale: 1 }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-2 rounded-full blur-xl"
        style={{ background: "rgba(255,159,10,0.6)" }}
      />
      <div
        className="relative z-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full sm:h-16 sm:w-16"
        style={{
          background: "linear-gradient(160deg,#FF9F0A 0%,#FF6B00 100%)",
          boxShadow:
            "inset 0 2.5px 0 rgba(255,255,255,0.45), inset 0 -5px 12px rgba(150,50,0,0.3), 0 8px 0 #be5200, 0 14px 28px rgba(255,122,0,0.5)",
        }}
      >
        <span
          className="select-none text-3xl font-black text-white sm:text-4xl"
          style={{ textShadow: "0 2px 0 rgba(0,0,0,0.22)" }}
        >
          {found ? "VS" : "؟"}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-1.5 h-2 rounded-full bg-white/40 blur-[1.5px]"
        />
      </div>

      {active && [0, 60, 120, 180, 240, 300].map((deg, i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{ position: "absolute", top: "50%", left: "50%" }}
          animate={{ rotate: [deg, deg + 360] }}
          transition={{ duration: 3.5 + i * 0.4, repeat: Infinity, ease: "linear" }}
        >
          <motion.span
            style={{
              display: "block",
              width: i % 2 === 0 ? 5 : 4,
              height: i % 2 === 0 ? 5 : 4,
              borderRadius: "50%",
              background: i % 2 === 0 ? "rgba(255,179,0,0.75)" : "rgba(255,100,0,0.6)",
              transform: `translate(-50%, -${46 + (i % 3) * 6}px)`,
            }}
            animate={{ opacity: [0.9, 0.3, 0.9] }}
            transition={{ duration: 1.6 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONNECTION DOTS between player / center / opponent
   ═══════════════════════════════════════════════════════════════════ */
function ConnectionLine({ active }: { active: boolean }) {
  const dots = [0, 1, 2];
  return (
    <div className="flex items-center gap-1.5">
      {dots.map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: active ? "#FFB300" : "rgba(196,134,82,0.35)" }}
          animate={active ? { scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] } : { scale: 1, opacity: 0.4 }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.22 }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BREATHING DOTS for status text
   ═══════════════════════════════════════════════════════════════════ */
function BreathingDots() {
  return (
    <span className="inline-flex items-end gap-[3px] pb-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-[#bc7a45]"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN INNER COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
type Phase = "idle" | "searching" | "found" | "matched";

function RandomInner() {
  const { user } = useAuth();
  const router = useRouter();
  const unsubRef = useRef<(() => void) | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks when this search session started — used to ignore stale redirect docs.
  const searchStartedAtRef = useRef<number>(0);
  // Prevents duplicate goRoom() calls if the server response and snapshot both fire.
  const handledRoomRef = useRef<string | null>(null);
  // Tracks whether we already left the queue (to make unmount idempotent).
  const leftRef = useRef<boolean>(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>("خصم جديد");
  const [opponentCosmetic, setOpponentCosmetic] = useState<PlayerCosmetic | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  const cleanupListen = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  const cleanupNav = useCallback(() => {
    if (navTimer.current) {
      clearTimeout(navTimer.current);
      navTimer.current = null;
    }
  }, []);

  // Page-unload safety: clear queue if user closes tab while waiting.
  useEffect(() => {
    const onUnload = () => {
      if (leftRef.current) return;
      // Best-effort fire-and-forget (don't block unload).
      void matchmakingLeave({ poolId: MATCHMAKING_POOL_ALL }).catch(() => undefined);
      leftRef.current = true;
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  // Component unmount: leave queue + clear listeners/timers.
  useEffect(() => {
    return () => {
      cleanupListen();
      cleanupNav();
      if (!leftRef.current) {
        leftRef.current = true;
        void matchmakingLeave({ poolId: MATCHMAKING_POOL_ALL }).catch(() => undefined);
      }
    };
  }, [cleanupListen, cleanupNav]);

  const displayName = user?.displayName || user?.email || "زائر";
  const myUid = user?.uid ?? null;
  const googleSoc = isFullAccountUser(user);
  const matchmakingActive = phase === "searching" || phase === "found" || phase === "matched";
  useGamePresenceReporter({
    uid: googleSoc ? myUid : null,
    enabled: Boolean(googleSoc && myUid),
    presence: matchmakingActive ? "matchmaking" : "online",
    roomId: null,
    resetOnUnmount: true,
  });
  const liveCosmetics = usePlayerCosmetics(myUid ? [myUid] : []);
  const myCosmetic = myUid ? liveCosmetics[myUid] : undefined;

  /* Resolve opponent profile from the freshly-created room + users collection. */
  const fetchOpponentProfile = useCallback(
    async (roomId: string, myUid: string): Promise<{ name: string; cosmetic: PlayerCosmetic }> => {
      const fallback = { name: "خصم جديد", cosmetic: normalizeCosmetic(undefined) };
      const db = getFirebaseDb();
      const roomPath = `${col.rooms}/${roomId}`;
      let snap;
      try {
        snap = await getDoc(doc(db, col.rooms, roomId));
      } catch (err) {
        if (isFirebaseFirestoreError(err)) {
          logFsOpFailure({
            area: "random.page.fetchOpponentProfile.getDoc_room",
            op: "read",
            path: roomPath,
            err,
            roomId,
            myUid,
            extra: { step: "room" },
          });
        }
        return fallback;
      }
      if (!snap.exists()) return fallback;
      const data = snap.data() as { players?: Array<{ uid?: string; displayName?: string }> };
      const other = (data.players ?? []).find((p) => p?.uid && p.uid !== myUid);
      const name = (other?.displayName ?? "").toString().trim() || "خصم جديد";
      const ouid = other?.uid;
      if (!ouid) return { name, cosmetic: normalizeCosmetic(undefined) };
      const userPath = `${col.users}/${ouid}`;
      try {
        const uSnap = await getDoc(doc(db, col.users, ouid));
        if (!uSnap.exists()) return { name, cosmetic: normalizeCosmetic(undefined) };
        const raw = uSnap.data() as Record<string, unknown>;
        return { name, cosmetic: normalizeCosmetic(raw) };
      } catch (err) {
        if (isFirebaseFirestoreError(err)) {
          logFsOpFailure({
            area: "random.page.fetchOpponentProfile.getDoc_user",
            op: "read",
            path: userPath,
            err,
            roomId,
            myUid,
            opponentUid: ouid,
            roomPlayerUids: (data.players ?? []).map((p) => String(p.uid ?? "")).filter(Boolean),
            amInRoomPlayerUids: Boolean((data.players ?? []).some((p) => p.uid === myUid)),
            extra: { step: "users", opponentName: name },
          });
        }
        return { name, cosmetic: normalizeCosmetic(undefined) };
      }
    },
    [],
  );

  /* Match-found reveal: show opponent for a moment, then navigate.
     This is the warm "Match Found" transition. */
  const enterMatchFound = useCallback(
    async (roomId: string) => {
      if (handledRoomRef.current === roomId) return;
      handledRoomRef.current = roomId;
      cleanupListen();
      resumeAudioContext();
      playMatchFound();
      setPhase("found");

      // Best-effort fetch opponent name (parallel with the reveal animation).
      if (user?.uid) {
        void fetchOpponentProfile(roomId, user.uid).then(({ name, cosmetic }) => {
          setOpponentName(name);
          setOpponentCosmetic(cosmetic);
        });
      }

      // Acknowledge the result doc now so it can't fire again on a future search.
      try {
        await matchmakingAck();
      } catch {
        // non-fatal
      }

      // Run a short visual countdown so the transition feels intentional.
      const totalMs = MATCH_FOUND_REVEAL_MS;
      const start = Date.now();
      setCountdown(Math.ceil(totalMs / 1000));
      const tick = () => {
        const elapsed = Date.now() - start;
        const remain = Math.max(0, totalMs - elapsed);
        setCountdown(Math.ceil(remain / 1000));
        if (remain <= 0) {
          setPhase("matched");
          router.replace(`/room/${roomId}`);
          return;
        }
        navTimer.current = setTimeout(tick, 200);
      };
      tick();
    },
    [cleanupListen, fetchOpponentProfile, router, user?.uid],
  );

  const startSearch = async () => {
    if (!user) return;
    setPhase("searching");
    setErr(null);
    setOpponentCosmetic(null);
    cleanupListen();
    cleanupNav();
    handledRoomRef.current = null;
    leftRef.current = false;
    searchStartedAtRef.current = Date.now();

    // Pre-flight: clear any stale redirect doc from a previous session BEFORE
    // we subscribe — this is the #1 source of "instant victory" bugs.
    try {
      await matchmakingAck();
    } catch {
      // ignore — non-fatal
    }

    // Subscribe FIRST so we never miss the server's pairing write.
    try {
      const db = getFirebaseDb();
      const resultRef = doc(db, col.matchmakingResults, user.uid);
      const resultPath = `${col.matchmakingResults}/${user.uid}`;
      logFsListenAttach("random.page.matchmakingResults", resultPath, { myUid: user.uid });
      unsubRef.current = onSnapshot(
        resultRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as {
            roomId?: unknown;
            createdAt?: { toMillis?: () => number } | undefined;
          };
          const rid = typeof data.roomId === "string" ? data.roomId : "";
          if (!rid) return;
          // Defense in depth: ignore docs created before THIS search started.
          const createdMs = data.createdAt?.toMillis?.() ?? 0;
          if (createdMs && createdMs < searchStartedAtRef.current - 500) {
            return;
          }
          void enterMatchFound(rid);
        },
        (err) => {
          if (isFirebaseFirestoreError(err)) {
            logFsOpFailure({
              area: "random.page.matchmakingResults.onSnapshot",
              op: "listen",
              path: resultPath,
              err,
              myUid: user.uid,
              extra: { note: "listener_error_callback" },
            });
          }
        },
      );
    } catch (err) {
      if (isFirebaseFirestoreError(err)) {
        logFsOpFailure({
          area: "random.page.matchmakingResults.onSnapshot_setup",
          op: "listen",
          path: `${col.matchmakingResults}/${user.uid}`,
          err,
          myUid: user.uid,
        });
      }
    }

    // Now call the join API.
    try {
      const res = await matchmakingJoin({
        poolId: MATCHMAKING_POOL_ALL,
        categoryId: DEFAULT_CATEGORY,
        displayName,
      });

      if (res.status === "matched" && res.roomId) {
        void enterMatchFound(res.roomId);
      }
      // Otherwise: stay "searching" — listener will fire when paired.
    } catch (e) {
      cleanupListen();
      setPhase("idle");
      setErr(e instanceof Error ? e.message : "تعذر البدء");
    }
  };

  const cancelSearch = async () => {
    setErr(null);
    cleanupListen();
    cleanupNav();
    try {
      await matchmakingLeave({ poolId: MATCHMAKING_POOL_ALL });
      leftRef.current = true;
    } catch {
      // ignore
    }
    setPhase("idle");
    handledRoomRef.current = null;
  };

  const isSearching = phase === "searching";
  const isFound = phase === "found";
  const isMatched = phase === "matched";
  const isActive = isSearching || isFound || isMatched;

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-full overflow-x-hidden select-none"
      style={{
        background:
          "radial-gradient(120% 70% at 50% 0%, #FFF2DF 0%, #FCEBD4 55%, #FDE7CF 100%)",
      }}
    >
      <PageDecor />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-6 lg:max-w-2xl lg:px-10">

        {/* ── Top logo ── */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="mb-1 mt-4 text-center"
        >
          <h1
            className="text-5xl font-black sm:text-6xl lg:text-7xl"
            style={{
              background: "linear-gradient(180deg,#FF9F0A 0%,#E0660A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 4px 12px rgba(224,102,10,0.4))",
            }}
          >
            مين أنا؟
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#bc7a45] sm:text-base">
            {isFound
              ? "تم العثور على خصم!"
              : isMatched
              ? "جاري الدخول إلى الغرفة…"
              : isSearching
              ? "جار البحث عن لاعب..."
              : "العب عشوائي مع لاعب حقيقي"}
          </p>
        </motion.div>

        {/* ── Main matchmaking card ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 190, damping: 22, delay: 0.1 }}
          className="relative mt-6 w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(196,134,82,0.28),0_6px_16px_rgba(196,134,82,0.12)] backdrop-blur-sm"
        >
          {/* warm inner top glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "rgba(255,175,60,0.18)" }}
          />

          <div className="px-5 py-8 sm:px-7 sm:py-10">

            {/* ── Matchmaking visual row ── */}
            <AnimatePresence mode="wait" initial={false}>
              {isFound || isMatched ? (
                /* ── Found / matched: VS reveal ── */
                <motion.div
                  key="found-row"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 240, damping: 22 }}
                  className="flex items-center justify-center gap-3 sm:gap-5"
                >
                  <MatchProfileFace name={displayName} active cosmetic={myCosmetic} fallbackPhotoURL={user?.photoURL} size="lg" />
                  <ConnectionLine active />
                  <CenterMystery active found />
                  <ConnectionLine active />
                  <MatchProfileFace name={opponentName} active cosmetic={opponentCosmetic} size="lg" />
                </motion.div>
              ) : (
                /* ── Idle / searching: mystery opponent ── */
                <motion.div
                  key="search-row"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 220, damping: 22 }}
                  className="flex items-center justify-center gap-3 sm:gap-5"
                >
                  <MatchProfileFace name={displayName} active={isActive} cosmetic={myCosmetic} fallbackPhotoURL={user?.photoURL} />
                  <ConnectionLine active={isActive} />
                  <CenterMystery active={isActive} />
                  <ConnectionLine active={isActive} />
                  <OpponentSlot matched={false} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Status text ── */}
            <div className="mt-7 text-center">
              <AnimatePresence mode="wait">
                {isFound ? (
                  <motion.div
                    key="found-status"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-1.5"
                  >
                    <p className="text-lg font-black text-[#8a3f16] sm:text-xl">
                      🎉 تم العثور على خصم!
                    </p>
                    <p className="text-sm font-bold text-[#bc7a45] sm:text-base">
                      <span className="text-[#8a3f16]">{opponentName}</span>
                      <span className="mx-1">جاهز للعب</span>
                    </p>
                    {countdown > 0 ? (
                      <p className="pt-1 text-xs font-bold text-[#bc7a45]">
                        تبدأ المباراة خلال {countdown}…
                      </p>
                    ) : (
                      <p className="pt-1 text-xs font-bold text-[#bc7a45]">جاري الدخول…</p>
                    )}
                  </motion.div>
                ) : isMatched ? (
                  <motion.p
                    key="matched"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-base font-extrabold text-[#8a3f16] sm:text-lg"
                  >
                    🎉 جاري الدخول إلى الغرفة…
                  </motion.p>
                ) : isSearching ? (
                  <motion.p
                    key="searching"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-[#bc7a45] sm:text-base"
                  >
                    <span>جاري البحث عن خصم مناسب</span>
                    <BreathingDots />
                  </motion.p>
                ) : (
                  <motion.p
                    key="idle"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-semibold text-[#bc7a45] sm:text-base"
                  >
                    اضغط للبدء والبحث عن خصم
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* ── Error ── */}
            <AnimatePresence>
              {err && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 rounded-2xl border border-[#fca5a5] bg-[#fee2e2] px-4 py-3 text-center text-sm font-bold text-[#7f1d1d]"
                >
                  {err}
                </motion.p>
              )}
            </AnimatePresence>

            {/* ── Primary / Cancel CTA ── */}
            <div className="mt-7 space-y-3">
              <AnimatePresence mode="wait">
                {!isActive ? (
                  /* ── Start search button ── */
                  <motion.div
                    key="start"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="relative"
                  >
                    {/* bloom */}
                    <motion.div
                      aria-hidden
                      animate={{ opacity: [0.55, 1, 0.55], scale: [0.95, 1.06, 0.95] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 -z-10 rounded-[26px] blur-2xl"
                      style={{
                        background:
                          "radial-gradient(closest-side,rgba(255,138,30,0.65),transparent 70%)",
                      }}
                    />
                    <motion.button
                      type="button"
                      onClick={() => void startSearch()}
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ y: 5, scale: 0.97 }}
                      className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[24px] py-[18px] text-2xl font-black text-white sm:text-3xl"
                      style={{
                        background: "linear-gradient(180deg,#FF9F0A 0%,#FF7A00 100%)",
                        boxShadow:
                          "inset 0 2.5px 0 rgba(255,255,255,0.52), inset 0 -7px 16px rgba(150,50,0,0.38), 0 13px 0 #be5200, 0 24px 40px rgba(255,122,0,0.58)",
                      }}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-8 top-2 h-3 rounded-full bg-white/35 blur-[2.5px]"
                      />
                      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden>
                        <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2.4" />
                        <path d="M16.5 16.5L21 21" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                      <span style={{ textShadow: "0 2px 0 rgba(0,0,0,0.22)" }}>
                        ابحث عن خصم
                      </span>
                    </motion.button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* ── Cancel search button — only during 'searching' phase ── */}
              <AnimatePresence>
                {isSearching && (
                  <motion.div
                    key="cancel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    <motion.button
                      type="button"
                      onClick={() => void cancelSearch()}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ y: 3, scale: 0.98 }}
                      className="flex w-full items-center justify-center gap-2 rounded-[24px] py-4 text-base font-extrabold text-[#8a3f16]"
                      style={{
                        background: "linear-gradient(180deg,#FFFFFF 0%,#FFF4E4 100%)",
                        boxShadow:
                          "inset 0 1.5px 0 rgba(255,255,255,0.9), 0 8px 0 rgba(196,134,82,0.28), 0 14px 28px rgba(196,134,82,0.18)",
                      }}
                    >
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full"
                        style={{ background: "rgba(138,63,22,0.1)" }}
                      >
                        <IcoX />
                      </span>
                      إلغاء البحث
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Found / Matched: subtle disabled placeholder ── */}
              <AnimatePresence>
                {(isFound || isMatched) && (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] py-4 text-sm font-extrabold text-[#bc7a45]"
                    style={{
                      background: "linear-gradient(180deg,#FFFCF4 0%,#FFF1DE 100%)",
                      boxShadow: "inset 0 0 0 1.5px rgba(244,196,141,0.55)",
                    }}
                  >
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                      className="grid h-5 w-5 place-items-center"
                      aria-hidden
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                        <circle cx="12" cy="12" r="9" stroke="rgba(196,134,82,0.30)" strokeWidth="2.5" />
                        <path d="M21 12a9 9 0 00-9-9" stroke="#FF9F0A" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </motion.span>
                    جاري ربط اللاعبين…
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Back home link — hidden during found/matched to avoid mid-transition bail ── */}
        {!(isFound || isMatched) && (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-5 w-full py-2 text-sm font-semibold text-[#bc7a45] transition-colors hover:text-[#8a3f16]"
          >
            الرئيسية
          </button>
        )}
      </div>
    </div>
  );
}
