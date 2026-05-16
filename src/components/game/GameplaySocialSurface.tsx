"use client";
// v2 — premium social redesign
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import type { RefObject } from "react";
import { memo, useMemo, useState } from "react";
import { AvatarTurnRing } from "@/components/game/AvatarTurnRing";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { getCategoryById } from "@/lib/game/categories";
import type { PlayerCosmetic } from "@/lib/profile/cosmetics";
import type { ChatMessage, GameCard, Room } from "@/types";

const CARD_PLACEHOLDER = "/cards/_placeholder.svg";

/** أحدث رسائل تظهر في الشات فقط؛ الأقدم تُزال من الواجهة ولا يمكن التمرير إليها. */
const VISIBLE_CHAT_MESSAGE_COUNT = 6;

const CardImage = memo(function CardImageInner({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [errored, setErrored] = useState(false);
  const finalSrc = errored || !src ? CARD_PLACEHOLDER : src;
  return (
    <Image
      src={finalSrc}
      alt={alt}
      fill
      className="object-cover object-center"
      sizes="(max-width: 640px) 46vw, 180px"
      unoptimized
      onError={() => setErrored(true)}
    />
  );
});

export type GameplaySocialSurfaceProps = {
  banner: string | null;
  matchSyncWaiting: boolean;
  socialMatchLive: boolean;
  myTurn: boolean;
  phase: string;
  turnAction: string | null;
  secLeft: number | null;
  maxPhaseSec: number;
  displayName: string;
  opponentName: string;
  uid: string | null;
  opponent: Room["players"][number] | undefined;
  cosmeticsMap: Record<string, PlayerCosmetic>;
  userPhotoURL: string | null | undefined;
  opponentCard: GameCard | null;
  messages: ChatMessage[];
  renderMessage: (m: ChatMessage) => React.ReactNode;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  chatEndRef: RefObject<HTMLDivElement | null>;
  draft: string;
  onDraftChange: (v: string) => void;
  onSendDraft: () => void | Promise<void>;
  busy: boolean;
  onGuessClick: () => void;
  onComposerFocus: (el: HTMLInputElement) => void;
  onComposerBlur: (el: HTMLInputElement) => void;
  keyboardOverlapPx?: number;
};

export function GameplaySocialSurface({
  banner,
  matchSyncWaiting,
  socialMatchLive,
  myTurn,
  phase,
  turnAction,
  secLeft,
  maxPhaseSec,
  displayName,
  opponentName,
  uid,
  opponent,
  cosmeticsMap,
  userPhotoURL,
  opponentCard,
  messages,
  renderMessage,
  chatScrollRef,
  chatEndRef,
  draft,
  onDraftChange,
  onSendDraft,
  busy,
  onGuessClick,
  onComposerFocus,
  onComposerBlur,
  keyboardOverlapPx = 0,
}: GameplaySocialSurfaceProps) {
  const catName = opponentCard?.categoryId
    ? getCategoryById(opponentCard.categoryId)?.nameAr
    : null;

  const CAT_EMOJI: Record<string, string> = {
    cat_general: "🌟",
    cat_celebrities: "🎬",
    cat_animals: "🐾",
    cat_games: "🎮",
    cat_anime: "⛩️",
  };
  const catEmoji = opponentCard?.categoryId
    ? (CAT_EMOJI[opponentCard.categoryId] ?? "🐾")
    : "🐾";

  const visibleMessages = useMemo(
    () => messages.slice(-VISIBLE_CHAT_MESSAGE_COUNT),
    [messages],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

      {/* ── System banner ──────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-2">
        <AnimatePresence>
          {banner ? (
            <motion.div
              key="banner"
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="rounded-2xl border border-[#f4c48d]/80 px-4 py-2 text-center text-[11px] font-extrabold text-[#9a5f2d]"
              style={{
                background: "linear-gradient(135deg,#fff7e8,#fff0d8)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.85), 0 6px 18px rgba(196,134,82,0.14)",
              }}
            >
              {banner}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {matchSyncWaiting ? (
          <div className="mt-1.5 rounded-xl border border-[#f4d4af] bg-[#fff9ef]/95 px-3 py-1.5 text-center text-[10.5px] font-semibold text-[#a16231]">
            جاري مزامنة حالة المباراة…
          </div>
        ) : null}
      </div>

      {/* ── Player strip — premium avatars + VS badge ──────── */}
      {socialMatchLive ? (
        <section className="shrink-0 px-3 pt-2">
          <div
            className="relative flex items-center justify-between overflow-hidden rounded-[24px] px-3 py-3"
            style={{
              background:
                "linear-gradient(160deg,rgba(255,255,255,0.99) 0%,rgba(255,248,236,0.97) 55%,rgba(255,235,205,0.95) 100%)",
              boxShadow:
                "inset 0 1.5px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(244,196,141,0.25), 0 8px 32px rgba(160,80,30,0.11), 0 2px 8px rgba(160,80,30,0.07), 0 0 0 1px rgba(244,196,141,0.38)",
            }}
          >
            {/* Warm ambient glow blob */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 60% 80% at 50% 110%,rgba(255,159,10,0.18) 0%,transparent 70%)",
              }}
            />

            {/* Me */}
            <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <AvatarTurnRing
                density="comfortable"
                showTimer={myTurn}
                emphasize={myTurn}
                secLeft={secLeft}
                maxSec={maxPhaseSec}
              >
                <ProfileAvatar
                  cosmetic={uid ? cosmeticsMap[uid] : null}
                  fallbackPhotoURL={userPhotoURL}
                  displayName={displayName}
                  size="lg"
                  active={myTurn}
                  idle={!myTurn}
                  showPulseDot={myTurn}
                />
              </AvatarTurnRing>

              {/* Name pill */}
              <div
                className="max-w-[80px] truncate rounded-full px-2.5 py-0.5 text-center text-[10px] font-black leading-tight"
                style={
                  myTurn
                    ? {
                        background:
                          "linear-gradient(135deg,#FF9F0A,#FF5500)",
                        color: "#fff",
                        boxShadow:
                          "0 2px 8px rgba(255,107,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
                      }
                    : {
                        background: "rgba(244,196,141,0.22)",
                        color: "#a16231",
                        border: "1px solid rgba(244,196,141,0.45)",
                      }
                }
              >
                أنت
              </div>
            </div>

            {/* VS badge */}
            <div className="relative mx-2 flex shrink-0 flex-col items-center gap-1">
              <motion.div
                animate={
                  socialMatchLive
                    ? { scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }
                    : {}
                }
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  background:
                    "linear-gradient(140deg,#FF9F0A 0%,#FF4500 100%)",
                  boxShadow:
                    "inset 0 2px 0 rgba(255,255,255,0.42), 0 5px 0 #b84500, 0 10px 24px rgba(255,107,0,0.38), 0 0 0 2px rgba(255,159,10,0.22)",
                }}
              >
                <span
                  className="text-[12px] font-black tracking-tight text-white"
                  style={{ textShadow: "0 1.5px 0 rgba(0,0,0,0.25)" }}
                >
                  VS
                </span>
              </motion.div>
            </div>

            {/* Opponent */}
            <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <AvatarTurnRing
                density="comfortable"
                showTimer={!myTurn}
                emphasize={!myTurn}
                secLeft={secLeft}
                maxSec={maxPhaseSec}
              >
                <ProfileAvatar
                  cosmetic={opponent ? cosmeticsMap[opponent.uid] : null}
                  displayName={opponentName}
                  size="lg"
                  active={!myTurn}
                  idle={myTurn}
                  showPulseDot={!myTurn}
                />
              </AvatarTurnRing>

              {/* Name pill */}
              <div
                className="max-w-[80px] truncate rounded-full px-2.5 py-0.5 text-center text-[10px] font-black leading-tight"
                style={
                  !myTurn
                    ? {
                        background:
                          "linear-gradient(135deg,#FF9F0A,#FF5500)",
                        color: "#fff",
                        boxShadow:
                          "0 2px 8px rgba(255,107,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
                      }
                    : {
                        background: "rgba(244,196,141,0.22)",
                        color: "#a16231",
                        border: "1px solid rgba(244,196,141,0.45)",
                      }
                }
              >
                {opponentName}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Turn banner ────────────────────────────────────── */}
      {socialMatchLive && turnAction ? (
        <section className="shrink-0 px-3 pt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={turnAction}
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 440, damping: 32 }}
              className="relative flex items-center gap-3 overflow-hidden rounded-[18px] px-4 py-2.5"
              style={
                myTurn
                  ? {
                      background:
                        "linear-gradient(135deg,#FF9F0A 0%,#FF5500 100%)",
                      boxShadow:
                        "inset 0 2px 0 rgba(255,255,255,0.42), inset 0 -3px 10px rgba(140,40,0,0.22), 0 6px 0 #b84500, 0 14px 32px rgba(255,107,0,0.36)",
                    }
                  : {
                      background:
                        "linear-gradient(135deg,rgba(255,255,255,0.99) 0%,rgba(255,249,239,0.97) 100%)",
                      boxShadow:
                        "inset 0 1.5px 0 rgba(255,255,255,0.95), 0 4px 16px rgba(160,80,30,0.09), 0 0 0 1px rgba(244,196,141,0.42)",
                    }
              }
            >
              {myTurn && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-10 top-1.5 h-[3px] rounded-full bg-white/32 blur-[2px]"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-2 h-8 w-8 rounded-full bg-white/10 blur-md"
                  />
                </>
              )}
              <span
                className={`min-w-0 flex-1 truncate text-[13px] font-extrabold ${
                  myTurn ? "text-white" : "text-[#8a3f16]"
                }`}
                style={
                  myTurn ? { textShadow: "0 1.5px 0 rgba(0,0,0,0.2)" } : {}
                }
              >
                {turnAction}
              </span>
              {myTurn && secLeft !== null && (
                <span
                  className={`shrink-0 font-black tabular-nums ${
                    secLeft <= 5
                      ? "text-[16px] text-red-100"
                      : "text-[14px] text-white/92"
                  }`}
                  style={{ textShadow: "0 1.5px 0 rgba(0,0,0,0.2)" }}
                >
                  {secLeft}ث
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      ) : null}

      {/* ── Card section — the mystery card ───────────────── */}
      <section className="shrink-0 px-3 pt-2">
        <div
          className="relative overflow-hidden rounded-[20px]"
          style={{
            background:
              "linear-gradient(160deg,rgba(255,255,255,0.99) 0%,rgba(255,248,234,0.97) 55%,rgba(255,235,200,0.95) 100%)",
            boxShadow:
              "inset 0 1.5px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(244,196,141,0.2), 0 8px 28px rgba(160,80,30,0.10), 0 2px 6px rgba(160,80,30,0.06), 0 0 0 1px rgba(244,196,141,0.36)",
          }}
        >
          {/* Warm top-left blob */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-4 -top-4 h-24 w-24 rounded-full opacity-30 blur-2xl"
            style={{ background: "radial-gradient(circle,#FFD580,transparent)" }}
          />

          <div className="flex flex-col items-center px-3 pb-3 pt-3 text-center">
            <p className="mb-2 text-[9px] font-extrabold uppercase tracking-widest text-[#bc7a45]">
              الشخصية السرية
            </p>

            <div
              className="relative mx-auto shrink-0 overflow-hidden"
              style={{
                width: "clamp(118px, 46vw, 176px)",
                aspectRatio: "3 / 4",
                borderRadius: "16px",
                background:
                  "linear-gradient(160deg,#FFF6E5 0%,#FFE8BF 60%,#FFDFA0 100%)",
                boxShadow:
                  "0 0 0 2px rgba(244,196,141,0.6), 0 3px 0 rgba(244,196,141,0.28), 0 10px 22px rgba(196,120,40,0.22), inset 0 2px 0 rgba(255,255,255,0.55)",
              }}
            >
              {opponentCard?.imageUrl ? (
                <CardImage
                  src={opponentCard.imageUrl}
                  alt={opponentCard.nameAr || "بطاقة الخصم"}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <span className="text-3xl leading-none opacity-30">؟</span>
                </div>
              )}
            </div>

            <p className="mt-2.5 max-w-[95%] truncate text-[13px] font-black leading-tight text-[#6f3714]">
              {opponentCard?.nameAr ?? "بطاقة الخصم"}
            </p>
            {catName ? (
              <span
                className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold"
                style={{
                  background:
                    "linear-gradient(135deg,#FFF4E4,#FFE8C8)",
                  color: "#9a4f1d",
                  boxShadow:
                    "0 0 0 1px rgba(244,196,141,0.52), inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
              >
                {catEmoji} {catName}
              </span>
            ) : (
              <p className="mt-1 text-[9.5px] font-semibold text-[#c48652]">
                {opponentCard ? "بدون تصنيف" : "تظهر بعد بدء المباراة"}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Chat panel — social, fills remaining space ─────── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-1 pt-2">
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px]"
          style={{
            background:
              "linear-gradient(180deg,rgba(255,255,255,0.99) 0%,rgba(255,251,244,0.98) 100%)",
            boxShadow:
              "inset 0 1.5px 0 rgba(255,255,255,0.95), 0 0 0 1px rgba(244,196,141,0.30), 0 10px 32px rgba(120,55,20,0.07)",
          }}
        >
          {/* Chat header */}
          <header
            className="flex h-10 shrink-0 items-center justify-between px-4"
            style={{
              borderBottom: "1px solid rgba(244,220,190,0.6)",
              background:
                "linear-gradient(180deg,rgba(255,252,247,0.99),rgba(255,249,240,0.97))",
            }}
          >
            <span className="text-[10.5px] font-extrabold tracking-wide text-[#7a3410]">
              💬 الدردشة
            </span>
            {socialMatchLive && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[9px] font-extrabold"
                style={
                  myTurn
                    ? phase === "answer"
                      ? {
                          background:
                            "linear-gradient(135deg,#d1fae5,#bbf7d0)",
                          color: "#166534",
                          boxShadow:
                            "inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(134,239,172,0.4)",
                        }
                      : {
                          background:
                            "linear-gradient(135deg,#ede9fe,#ddd6fe)",
                          color: "#5b21b6",
                          boxShadow:
                            "inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(196,181,253,0.4)",
                        }
                    : {
                        background:
                          "linear-gradient(135deg,#fff3e0,#ffe8c4)",
                        color: "#a16231",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(244,196,141,0.4)",
                      }
                }
              >
                {myTurn
                  ? phase === "answer"
                    ? "إجابة"
                    : "سؤال"
                  : "دور الخصم"}
              </span>
            )}
          </header>

          {socialMatchLive ? (
            <>
              {/* Message list */}
              <div
                ref={chatScrollRef}
                className="scroll-y-chat min-h-0 flex-1 space-y-2.5 px-3 py-3"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                    <motion.span
                      className="text-4xl leading-none"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      💬
                    </motion.span>
                    <p className="text-[12px] font-bold text-[#c48652]">
                      ابدأ بطرح سؤالك على خصمك
                    </p>
                    <p className="text-[10.5px] font-medium text-[#d4a574]">
                      اسأل بـ «نعم» أو «لا»
                    </p>
                  </div>
                ) : (
                  visibleMessages.map((m) => renderMessage(m))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Footer: input + guess button */}
              <footer
                className="relative z-20 shrink-0 space-y-2 px-3 pb-2 pt-2"
                style={{
                  borderTop: "1px solid rgba(244,220,190,0.55)",
                  background:
                    "linear-gradient(180deg,rgba(255,252,247,0.99),rgba(255,249,240,0.98))",
                  paddingBottom: `calc(max(env(safe-area-inset-bottom, 0px), 8px) + ${keyboardOverlapPx}px)`,
                }}
              >
                {/* Input row */}
                {myTurn ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      placeholder={
                        phase === "answer" ? "اكتب إجابتك…" : "اكتب سؤالك…"
                      }
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !busy) void onSendDraft();
                      }}
                      dir="rtl"
                      inputMode="text"
                      enterKeyHint="send"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="min-h-[44px] flex-1 rounded-[14px] px-4 py-2 font-semibold text-[#6f3714] placeholder-[#c9955e] outline-none"
                      style={{
                        fontSize: "16px",
                        background:
                          "linear-gradient(180deg,#FFFCF8,#FFF5E8)",
                        boxShadow:
                          "inset 0 0 0 1.5px rgba(244,196,141,0.52), inset 0 2px 6px rgba(196,134,82,0.06)",
                        transition: "box-shadow 0.18s ease",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow =
                          "inset 0 0 0 2px rgba(255,159,10,0.70), inset 0 2px 6px rgba(196,134,82,0.06), 0 0 0 3px rgba(255,159,10,0.12)";
                        onComposerFocus(e.currentTarget);
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow =
                          "inset 0 0 0 1.5px rgba(244,196,141,0.52), inset 0 2px 6px rgba(196,134,82,0.06)";
                        onComposerBlur(e.currentTarget);
                      }}
                    />
                    <motion.button
                      type="button"
                      disabled={busy || !draft.trim()}
                      onClick={() => void onSendDraft()}
                      whileTap={{ scale: 0.88 }}
                      whileHover={{ scale: 1.04 }}
                      aria-label="إرسال"
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] text-white disabled:opacity-50"
                      style={{
                        background:
                          "linear-gradient(140deg,#FF9F0A,#FF5500)",
                        boxShadow:
                          "inset 0 2px 0 rgba(255,255,255,0.38), 0 4px 0 #be4800, 0 8px 18px rgba(255,107,0,0.32)",
                      }}
                    >
                      {/* Gloss streak */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-2 top-1 h-[3px] rounded-full bg-white/30 blur-[1px]"
                      />
                      <svg
                        viewBox="0 0 18 18"
                        fill="none"
                        className="relative h-4 w-4"
                        aria-hidden
                      >
                        <path d="M2.5 9L15.5 3l-4 6 4 6-13-6z" fill="white" />
                      </svg>
                    </motion.button>
                  </div>
                ) : (
                  /* Waiting state */
                  <div
                    className="flex min-h-[44px] items-center justify-center gap-2.5 rounded-[14px] px-3 py-2"
                    style={{
                      background: "rgba(255,249,240,0.96)",
                      boxShadow: "inset 0 0 0 1px rgba(244,196,141,0.32)",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="block h-1.5 w-1.5 rounded-full bg-[#e0a060]"
                        animate={{
                          scale: [1, 1.6, 1],
                          opacity: [0.35, 1, 0.35],
                        }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.22,
                        }}
                      />
                    ))}
                    <span className="text-[11px] font-semibold text-[#c48652]">
                      بانتظار دورك…
                    </span>
                  </div>
                )}

                {/* Guess button */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: myTurn ? 1.01 : 1 }}
                  onClick={onGuessClick}
                  className="relative w-full overflow-hidden rounded-[14px] py-2.5 text-[13px] font-black"
                  style={
                    myTurn
                      ? {
                          background:
                            "linear-gradient(140deg,#FF9F0A 0%,#FF4800 100%)",
                          color: "#fff",
                          boxShadow:
                            "inset 0 2px 0 rgba(255,255,255,0.38), inset 0 -2px 8px rgba(140,40,0,0.18), 0 4px 0 #be4800, 0 8px 20px rgba(255,107,0,0.30)",
                        }
                      : {
                          background:
                            "linear-gradient(140deg,#FFF4E4 0%,#FFE8C8 100%)",
                          color: "#bc7a45",
                          boxShadow:
                            "0 0 0 1px rgba(244,196,141,0.45), inset 0 1px 0 rgba(255,255,255,0.7)",
                        }
                  }
                >
                  {myTurn && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-12 top-1.5 h-[3px] rounded-full bg-white/28 blur-[2px]"
                    />
                  )}
                  🎯 تخمين
                </motion.button>
              </footer>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                ⏳
              </motion.span>
              <p className="text-[12px] font-semibold text-[#c48652]">
                ستظهر الدردشة هنا عند بدء المباراة
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
