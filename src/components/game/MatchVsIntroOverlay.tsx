"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { PlayerCosmetic } from "@/lib/profile/cosmetics";
import { normalizeCosmetic } from "@/lib/profile/cosmetics";

type Props = {
  open: boolean;
  meName: string;
  opponentName: string;
  myCosmetic?: PlayerCosmetic | null;
  opponentCosmetic?: PlayerCosmetic | null;
  myPhotoURL?: string | null;
};

/** ~2.5s cinematic VS intro — warm orange / cream, GPU-light. */
export function MatchVsIntroOverlay({
  open,
  meName,
  opponentName,
  myCosmetic,
  opponentCosmetic,
  myPhotoURL,
}: Props) {
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 11) % 100}%`,
        top: `${(i * 23 + 7) % 100}%`,
        delay: (i % 9) * 0.08,
        size: 2 + (i % 4),
        dur: 2.4 + (i % 5) * 0.35,
      })),
    [],
  );

  const me = myCosmetic ?? normalizeCosmetic(undefined);
  const opp = opponentCosmetic ?? normalizeCosmetic(undefined);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="vs-intro"
          role="presentation"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          dir="rtl"
          className="pointer-events-auto absolute inset-0 z-[58] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 40%, rgba(255,220,170,0.22) 0%, rgba(42,24,8,0.72) 55%, rgba(18,10,4,0.88) 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: "inset 0 0 120px rgba(0,0,0,0.45)",
            }}
          />

          {particles.map((p) => (
            <motion.span
              key={p.id}
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                background: p.id % 3 === 0 ? "rgba(255,200,120,0.85)" : "rgba(255,160,60,0.55)",
                boxShadow: "0 0 10px rgba(255,190,80,0.6)",
              }}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{
                opacity: [0, 0.95, 0.35, 0.9, 0],
                scale: [0.2, 1.1, 0.85, 1, 0.4],
                y: [0, -12, 4, -8, 0],
              }}
              transition={{
                duration: p.dur,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* RTL row: first item = visually right = me (matches lobby) */}
          <div className="relative z-10 flex w-full max-w-lg items-center justify-between gap-2 px-6 sm:max-w-2xl sm:px-10">
            <motion.div
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
              initial={{ opacity: 0, x: 40, scale: 0.88 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.08 }}
            >
              <motion.div
                className="relative"
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.12 }}
              >
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-3 rounded-full blur-2xl"
                  style={{ background: "rgba(255,160,40,0.45)" }}
                  animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.92, 1.05, 0.92] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative rounded-full ring-[3px] ring-[rgba(255,210,140,0.55)] ring-offset-2 ring-offset-[rgba(20,10,4,0.2)]">
                  <ProfileAvatar
                    cosmetic={me}
                    fallbackPhotoURL={myPhotoURL}
                    displayName={meName}
                    size="xl"
                    active
                    idle={false}
                  />
                </div>
              </motion.div>
              <motion.p
                className="max-w-[120px] truncate text-center text-sm font-black text-[#fff4e0] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:max-w-[160px] sm:text-base"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
              >
                {meName}
              </motion.p>
            </motion.div>

            <motion.div
              className="flex shrink-0 flex-col items-center justify-center px-1"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.28 }}
            >
              <motion.div
                className="relative flex h-16 w-16 items-center justify-center rounded-2xl sm:h-[4.5rem] sm:w-[4.5rem]"
                style={{
                  background: "linear-gradient(145deg,#FF9F0A 0%,#FF5500 100%)",
                  boxShadow:
                    "inset 0 3px 0 rgba(255,255,255,0.38), 0 0 0 2px rgba(255,220,140,0.35), 0 12px 40px rgba(255,100,0,0.55)",
                }}
                animate={{
                  scale: [1, 1.06, 1],
                  boxShadow: [
                    "inset 0 3px 0 rgba(255,255,255,0.38), 0 0 0 2px rgba(255,220,140,0.35), 0 12px 40px rgba(255,100,0,0.5)",
                    "inset 0 3px 0 rgba(255,255,255,0.38), 0 0 28px rgba(255,220,120,0.65), 0 14px 48px rgba(255,120,0,0.62)",
                    "inset 0 3px 0 rgba(255,255,255,0.38), 0 0 0 2px rgba(255,220,140,0.35), 0 12px 40px rgba(255,100,0,0.5)",
                  ],
                }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ background: "radial-gradient(circle at 40% 30%, rgba(255,255,255,0.45), transparent 55%)" }}
                  animate={{ opacity: [0.25, 0.55, 0.25] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span
                  className="relative text-2xl font-black tracking-tight text-white sm:text-3xl"
                  style={{ textShadow: "0 3px 0 rgba(0,0,0,0.22)" }}
                >
                  VS
                </span>
              </motion.div>
            </motion.div>

            <motion.div
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
              initial={{ opacity: 0, x: -40, scale: 0.88 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.08 }}
            >
              <motion.div
                className="relative"
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.12 }}
              >
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-3 rounded-full blur-2xl"
                  style={{ background: "rgba(255,180,90,0.4)" }}
                  animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.94, 1.08, 0.94] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                />
                <div className="relative rounded-full ring-[3px] ring-[rgba(255,210,140,0.55)] ring-offset-2 ring-offset-[rgba(20,10,4,0.2)]">
                  <ProfileAvatar
                    cosmetic={opp}
                    displayName={opponentName}
                    size="xl"
                    active
                    idle={false}
                  />
                </div>
              </motion.div>
              <motion.p
                className="max-w-[120px] truncate text-center text-sm font-black text-[#fff4e0] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:max-w-[160px] sm:text-base"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
              >
                {opponentName}
              </motion.p>
            </motion.div>
          </div>

          <motion.p
            className="relative z-10 mt-8 text-xs font-bold text-[#ffd9a8]/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            استعد…
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
