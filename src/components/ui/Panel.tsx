"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children" | "className">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[2rem] border border-[#f4cfa8]/65 bg-gradient-to-b from-white to-[#fffdf9] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_24px_56px_rgba(187,117,43,0.18),0_6px_18px_rgba(187,117,43,0.10)] backdrop-blur-sm ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
