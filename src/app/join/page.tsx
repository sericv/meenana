"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDefaultOnlinePresence } from "@/hooks/useDefaultOnlinePresence";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { joinRoomByCode } from "@/lib/firestore/rooms.client";

/* ─── inline SVG icons ──────────────────────────────────────────── */
function IcoArrowBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M14 18l-6-6 6-6"
        stroke="#5e3011"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IcoArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M10 6l6 6-6 6"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IcoShield() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        d="M10 2L3 5.5v4.7c0 3.5 2.9 6.7 7 7.8 4.1-1.1 7-4.3 7-7.8V5.5L10 2z"
        stroke="#bc7a45"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 10l2 2 4-4"
        stroke="#bc7a45"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IcoZap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <polygon
        points="13,2 3,14 12,14 11,22 21,10 12,10"
        stroke="#FF9500"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="rgba(255,149,0,0.15)"
      />
    </svg>
  );
}

function IcoLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <rect x="3" y="11" width="18" height="12" rx="3" stroke="#FF9500" strokeWidth="1.8" fill="rgba(255,149,0,0.15)" />
      <path
        d="M7 11V7a5 5 0 0110 0v4"
        stroke="#FF9500"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoLive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="rgba(255,149,0,0.15)" stroke="#FF9500" strokeWidth="1.8" />
      <path d="M4.93 4.93a10 10 0 000 14.14" stroke="#FF9500" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.07 4.93a10 10 0 010 14.14" stroke="#FF9500" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IcoSpinner() {
  return (
    <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity=".3" strokeWidth="2.5" />
      <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ─── feature card data ─────────────────────────────────────────── */
const FEATURES = [
  { icon: <IcoZap />,  label: "لعب سريع"       },
  { icon: <IcoLock />, label: "غرف خاصة"        },
  { icon: <IcoLive />, label: "مباريات مباشرة"   },
] as const;

/* ─── ambient background decoration ────────────────────────────── */
function PageDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* blurred blobs */}
      <motion.div
        animate={{ y: [0, -22, 0], x: [0, 10, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#FFCC8F]/50 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[#FFB876]/40 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute bottom-24 right-1/4 h-52 w-52 rounded-full bg-[#FFD9A8]/48 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 12, 0], x: [0, 8, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-[#FFCF8B]/38 blur-3xl"
      />

      {/* floating glyphs */}
      {([
        { char: "؟", top: "7%",  left: "4%",   delay: 0,   size: 54, tint: "rgba(176,92,255,0.12)" },
        { char: "؟", top: "28%", right: "5%",  delay: 1.4, size: 42, tint: "rgba(255,138,30,0.17)" },
        { char: "؟", top: "65%", left: "7%",   delay: 3.2, size: 48, tint: "rgba(78,163,255,0.13)" },
        { char: "؟", top: "82%", right: "10%", delay: 5,   size: 36, tint: "rgba(255,138,30,0.13)" },
        { char: "✦", top: "16%", right: "14%", delay: 0.6, size: 18, tint: "rgba(255,180,90,0.7)"  },
        { char: "✦", top: "48%", left: "18%",  delay: 2.6, size: 14, tint: "rgba(155,89,255,0.6)"  },
        { char: "✦", top: "72%", right: "20%", delay: 4.2, size: 20, tint: "rgba(78,163,255,0.55)" },
        { char: "✦", top: "90%", left: "28%",  delay: 1.8, size: 12, tint: "rgba(255,180,90,0.6)"  },
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

/* ─── root export ───────────────────────────────────────────────── */
export default function JoinPage() {
  return (
    <AuthGate>
      <JoinInner />
    </AuthGate>
  );
}

/* ─── main screen ───────────────────────────────────────────────── */
function JoinInner() {
  const { user } = useAuth();
  useDefaultOnlinePresence(user?.uid ?? null, isFullAccountUser(user));
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      const { roomId } = await joinRoomByCode({
        code,
        uid: user.uid,
        displayName: user.displayName || user.email || "زائر",
      });
      router.push(`/room/${roomId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذر الانضمام");
    } finally {
      setBusy(false);
    }
  };

  const canJoin = !busy && code.trim().length >= 4;

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-full overflow-x-hidden select-none"
      style={{
        background:
          "radial-gradient(120% 70% at 50% 0%, #FFF1DF 0%, #FCE8D2 55%, #FFEFD8 100%)",
      }}
    >
      <PageDecor />

      {/* ── scroll container ── */}
      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-6 lg:max-w-2xl lg:px-10">

        {/* ── Back button ── */}
        <header className="flex items-center pb-5 pt-1">
          <motion.button
            type="button"
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.08, x: 2 }}
            whileTap={{ scale: 0.92 }}
            aria-label="رجوع"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_6px_20px_rgba(196,134,82,0.28)] ring-1 ring-[#f4d4b0]"
          >
            <IcoArrowBack />
          </motion.button>
        </header>

        {/* ── Hero title ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="mb-2 text-center"
        >
          <h1
            className="text-4xl font-black sm:text-5xl lg:text-6xl"
            style={{
              background: "linear-gradient(180deg,#FF9F0A 0%,#E0660A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 4px 10px rgba(224,102,10,0.38))",
            }}
          >
            دخول لغرفة
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#bc7a45] sm:text-base">
            ادخل رمز الغرفة وابدأ اللعب
          </p>
        </motion.div>

        {/* ── Super card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.08 }}
          className="relative mt-5 overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(196,134,82,0.28),0_6px_16px_rgba(196,134,82,0.12)] backdrop-blur-sm"
        >
          {/* warm inner top glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "rgba(255,175,60,0.18)" }}
          />

          <div className="px-5 py-7 sm:px-7 sm:py-8">
            {/* ── Hero input ── */}
            <div className="relative" onClick={() => inputRef.current?.focus()}>
              {/* orange focus ring bloom */}
              <motion.div
                aria-hidden
                animate={{ opacity: code.length > 0 ? [0.5, 0.9, 0.5] : 0.3, scale: code.length > 0 ? [0.97, 1.03, 0.97] : 1 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute inset-0 -z-10 rounded-[1.4rem] blur-2xl"
                style={{ background: "radial-gradient(closest-side,rgba(255,138,30,0.35),transparent 75%)" }}
              />

              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                  setErr(null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && canJoin) void submit(); }}
                placeholder="ABC123"
                maxLength={6}
                className="w-full rounded-[1.4rem] border-2 bg-[#FFF8EE] text-center font-black tracking-[0.22em] text-[#5e3011] outline-none transition-all placeholder:text-[#d5aa80] focus:border-[#FF9F0A] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,159,10,0.18),inset_0_2px_0_rgba(255,255,255,0.7)]"
                style={{
                  fontSize: "clamp(2rem, 8vw, 3rem)",
                  height: "clamp(72px, 16vw, 96px)",
                  borderColor: err ? "#e05252" : "rgba(244,196,141,0.8)",
                  boxShadow: err
                    ? "0 0 0 3px rgba(224,82,82,0.14), inset 0 2px 0 rgba(255,255,255,0.6)"
                    : "0 6px 20px rgba(196,134,82,0.14), inset 0 2px 0 rgba(255,255,255,0.7)",
                }}
              />

              {/* gloss streak */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-10 top-2.5 h-2.5 rounded-full bg-white/45 blur-[2px]"
              />
            </div>

            {/* ── Helper / error line ── */}
            <div className="mt-3 flex min-h-[1.5rem] items-center justify-center gap-1.5">
              <AnimatePresence mode="wait">
                {err ? (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-bold text-[#c74d3d]"
                  >
                    {err}
                  </motion.p>
                ) : (
                  <motion.span
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#bc7a45]"
                  >
                    <IcoShield />
                    أدخل الرمز المكون من 6 خانات
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* ── Join CTA button ── */}
            <div className="relative mt-5">
              {/* pulsing bloom */}
              <motion.div
                aria-hidden
                animate={{ opacity: [0.55, 1, 0.55], scale: [0.95, 1.06, 0.95] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 -z-10 rounded-[26px] blur-2xl"
                style={{ background: "radial-gradient(closest-side,rgba(255,138,30,0.65),transparent 70%)" }}
              />
              <motion.button
                type="button"
                disabled={!canJoin}
                onClick={() => void submit()}
                whileHover={canJoin ? { y: -3, scale: 1.02 } : {}}
                whileTap={canJoin ? { y: 5, scale: 0.97 } : {}}
                className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[24px] py-[18px] text-2xl font-black text-white transition-opacity disabled:opacity-50 sm:text-3xl"
                style={{
                  background: "linear-gradient(180deg,#FFB300 0%,#FF7A00 100%)",
                  boxShadow: canJoin
                    ? "inset 0 2.5px 0 rgba(255,255,255,0.52), inset 0 -7px 16px rgba(150,50,0,0.38), 0 13px 0 #be5200, 0 24px 40px rgba(255,122,0,0.58)"
                    : "inset 0 2px 0 rgba(255,255,255,0.3), 0 8px 0 #be5200",
                }}
              >
                {/* gloss streak */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-8 top-2 h-3 rounded-full bg-white/35 blur-[2.5px]"
                />
                {busy ? (
                  <IcoSpinner />
                ) : (
                  <IcoArrowRight />
                )}
                <span style={{ textShadow: "0 2px 0 rgba(0,0,0,0.22)" }}>
                  {busy ? "جاري الانضمام…" : "دخول"}
                </span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Feature cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.22 }}
          className="mt-6 grid grid-cols-3 gap-3"
        >
          {FEATURES.map(({ icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24, delay: 0.28 + i * 0.08 }}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 px-3 py-4 text-center shadow-[0_6px_20px_rgba(196,134,82,0.18),inset_0_0_0_1.5px_rgba(244,196,141,0.5)]"
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: "linear-gradient(135deg,#FFF8EE 0%,#FFEDD8 100%)" }}
              >
                {icon}
              </div>
              <p className="text-[13px] font-extrabold leading-tight text-[#8a3f16] sm:text-sm">
                {label}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Back link ── */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-5 w-full py-2 text-sm font-semibold text-[#bc7a45] transition-colors hover:text-[#8a3f16]"
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
