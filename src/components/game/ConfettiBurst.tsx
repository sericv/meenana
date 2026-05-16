"use client";

import { motion } from "framer-motion";

const COLORS = ["#f97316", "#fbbf24", "#fb923c", "#fde68a", "#fff", "#fca5a5", "#86efac"];

// 28 particles instead of 42 — visually indistinguishable but 33% cheaper.
// Each particle uses will-change:transform so the browser can promote it to
// its own compositor layer and skip main-thread paint on every frame.
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: (i % 8) * 0.05,
  dur: 2.2 + (i % 5) * 0.14,
  rot: (i * 53) % 360,
  color: COLORS[i % COLORS.length],
  xFrames: [(i % 3) * 14 - 14, ((i + 2) % 5) * 20 - 26] as [number, number],
}));

export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block h-2 w-2 rounded-sm"
          style={{
            left: p.left,
            backgroundColor: p.color,
            // Promote every particle to its own GPU layer up-front so the
            // browser doesn't have to figure it out mid-animation.
            willChange: "transform, opacity",
          }}
          initial={{ y: "-10%", opacity: 1, rotate: p.rot }}
          animate={{
            y: "110vh",
            opacity: [1, 1, 0.85, 0],
            rotate: p.rot + 300,
            x: p.xFrames,
          }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
