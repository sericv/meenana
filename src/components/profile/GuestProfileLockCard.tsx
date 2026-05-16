"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

/** Premium inline prompt for anonymous / non-full-account users on the profile screen. */
export function GuestProfileLockCard() {
  const router = useRouter();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-white/90 bg-gradient-to-br from-[#fffdfb] via-[#fff5e8] to-[#ffe8cf] p-6 text-center shadow-[0_18px_44px_rgba(196,134,82,0.28)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          background:
            "radial-gradient(80% 60% at 20% 0%, rgba(255,200,120,0.35), transparent 55%), radial-gradient(70% 50% at 100% 100%, rgba(255,180,200,0.22), transparent 50%)",
        }}
      />
      <div className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-inner ring-1 ring-[#f4d4b0]">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#c2530c]" fill="none" aria-hidden>
          <path
            d="M12 11c2.21 0 4-1.34 4-3s-1.79-3-4-3-4 1.34-4 3 1.79 3 4 3z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M5 20v-1c0-2.5 3.13-4 7-4s7 1.5 7 4v1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="relative text-[15px] font-extrabold leading-relaxed text-[#5e3011]">
        سجل دخول لحفظ شخصيتك وإظهار هويتك داخل اللعبة
      </p>
      <p className="relative mt-2 text-xs font-semibold leading-relaxed text-[#a16231]">
        ارفع صورتك، اختر إطارك المتحرك، وظهر بنفس المظهر في الغرف والأصدقاء والدردشة.
      </p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => router.push(`/login?next=${encodeURIComponent("/profile")}`)}
        className="relative mt-5 w-full rounded-2xl py-3.5 text-base font-black text-white"
        style={{
          background: "linear-gradient(180deg,#FF9F0A 0%,#FF6B00 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), 0 7px 0 #be5200, 0 14px 28px rgba(255,107,0,0.32)",
        }}
      >
        تسجيل الدخول
      </motion.button>
    </motion.section>
  );
}
