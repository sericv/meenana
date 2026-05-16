"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Density = "comfortable" | "compact";

const RING: Record<Density, { dim: number; r: number; stroke: number }> = {
  comfortable: { dim: 124, r: 52, stroke: 5.5 },
  compact: { dim: 88, r: 36, stroke: 4.5 },
};

/** Countdown ring around an avatar — active player gets a live arc + layered glow. */
export function AvatarTurnRing({
  showTimer,
  emphasize,
  secLeft,
  maxSec,
  density = "comfortable",
  children,
}: {
  showTimer: boolean;
  emphasize: boolean;
  secLeft: number | null;
  maxSec: number;
  density?: Density;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const { dim, r, stroke } = RING[density];
  const cx = dim / 2;
  const circumference = 2 * Math.PI * r;
  const safeSec = secLeft ?? 0;
  const hasCountdown = showTimer && secLeft !== null && maxSec > 0;
  const pct = hasCountdown ? Math.max(0, Math.min(1, safeSec / maxSec)) : 1;
  const dash = circumference * pct;
  const urgent = hasCountdown && safeSec <= 5;

  const trackStroke = emphasize
    ? "rgba(255,255,255,0.45)"
    : "rgba(244,196,141,0.40)";

  const progressStroke = urgent
    ? "#ef4444"
    : emphasize
    ? "rgba(255,255,255,0.92)"
    : "rgba(200,150,100,0.45)";

  // Outer decorative ring color when active
  const outerRingColor = urgent
    ? "rgba(239,68,68,0.18)"
    : emphasize
    ? "rgba(255,159,10,0.18)"
    : "transparent";

  const ring = (
    <svg
      className="pointer-events-none absolute inset-0 -rotate-90"
      width={dim}
      height={dim}
      viewBox={`0 0 ${dim} ${dim}`}
      aria-hidden
    >
      {/* Outer decorative track */}
      {emphasize && (
        <circle
          cx={cx}
          cy={cx}
          r={r + stroke + 2}
          fill="none"
          stroke={outerRingColor}
          strokeWidth={3}
        />
      )}
      {/* Base track */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={trackStroke}
        strokeWidth={stroke}
      />
      {/* Progress arc */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={progressStroke}
        strokeWidth={stroke}
        strokeDasharray={
          hasCountdown ? `${dash} ${circumference}` : `${circumference} 0`
        }
        strokeLinecap="round"
        style={{
          transition: "stroke-dasharray 0.2s linear, stroke 0.35s ease",
          filter: emphasize
            ? urgent
              ? "drop-shadow(0 0 4px rgba(239,68,68,0.7))"
              : "drop-shadow(0 0 5px rgba(255,210,100,0.65))"
            : "none",
        }}
        opacity={hasCountdown || emphasize ? 1 : 0.5}
      />
    </svg>
  );

  const glowPad = density === "compact" ? "-inset-1.5" : "-inset-2.5";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: dim, height: dim }}
    >
      {/* Primary glow blob */}
      {emphasize && !reduced ? (
        <motion.div
          aria-hidden
          animate={{
            opacity: [0.3, 0.72, 0.3],
            scale: [0.9, 1.08, 0.9],
          }}
          transition={{
            duration: urgent ? 0.75 : 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`absolute ${glowPad} rounded-full blur-xl`}
          style={{
            background: urgent
              ? "rgba(239,68,68,0.50)"
              : "rgba(255,149,0,0.48)",
          }}
        />
      ) : emphasize ? (
        <div
          aria-hidden
          className={`absolute ${glowPad} rounded-full opacity-45 blur-xl`}
          style={{
            background: urgent
              ? "rgba(239,68,68,0.42)"
              : "rgba(255,149,0,0.40)",
          }}
        />
      ) : null}

      {/* Secondary inner shimmer when active (reduced only shows a static ring) */}
      {emphasize && !reduced && !urgent && (
        <motion.div
          aria-hidden
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute inset-1 rounded-full blur-md"
          style={{ background: "rgba(255,200,80,0.30)" }}
        />
      )}

      {ring}
      <div className="relative z-[1] flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
