"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDefaultOnlinePresence } from "@/hooks/useDefaultOnlinePresence";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { fetchCategories } from "@/lib/firestore/categories.client";
import { createPrivateRoom } from "@/lib/firestore/rooms.client";
import {
  ANSWER_PHASE_SECONDS,
  QUESTION_PHASE_SECONDS,
  ROOM_TIMER_MAX_SECONDS,
  ROOM_TIMER_MIN_SECONDS,
} from "@/lib/game/constants";
import { CATEGORIES as LOCAL_CATEGORIES, DEFAULT_CATEGORY_ID } from "@/lib/game/categories";
import type { Category } from "@/types";

/* ─── inline SVG icons ───────────────────────────────────────────── */
function IcoArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M10 6l6 6-6 6" stroke="#8a3f16" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IcoHeadset() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="rgba(255,149,0,0.15)" />
      <path d="M10 26c0-7.73 6.27-14 14-14s14 6.27 14 14" stroke="#FF9500" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="7" y="25" width="7" height="10" rx="3.5" fill="#FF9500" />
      <rect x="34" y="25" width="7" height="10" rx="3.5" fill="#FF9500" />
      <path d="M38 33c0 3.31-6.27 6-14 6s-14-2.69-14-6" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
    </svg>
  );
}
function IcoSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IcoCategory({ slug }: { slug: string }) {
  const icons: Record<string, React.ReactNode> = {
    general:
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8"/><path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
    celebrities:
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><path d="M10 2l2.09 4.26L17 7.27l-3.5 3.41.83 4.83L10 13.27l-4.33 2.24.83-4.83L3 7.27l4.91-.01L10 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
    animals:
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><ellipse cx="10" cy="13" rx="5" ry="4" stroke="currentColor" strokeWidth="1.8"/><circle cx="6.5" cy="7" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="13.5" cy="7" r="2" stroke="currentColor" strokeWidth="1.8"/></svg>,
    games:
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><rect x="2" y="6" width="16" height="10" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M7 11h2M8 10v2M13 11h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
    anime:
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><path d="M10 2C6.13 2 3 5.13 3 9c0 2.4 1.2 4.5 3 5.74V16l4-2 4 2v-1.26A7 7 0 0010 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="7.5" cy="9" r="1" fill="currentColor"/><circle cx="12.5" cy="9" r="1" fill="currentColor"/></svg>,
  };
  const match =
    Object.entries(icons).find(([k]) => slug.toLowerCase().includes(k))?.[1] ??
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8"/></svg>;
  return <>{match}</>;
}

/* ─── timer presets ─────────────────────────────────────────────── */
const Q_PRESETS = [10, 20, 30, 60] as const;
const A_PRESETS = [10, 15, 20, 30] as const;

export default function NewRoomPage() {
  return (
    <AuthGate>
      <NewRoomInner />
    </AuthGate>
  );
}

function NewRoomInner() {
  const { user } = useAuth();
  useDefaultOnlinePresence(user?.uid ?? null, isFullAccountUser(user));
  const router = useRouter();
  const localFallback: Category[] = LOCAL_CATEGORIES.map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    slug: c.slug,
    order: c.order,
  }));
  const [cats, setCats] = useState<Category[]>(localFallback);
  const [catId, setCatId] = useState(DEFAULT_CATEGORY_ID);
  const [questionTimerSec, setQuestionTimerSec] = useState(QUESTION_PHASE_SECONDS);
  const [answerTimerSec, setAnswerTimerSec] = useState(ANSWER_PHASE_SECONDS);
  const [voiceMode, setVoiceMode] = useState(false);
  const [customCardsEnabled, setCustomCardsEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetchCategories()
      .then((remote) => {
        // Merge: prefer remote when present, else keep local fallback (already in state).
        if (remote.length > 0) {
          // Keep only categories that exist in the local registry (defensive).
          const allowed = new Set(LOCAL_CATEGORIES.map((c) => c.id));
          const merged = remote.filter((c) => allowed.has(c.id));
          if (merged.length > 0) setCats(merged);
        }
      })
      .catch(() => {
        /* silent: local fallback already populated */
      });
  }, []);

  const start = async () => {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      const clamp = (v: number) =>
        Math.min(ROOM_TIMER_MAX_SECONDS, Math.max(ROOM_TIMER_MIN_SECONDS, Math.round(v)));
      const { roomId } = await createPrivateRoom({
        uid: user.uid,
        displayName: user.displayName || user.email || "زائر",
        categoryId: catId,
        questionTimerSec: clamp(questionTimerSec),
        answerTimerSec: clamp(answerTimerSec),
        voiceMode,
        customCardsEnabled,
        vsBot: false,
      });
      router.push(`/room/${roomId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذر إنشاء الغرفة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-full overflow-x-hidden select-none"
      style={{
        background:
          "radial-gradient(120% 70% at 50% 0%, #FFF1DF 0%, #FCE8D2 55%, #FFEFD8 100%)",
      }}
    >
      {/* ── ambient decor ── */}
      <PageDecor />

      {/* ── scroll container ── */}
      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-6 lg:max-w-2xl lg:px-10">

        {/* ── Header row ── */}
        <header className="flex items-center gap-4 pb-5">
          <motion.button
            type="button"
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.07, x: 2 }}
            whileTap={{ scale: 0.93 }}
            aria-label="رجوع"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_6px_18px_rgba(196,134,82,0.25)] ring-1 ring-[#f4d4b0]"
          >
            <IcoArrow />
          </motion.button>

          <div>
            <h1
              className="text-3xl font-black sm:text-4xl"
              style={{
                background: "linear-gradient(180deg,#FF9F0A 0%,#E0660A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "none",
                WebkitTextStroke: "0px transparent",
                filter: "drop-shadow(0 3px 8px rgba(224,102,10,0.35))",
              }}
            >
              إنشاء غرفة
            </h1>
            <p className="mt-0.5 text-sm font-semibold text-[#bc7a45]">
              خصّص المباراة كما تريد
            </p>
          </div>
        </header>

        {/* ── Super card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(196,134,82,0.28),0_6px_16px_rgba(196,134,82,0.12)] backdrop-blur-sm"
        >
          {/* Warm top glow inside card */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "rgba(255,175,60,0.18)" }}
          />

          <div className="space-y-0 divide-y divide-[#f5e0c8]/60 px-5 py-6 sm:px-7">

            {/* ── Question timer ── */}
            <TimerSection
              title="وقت السؤال"
              value={questionTimerSec}
              presets={Q_PRESETS as unknown as number[]}
              onChange={setQuestionTimerSec}
            />

            {/* ── Answer timer ── */}
            <TimerSection
              title="وقت الإجابة"
              value={answerTimerSec}
              presets={A_PRESETS as unknown as number[]}
              onChange={setAnswerTimerSec}
              className="pt-6"
            />

            {/* ── Category ── */}
            <section className="pt-6">
              <p className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-[#8a3f16]">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#FFF1DF] text-[#c2530c]">
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                    <rect x="2" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                    <rect x="11" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                    <rect x="2" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                    <rect x="11" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                  </svg>
                </span>
                اختر الفئة
              </p>

              {cats.length === 0 ? (
                <p className="text-sm text-[#bc7a45]">جاري تحميل الفئات…</p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {cats.map((c) => (
                    <CategoryPill
                      key={c.id}
                      cat={c}
                      selected={catId === c.id}
                      onSelect={() => setCatId(c.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Voice mode ── */}
            <VoiceModeSection voiceMode={voiceMode} onToggle={() => setVoiceMode((v) => !v)} />

            <CustomOpponentCardsLobbyToggle
              enabled={customCardsEnabled}
              onToggle={() => setCustomCardsEnabled((v) => !v)}
            />
          </div>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {err ? (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-2xl border border-[#fca5a5] bg-[#fee2e2] px-4 py-3 text-center text-sm font-bold text-[#7f1d1d]"
            >
              {err}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* ── Primary CTA ── */}
        <div className="relative mt-6">
          <motion.div
            aria-hidden
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.96, 1.06, 0.96] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 -z-10 rounded-[26px] blur-2xl"
            style={{ background: "radial-gradient(closest-side,rgba(255,138,30,0.62),transparent 70%)" }}
          />
          <motion.button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ y: 5, scale: 0.97 }}
            className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[24px] py-[18px] text-xl font-black text-white disabled:opacity-70 sm:text-2xl"
            style={{
              background: busy
                ? "linear-gradient(180deg,#f0a050 0%,#d07020 100%)"
                : "linear-gradient(180deg,#FF9F0A 0%,#FF7A00 100%)",
              boxShadow:
                "inset 0 2.5px 0 rgba(255,255,255,0.5), inset 0 -7px 16px rgba(150,50,0,0.36), 0 13px 0 #be5200, 0 24px 40px rgba(255,122,0,0.55)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-1.5 h-3 rounded-full bg-white/38 blur-[2px]"
            />
            {busy ? (
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity=".3" strokeWidth="2.5" />
                <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              <IcoSparkle />
            )}
            <span style={{ textShadow: "0 2px 0 rgba(0,0,0,0.22)" }}>
              {busy ? "جاري الإنشاء…" : "إنشاء الغرفة"}
            </span>
          </motion.button>
        </div>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 w-full py-2 text-sm font-semibold text-[#bc7a45] transition-colors hover:text-[#8a3f16]"
        >
          رجوع
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TIMER SECTION
   ════════════════════════════════════════════════════════════════════ */
function TimerSection({
  title,
  value,
  presets,
  onChange,
  className = "",
}: {
  title: string;
  value: number;
  presets: number[];
  onChange: (v: number) => void;
  className?: string;
}) {
  // snap to nearest preset for display; non-preset values stay valid
  return (
    <section className={className}>
      <p className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-[#8a3f16]">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#FFF1DF] text-[#c2530c]">
          <IcoClock />
        </span>
        {title}
      </p>
      <div className="grid grid-cols-4 gap-2.5">
        {presets.map((p) => (
          <TimerChip
            key={p}
            seconds={p}
            selected={value === p}
            onSelect={() => onChange(p)}
          />
        ))}
      </div>
    </section>
  );
}

function TimerChip({
  seconds,
  selected,
  onSelect,
}: {
  seconds: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.93 }}
      whileHover={selected ? {} : { y: -2 }}
      className="relative flex flex-col items-center justify-center rounded-2xl py-3 text-sm font-black transition-all"
      style={
        selected
          ? {
              background: "linear-gradient(180deg,#FF9F0A 0%,#FF7A00 100%)",
              color: "white",
              boxShadow:
                "inset 0 1.5px 0 rgba(255,255,255,0.45), 0 7px 0 #be5200, 0 14px 24px rgba(255,122,0,0.45)",
              textShadow: "0 1.5px 0 rgba(0,0,0,0.2)",
            }
          : {
              background: "#FFF8EE",
              color: "#8a3f16",
              boxShadow: "0 4px 10px rgba(196,134,82,0.18), inset 0 0 0 1.5px rgba(244,196,141,0.6)",
            }
      }
    >
      {/* Gloss streak on selected */}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-1 h-2 rounded-full bg-white/35 blur-[1.5px]"
        />
      )}
      <span className="text-xl font-black tabular-nums">{seconds}</span>
      <span className={`text-[10px] font-bold ${selected ? "text-white/85" : "text-[#c48652]"}`}>
        ث
      </span>
    </motion.button>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CATEGORY PILL
   ════════════════════════════════════════════════════════════════════ */
function CategoryPill({
  cat,
  selected,
  onSelect,
}: {
  cat: Category;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.94 }}
      whileHover={selected ? {} : { y: -2 }}
      className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all"
      style={
        selected
          ? {
              background: "linear-gradient(180deg,#FF9F0A 0%,#FF7A00 100%)",
              color: "white",
              boxShadow:
                "inset 0 1.5px 0 rgba(255,255,255,0.4), 0 6px 0 #be5200, 0 12px 20px rgba(255,122,0,0.4)",
              textShadow: "0 1px 0 rgba(0,0,0,0.18)",
            }
          : {
              background: "#FFF8EE",
              color: "#8a3f16",
              boxShadow: "0 4px 10px rgba(196,134,82,0.16), inset 0 0 0 1.5px rgba(244,196,141,0.55)",
            }
      }
    >
      <span style={{ color: selected ? "rgba(255,255,255,0.9)" : "#c2530c" }}>
        <IcoCategory slug={cat.slug} />
      </span>
      {cat.nameAr}
    </motion.button>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CUSTOM OPPONENT CARDS — lobby picks only (toggle here)
   ════════════════════════════════════════════════════════════════════ */
function CustomOpponentCardsLobbyToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="pt-6">
      <motion.div
        animate={
          enabled
            ? {
                boxShadow:
                  "0 0 0 2px rgba(168,85,247,0.55), 0 0 24px rgba(255,149,0,0.2), 0 12px 32px rgba(196,134,82,0.18)",
              }
            : { boxShadow: "0 0 0 1.5px rgba(244,196,141,0.55), 0 6px 16px rgba(196,134,82,0.1)" }
        }
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl p-4"
        style={{
          background: enabled
            ? "linear-gradient(145deg,#FFF8FF 0%,#FFF5E8 48%,#FFF0DC 100%)"
            : "#FFF8EE",
        }}
      >
        {enabled && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full blur-3xl"
              style={{ background: "rgba(168,85,247,0.22)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 -right-6 h-32 w-32 rounded-full blur-3xl"
              style={{ background: "rgba(255,149,0,0.28)" }}
            />
          </>
        )}

        <div className="relative flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[15px] font-extrabold text-[#8a3f16]">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-black text-white"
                  style={{
                    background: "linear-gradient(135deg,#c084fc 0%,#FF9F0A 100%)",
                    boxShadow: "0 2px 8px rgba(168,85,247,0.35)",
                  }}
                >
                  ★
                </span>
                بطاقة للخصم
              </p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#9a5a2a]">
                في الغرفة، كل لاعب يختار صورة واحدة وإجابة واحدة لخصمه فقط — ليس مجموعة بطاقات مشتركة.
              </p>
            </div>
            <motion.button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={onToggle}
              className="relative h-8 w-14 shrink-0 rounded-full"
              animate={{ background: enabled ? "#a855f7" : "#E2CAB0" }}
              transition={{ duration: 0.22 }}
              style={{
                boxShadow: enabled
                  ? "inset 0 2px 0 rgba(255,255,255,0.3), 0 4px 12px rgba(168,85,247,0.45)"
                  : "inset 0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <motion.span
                className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
                animate={{ left: enabled ? "calc(100% - 28px)" : "4px" }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              />
            </motion.button>
          </div>

          <p className="text-[11px] font-bold text-[#a16231]">تفعيل البطاقات المخصصة</p>

          <AnimatePresence>
            {enabled && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden text-xs font-semibold text-[#bc7a45]"
              >
                بعد الدخول للغرفة مع الخصم، سيظهر لك قسم «اختر بطاقة لخصمك». لا يمكن بدء المباراة قبل أن يختار كلٌ منكما بطاقة للآخر.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   VOICE MODE SECTION
   ════════════════════════════════════════════════════════════════════ */
function VoiceModeSection({
  voiceMode,
  onToggle,
}: {
  voiceMode: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="pt-6">
      <motion.div
        animate={voiceMode ? { boxShadow: "0 0 0 2px #FF9500, 0 12px 30px rgba(255,149,0,0.22)" } : { boxShadow: "0 0 0 1.5px rgba(244,196,141,0.55), 0 6px 16px rgba(196,134,82,0.1)" }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl p-4"
        style={{ background: voiceMode ? "linear-gradient(135deg,#FFF8EE,#FFF0DC)" : "#FFF8EE" }}
      >
        {/* Ambient glow when active */}
        {voiceMode && (
          <div
            aria-hidden
            className="pointer-events-none absolute -top-6 right-4 h-20 w-20 rounded-full blur-2xl"
            style={{ background: "rgba(255,149,0,0.3)" }}
          />
        )}

        <div className="flex items-start gap-4">
          {/* Headset illustration */}
          <div className="h-14 w-14 shrink-0">
            <IcoHeadset />
          </div>

          <div className="flex flex-1 flex-col gap-1 pt-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-extrabold text-[#8a3f16]">وضع المكالمة</p>
                <p className="mt-0.5 text-xs font-semibold text-[#bc7a45]">
                  اللعب أثناء المكالمة
                </p>
              </div>

              {/* Toggle */}
              <motion.button
                type="button"
                role="switch"
                aria-checked={voiceMode}
                onClick={onToggle}
                className="relative h-8 w-14 shrink-0 rounded-full"
                animate={{ background: voiceMode ? "#FF9500" : "#E2CAB0" }}
                transition={{ duration: 0.22 }}
                style={{
                  boxShadow: voiceMode
                    ? "inset 0 2px 0 rgba(255,255,255,0.3), 0 4px 10px rgba(255,149,0,0.5)"
                    : "inset 0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <motion.span
                  className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
                  animate={{ left: voiceMode ? "calc(100% - 28px)" : "4px" }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                />
              </motion.button>
            </div>

            {/* Status badge */}
            <AnimatePresence>
              {voiceMode && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -4 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  الدردشة مخفية
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   AMBIENT DECOR
   ════════════════════════════════════════════════════════════════════ */
function PageDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#FFCC8F]/45 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 16, 0], x: [0, -8, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-[#FFB876]/38 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute bottom-16 right-1/4 h-44 w-44 rounded-full bg-[#FFD9A8]/45 blur-3xl"
      />
      {([
        { char: "?", top: "8%",  left: "5%",  delay: 0,   size: 52, tint: "rgba(176,92,255,0.13)"  },
        { char: "?", top: "30%", right:"6%",  delay: 1.6, size: 40, tint: "rgba(255,138,30,0.18)"  },
        { char: "?", top: "62%", left: "9%",  delay: 3,   size: 46, tint: "rgba(78,163,255,0.14)"  },
        { char: "✦", top: "18%", right:"16%", delay: 0.6, size: 18, tint: "rgba(255,180,90,0.7)"   },
        { char: "✦", top: "50%", left: "20%", delay: 2.4, size: 14, tint: "rgba(155,89,255,0.6)"   },
        { char: "✦", top: "75%", right:"12%", delay: 4,   size: 20, tint: "rgba(78,163,255,0.6)"   },
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
          }}
          animate={{ y: [0, -10, 0], rotate: [0, 6, 0] }}
          transition={{ duration: 6 + s.delay, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
        >
          {s.char}
        </motion.span>
      ))}
    </div>
  );
}
