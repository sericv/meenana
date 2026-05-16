"use client";

import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full min-h-[48px] rounded-2xl border border-[#f0c490] bg-gradient-to-b from-[#fffdf9] to-[#fff8ee] px-4 py-3 text-base text-[#6b3a13] placeholder:text-[#cfa070] outline-none transition-all duration-200 shadow-[inset_0_1.5px_4px_rgba(196,134,82,0.07)] focus:border-[#ef9b42] focus:ring-4 focus:ring-[#ffd6a8]/45 focus:bg-white focus:shadow-[inset_0_1.5px_4px_rgba(196,134,82,0.04)] ${className}`}
      {...props}
    />
  );
}
