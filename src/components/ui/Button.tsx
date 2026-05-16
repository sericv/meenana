"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type Props = HTMLMotionProps<"button"> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-2xl font-bold select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClass = size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-3.5 text-base";

  const styles =
    variant === "primary"
      ? "btn-gloss bg-gradient-to-b from-[#FFB340] to-[#F28A28] text-white [text-shadow:0_1.5px_0_rgba(0,0,0,0.18)] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.44),0_8px_0_#d9761f,0_14px_24px_rgba(240,141,47,0.32)] hover:brightness-105 focus-visible:ring-[#ef932f]/40"
      : variant === "danger"
        ? "bg-gradient-to-b from-[#f97966] to-[#df4f3f] text-white [text-shadow:0_1.5px_0_rgba(0,0,0,0.15)] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.32),0_8px_0_#c23f30,0_14px_24px_rgba(223,79,63,0.26)] hover:brightness-105 focus-visible:ring-[#df4f3f]/40"
        : "bg-gradient-to-b from-white to-[#fff4e4] text-[#8a4f1d] border border-[#f0c888] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.92),0_6px_0_rgba(228,168,100,0.42),0_10px_20px_rgba(228,168,100,0.16)] hover:brightness-[1.02] focus-visible:ring-[#efad63]/40";

  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ y: 3, scale: 0.97 }}
      className={`${base} ${sizeClass} ${styles} ${className}`}
      {...props}
    />
  );
}
