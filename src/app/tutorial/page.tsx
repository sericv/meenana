"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import { guessMatchesCard } from "@/lib/game/validation";

type ChatRow = { id: string; who: "you" | "bot" | "system"; name: string; text: string };

// Tutorial scenario: you see the opponent's card (آيفون), your hidden card is قطة
const OPPONENT_CARD = { nameAr: "آيفون", imageUrl: "/cards/phone.svg" };
const MY_HIDDEN_NAME_AR = "قطة";
const MY_HIDDEN_NAME_EN = "cat";

// Simulated bot replies to common questions — mimic what a real player would say
function botReply(question: string): string {
  const q = question.toLowerCase();
  if (/حيوان|animal/.test(q)) return "نعم! حيوان";
  if (/طائر|يطير/.test(q)) return "لا، لا يطير";
  if (/أليف|بيت|منزل/.test(q)) return "نعم، حيوان أليف";
  if (/ذيل|وبر|فرو/.test(q)) return "نعم، عنده فرو";
  if (/يموء|صوت/.test(q)) return "نعم يصدر صوتاً مميزاً";
  if (/كبير|صغير|حجم/.test(q)) return "حجمه صغير نسبياً";
  if (/إلكتروني|جهاز/.test(q)) return "لا ليس جهازاً";
  if (/أكل|طعام/.test(q)) return "لا";
  if (/يسبح|ماء/.test(q)) return "يكره الماء عادةً!";
  return "سؤال جيد... فكّر معي أكثر 😄";
}

export default function TutorialPage() {
  const [draft, setDraft] = useState("");
  const [guess, setGuess] = useState("");
  const [chat, setChat] = useState<ChatRow[]>([
    {
      id: "s0",
      who: "system",
      name: "النظام",
      text: "مرحباً بك في التعليمي! أنت ترى بطاقة الخصم (آيفون). بطاقتك أنت مخفية عنك. اسأل الخصم الوهمي أسئلة ليساعدك في تخميّنها.",
    },
  ]);
  const [ended, setEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const push = (row: Omit<ChatRow, "id">) => {
    setChat((c) => {
      const next = [...c, { ...row, id: `${Date.now()}_${Math.random()}` }];
      return next;
    });
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const onAsk = () => {
    const text = draft.trim();
    if (!text || ended) return;
    push({ who: "you", name: "أنت", text });
    setDraft("");
    setBusy(true);
    // Simulate a short thinking delay from the "bot"
    setTimeout(() => {
      push({ who: "bot", name: "خصم وهمي", text: botReply(text) });
      setBusy(false);
    }, 600 + Math.random() * 600);
  };

  const onGuess = () => {
    const text = guess.trim();
    if (!text || ended) return;
    push({ who: "you", name: "أنت", text: `🎯 أتخمين: ${text}` });
    const ok = guessMatchesCard(text, MY_HIDDEN_NAME_EN, MY_HIDDEN_NAME_AR);
    setTimeout(() => {
      if (ok) {
        push({ who: "system", name: "النظام", text: `🎉 إجابة صحيحة! بطاقتك كانت "${MY_HIDDEN_NAME_AR}"` });
      } else {
        push({ who: "system", name: "النظام", text: `❌ تخمين خاطئ. استمر في الأسئلة!` });
        setGuess("");
        return;
      }
      setEnded(true);
      setWon(ok);
    }, 500);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10">
      {/* Header */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-[#8a3f16]">كيف تلعب؟</h1>
            <p className="mt-1 text-sm text-[#a16231]">
              تجربة تفاعلية محاكاة لطريقة اللعب الحقيقية مع لاعب آخر.
            </p>
          </div>
          <Link className="text-sm font-semibold text-[#ea8c2f]" href="/">
            رجوع
          </Link>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-2xl border border-[#f3c793] bg-[#fff1de] px-4 py-3 text-sm text-[#9a5f2d]"
        >
          <span className="font-bold">القاعدة:</span> كل لاعب يرى بطاقة <em>خصمه</em> لكن لا يرى بطاقته هو.
          الأسئلة يجيب عليها اللاعب الثاني <em>بنفسه</em> — لا يوجد نظام تلقائي.
          أول من يخمّن بطاقته الخفية يفوز!
        </motion.div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cards column */}
        <div className="space-y-4">
          {/* Opponent's card — fully visible */}
          <Panel>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#bc7a45]">بطاقة الخصم (تراها أنت)</p>
            <h2 className="mt-1 text-lg font-black text-[#8a3f16]">{OPPONENT_CARD.nameAr}</h2>
            <div className="mt-3 overflow-hidden rounded-3xl border-2 border-[#f3c793]">
              <div className="relative aspect-[4/3] w-full">
                <Image src={OPPONENT_CARD.imageUrl} alt={OPPONENT_CARD.nameAr} fill className="object-cover" unoptimized />
              </div>
            </div>
            <p className="mt-2 text-xs text-[#c48652]">
              خصمك يرى هذه البطاقة أمامه ويعرف أنك تحملها.
            </p>
          </Panel>

          {/* My hidden card */}
          <Panel>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#bc7a45]">بطاقتك الخفية</p>
            <h2 className="mt-1 text-lg font-black text-[#8a3f16]">???</h2>
            <div className="mt-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#f3c793] bg-gradient-to-br from-[#fff6ea] to-[#ffe8ca]">
              <div className="text-center">
                <div className="text-6xl">{ended ? "🐱" : "🃏"}</div>
                <p className="mt-2 text-sm font-bold text-[#bc7a45]">
                  {ended ? `كانت: ${MY_HIDDEN_NAME_AR}` : "اكتشفها بالأسئلة!"}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Chat column */}
        <Panel className="flex min-h-[520px] flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#8a3f16]">الدردشة</h3>
            <span className="rounded-xl bg-[#fff2de] px-3 py-1 text-xs font-semibold text-[#bc7a45]">
              خصم وهمي
            </span>
          </div>
          <p className="mt-1 text-xs text-[#c48652]">
            اسأل الخصم الوهمي أي سؤال. في اللعبة الحقيقية، الخصم الحقيقي هو من يجيب.
          </p>

          {/* Messages */}
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-3xl border border-[#f3c793] bg-[#fff6ea] p-3">
            {chat.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  m.who === "system"
                    ? "border border-[#f2d4b5] bg-[#fff0df] text-[#8a5a2a] text-center"
                    : m.who === "you"
                      ? "border border-[#f0bf8a] bg-[#ffd7a8] text-[#6f3714]"
                      : "border border-[#e8d5b5] bg-white text-[#6f3714]"
                }`}
              >
                {m.who !== "system" && (
                  <div className={`mb-1 text-xs font-semibold ${m.who === "you" ? "text-[#bc7a45]" : "text-[#9b6338]"}`}>
                    {m.name}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </motion.div>
            ))}
            {busy && (
              <div className="rounded-2xl border border-[#e8d5b5] bg-white px-3 py-2 text-sm text-[#bc7a45]">
                <span className="text-xs font-semibold text-[#9b6338]">خصم وهمي</span>
                <div className="mt-1">يكتب…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          {!ended ? (
            <div className="mt-3 space-y-3">
              {/* Question input */}
              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="اسأل سؤالاً مثل: هل شيئي حيوان؟"
                  onKeyDown={(e) => { if (e.key === "Enter") onAsk(); }}
                  disabled={busy}
                  className="flex-1"
                />
                <Button type="button" disabled={busy || !draft.trim()} onClick={onAsk}>
                  اسأل
                </Button>
              </div>

              {/* Guess input */}
              <div className="flex gap-2">
                <Input
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="تخمين بطاقتك… مثل: قطة، أسد"
                  onKeyDown={(e) => { if (e.key === "Enter") onGuess(); }}
                  className="flex-1"
                />
                <Button type="button" variant="ghost" disabled={!guess.trim()} onClick={onGuess}>
                  🎯 خمّن
                </Button>
              </div>
            </div>
          ) : (
            <Panel className="mt-4 border-[#f4c48d] bg-[#fff0dd] text-[#9a5f2d]">
              <p className="text-base font-black">{won ? "🏆 فزت في التعليمي!" : "حاول مجدداً"}</p>
              <p className="mt-2 text-sm">
                {won
                  ? "في اللعبة الحقيقية، سيكون خصمك لاعباً حقيقياً يجيب على أسئلتك بنفسه."
                  : "لم تخمّن الإجابة الصحيحة. اسأل أسئلة أكثر تحديداً."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setChat([{ id: "s0", who: "system", name: "النظام", text: "جولة جديدة! ابدأ بأسئلة ذكية." }]);
                  setEnded(false);
                  setWon(false);
                  setGuess("");
                  setDraft("");
                }}
                className="mt-3 text-sm font-bold text-[#ea8c2f] underline"
              >
                إعادة المحاولة
              </button>
            </Panel>
          )}
        </Panel>
      </div>
    </div>
  );
}
