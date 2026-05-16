"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDefaultOnlinePresence } from "@/hooks/useDefaultOnlinePresence";
import { usePlayerCosmetics } from "@/hooks/usePlayerCosmetics";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { playUIButton, resumeAudioContext } from "@/lib/audio/game-sounds";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";

/* ─── tiny inline SVG icons (no emoji dependency) ─── */
function IconDice({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="white" fillOpacity=".22" />
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="white" strokeOpacity=".4" strokeWidth="1.2" />
      <circle cx="7.5" cy="7.5" r="1.6" fill="white" />
      <circle cx="16.5" cy="7.5" r="1.6" fill="white" />
      <circle cx="7.5" cy="16.5" r="1.6" fill="white" />
      <circle cx="16.5" cy="16.5" r="1.6" fill="white" />
      <circle cx="12" cy="12" r="1.6" fill="white" />
    </svg>
  );
}
function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}
function IconKey({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="12" r="4.5" stroke="white" strokeWidth="2.2" />
      <path d="M13 12h7M17 10v4" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function IconTrophy({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 3h12v8a6 6 0 01-12 0V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 7H3a2 2 0 002 2h1M18 7h3a2 2 0 01-2 2h-1" stroke="currentColor" strokeWidth="2" />
      <path d="M12 17v3M8 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconLightning({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M13 2L4 14h7l0 8 9-12h-7L13 2z" fill="currentColor" />
    </svg>
  );
}
function IconChat({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M20 2H4a2 2 0 00-2 2v12a2 2 0 002 2h4l4 4 4-4h4a2 2 0 002-2V4a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IconUser({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const router = useRouter();
  const { user, loading, signInGoogle, signInGuest, logout, setDisplayName } = useAuth();
  useDefaultOnlinePresence(user?.uid ?? null, isFullAccountUser(user));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  const displayName = user
    ? (user.displayName || (user.isAnonymous ? "زائر" : (user.email?.split("@")[0] ?? "لاعب")))
    : null;

  const profileUid = user?.uid ?? null;
  const profileCosmetics = usePlayerCosmetics(profileUid ? [profileUid] : []);
  const myProfileCosmetic = profileUid ? profileCosmetics[profileUid] : undefined;

  function navTo(href: string) {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(href)}`);
    } else {
      router.push(href);
    }
  }

  return (
    <div dir="rtl" className="relative min-h-[100dvh] w-full overflow-x-hidden select-none">

      {/* ── Background ─────────────────────────────────────────── */}
      <BackgroundLayer />

      {/* ── Page shell ─────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center px-5 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-8 lg:max-w-xl lg:px-10">

        {/* ── Top bar: profile pill only ─────────────────────── */}
        <header className="flex w-full items-center justify-end pt-2">
          <div className="relative" ref={menuRef}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                resumeAudioContext();
                playUIButton();
                setMenuOpen((v) => !v);
              }}
              className="flex items-center gap-2 rounded-full border border-white/70 bg-white/92 px-4 py-2.5 text-sm font-extrabold text-[#8a3f16] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_18px_rgba(196,134,82,0.22)] backdrop-blur"
            >
              {user && profileUid ? (
                <ProfileAvatar
                  cosmetic={myProfileCosmetic}
                  fallbackPhotoURL={user.photoURL}
                  displayName={displayName ?? undefined}
                  size="xs"
                  idle
                />
              ) : (
                <IconUser className="h-4 w-4 text-[#F58C2B]" />
              )}
              <span className="max-w-[110px] truncate">
                {loading ? "..." : (displayName ?? "دخول")}
              </span>
            </motion.button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[220px] rounded-2xl border border-[#f4c48d]/60 bg-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_50px_rgba(200,120,40,0.28),0_4px_12px_rgba(200,120,40,0.12)]"
                >
                  {displayName ? (
                    <>
                      <div className="flex items-center gap-2.5 px-3 py-2">
                        <ProfileAvatar
                          cosmetic={myProfileCosmetic}
                          fallbackPhotoURL={user?.photoURL}
                          displayName={displayName}
                          size="sm"
                          idle
                        />
                        <p className="min-w-0 flex-1 truncate text-xs font-bold text-[#c48652]">{displayName}</p>
                      </div>
                      <hr className="my-1 border-[#f4d4b0]" />
                      <MenuItem onClick={() => { setMenuOpen(false); router.push("/profile"); }}>
                        المظهر والإطار
                      </MenuItem>
                      {isFullAccountUser(user) ? (
                        <MenuItem onClick={() => { setMenuOpen(false); router.push("/friends"); }}>
                          الأصدقاء والمجتمع
                        </MenuItem>
                      ) : null}
                      <MenuItem
                        onClick={() => {
                          setNameDraft(displayName);
                          setNameErr(null);
                          setMenuOpen(false);
                          setNameModalOpen(true);
                        }}
                      >
                        تغيير الاسم الظاهر
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setMenuOpen(false);
                          router.push(isFullAccountUser(user) ? "/login?switch=1" : "/login");
                        }}
                      >
                        تبديل الحساب
                      </MenuItem>
                      <MenuItem
                        tone="danger"
                        onClick={() => { setMenuOpen(false); void logout().then(() => router.replace("/")); }}
                      >
                        تسجيل الخروج
                      </MenuItem>
                    </>
                  ) : (
                    <>
                      <MenuItem onClick={() => { setMenuOpen(false); void signInGoogle(); }}>
                        دخول بـ Google
                      </MenuItem>
                      <MenuItem onClick={() => { setMenuOpen(false); router.push("/login"); }}>
                        دخول برابط البريد
                      </MenuItem>
                      <MenuItem onClick={() => { setMenuOpen(false); void signInGuest(); }}>
                        دخول كزائر
                      </MenuItem>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* ── Logo ───────────────────────────────────────────── */}
        <main className="flex w-full flex-1 flex-col items-center justify-center">
          <LogoHero />

          {/* ── Ribbon ─────────────────────────────────────── */}
          <Ribbon />

          {/* ── CTA stack ──────────────────────────────────── */}
          <div className="mt-10 flex w-full flex-col gap-4">
            <PrimaryCTA onClick={() => navTo("/play/random")} />

            <div className="grid grid-cols-2 gap-4">
              <GradientButton
                icon={<IconPlus className="h-5 w-5" />}
                label="إنشاء غرفة"
                from="#B05CFF"
                to="#7A3CFF"
                shadowDeep="#5B22D6"
                shadowAmbient="rgba(122,60,255,0.45)"
                onClick={() => navTo("/play/new")}
              />
              <GradientButton
                icon={<IconKey className="h-5 w-5" />}
                label="دخول لغرفة"
                from="#4EA3FF"
                to="#2D7CFF"
                shadowDeep="#1B5EC6"
                shadowAmbient="rgba(45,124,255,0.42)"
                onClick={() => navTo("/join")}
              />
            </div>
          </div>

          {/* ── Features ───────────────────────────────────── */}
          <FeatureRow />
        </main>
      </div>

      {/* ── Name-change modal ──────────────────────────────── */}
      <AnimatePresence>
        {nameModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#6a3f1b]/45 px-4 backdrop-blur-sm"
            onClick={() => !nameBusy && setNameModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 12 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm"
            >
              <Panel className="text-center">
                <h2 className="text-xl font-black text-[#8a3f16]">الاسم الظاهر</h2>
                <p className="mt-2 text-sm text-[#a16231]">يظهر للخصوم في الدردشة والغرف.</p>
                <div className="mt-4 text-right">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="اسمك"
                    maxLength={40}
                    className="min-h-[48px] text-center"
                    disabled={nameBusy}
                  />
                  {nameErr ? <p className="mt-2 text-sm text-[#c74d3d]">{nameErr}</p> : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="min-h-[48px] flex-1"
                    disabled={nameBusy || !nameDraft.trim()}
                    onClick={() => {
                      setNameBusy(true);
                      setNameErr(null);
                      void setDisplayName(nameDraft)
                        .then(() => setNameModalOpen(false))
                        .catch((e) => setNameErr(e instanceof Error ? e.message : "تعذر الحفظ"))
                        .finally(() => setNameBusy(false));
                    }}
                  >
                    حفظ
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-[48px] flex-1"
                    disabled={nameBusy}
                    onClick={() => setNameModalOpen(false)}
                  >
                    إلغاء
                  </Button>
                </div>
              </Panel>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   BACKGROUND
   ════════════════════════════════════════════════════════════════════ */
function BackgroundLayer() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Image
        src="/bg-home.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Warm tint — lifts readability without killing the illustration */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,rgba(255,245,225,0.38) 0%,rgba(255,235,200,0.52) 55%,rgba(252,228,196,0.68) 100%)",
        }}
      />
      {/* Drifting sparkle dots */}
      {([
        { top: "12%", left: "7%",  delay: 0,   size: 16, tint: "rgba(255,175,80,0.9)"  },
        { top: "22%", right: "8%", delay: 1.3, size: 13, tint: "rgba(155,89,255,0.8)"  },
        { top: "58%", left: "11%", delay: 2.7, size: 14, tint: "rgba(78,163,255,0.8)"  },
        { top: "78%", right:"14%", delay: 4.0, size: 11, tint: "rgba(255,138,30,0.9)"  },
        { top: "43%", left: "47%", delay: 3.1, size:  9, tint: "rgba(255,255,255,0.95)" },
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
          animate={{ y: [0, -9, 0], opacity: [0.7, 1, 0.7], scale: [1, 1.25, 1] }}
          transition={{ duration: 5 + s.delay, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
        >
          ✦
        </motion.span>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LOGO
   ════════════════════════════════════════════════════════════════════ */
const HOME_LOGO_SRC = "https://i.top4top.io/p_378405pkd1.png";

function LogoHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className="relative mt-4"
    >
      {/* Soft warm glow behind logo — doesn't affect PNG alpha */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 scale-[1.15] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side,rgba(255,170,65,0.50) 0%,transparent 70%)",
        }}
      />
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        className="flex justify-center"
      >
        <Image
          src={HOME_LOGO_SRC}
          alt="مين أنا؟"
          width={560}
          height={440}
          priority
          unoptimized
          sizes="(max-width:640px) 82vw,(max-width:1024px) 66vw,440px"
          className="
            h-auto w-[min(82vw,300px)] max-w-full object-contain
            sm:w-[min(66vw,360px)]
            md:w-[400px]
            lg:w-[440px]
            drop-shadow-[0_20px_40px_rgba(110,50,5,0.50)]
          "
        />
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   RIBBON
   ════════════════════════════════════════════════════════════════════ */
function Ribbon() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16, duration: 0.38 }}
      className="mt-5"
    >
      <div
        className="rounded-full px-8 py-2.5 text-[14px] font-extrabold tracking-wide text-white sm:text-[15px]"
        style={{
          background: "linear-gradient(180deg,#F58C2B 0%,#D9651A 100%)",
          boxShadow:
            "inset 0 1.5px 0 rgba(255,255,255,0.38), 0 7px 0 #a04510, 0 14px 24px rgba(217,101,26,0.42)",
        }}
      >
        اسأل • خمّن • انتصر
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PRIMARY CTA
   ════════════════════════════════════════════════════════════════════ */
function PrimaryCTA({ onClick }: { onClick: () => void }) {
  return (
    <div className="relative">
      {/* Pulsing bloom */}
      <motion.div
        aria-hidden
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 -z-10 rounded-[30px] blur-2xl"
        style={{ background: "radial-gradient(closest-side,rgba(255,138,30,0.7),transparent 70%)" }}
      />
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ y: 5, scale: 0.97 }}
        className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[26px] py-[18px] text-2xl font-black text-white sm:text-3xl"
        style={{
          background: "linear-gradient(180deg,#FF9F0A 0%,#FF7A00 100%)",
          boxShadow:
            "inset 0 2.5px 0 rgba(255,255,255,0.52), inset 0 -7px 16px rgba(150,50,0,0.38), 0 13px 0 #be5200, 0 24px 40px rgba(255,122,0,0.58)",
        }}
      >
        {/* Gloss streak */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-1.5 h-3 rounded-full bg-white/38 blur-[2px]"
        />
        <motion.span
          animate={{ rotate: [0, 12, -9, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <IconDice className="h-8 w-8 sm:h-9 sm:w-9" />
        </motion.span>
        <span style={{ textShadow: "0 2px 0 rgba(0,0,0,0.22)" }}>العب عشوائي</span>
      </motion.button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SECONDARY GRADIENT BUTTON
   ════════════════════════════════════════════════════════════════════ */
function GradientButton({
  icon,
  label,
  from,
  to,
  shadowDeep,
  shadowAmbient,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  from: string;
  to: string;
  shadowDeep: string;
  shadowAmbient: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ y: 4, scale: 0.97 }}
      className="flex items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-black text-white sm:text-base"
      style={{
        background: `linear-gradient(180deg,${from} 0%,${to} 100%)`,
        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.42), inset 0 -5px 12px rgba(0,0,0,0.18), 0 8px 0 ${shadowDeep}, 0 16px 24px ${shadowAmbient}`,
      }}
    >
      {icon}
      <span style={{ textShadow: "0 1.5px 0 rgba(0,0,0,0.22)" }}>{label}</span>
    </motion.button>
  );
}

/* ════════════════════════════════════════════════════════════════════
   FEATURE ROW
   ════════════════════════════════════════════════════════════════════ */
const FEATURES = [
  { Icon: IconTrophy,   tint: "#FF8A1E", label: "تنافس واربح" },
  { Icon: IconLightning,tint: "#F0BE00", label: "سريع وممتع"  },
  { Icon: IconChat,     tint: "#9B59FF", label: "مع أصدقائك"  },
] as const;

function FeatureRow() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24, duration: 0.4 }}
      className="mt-6 w-full"
    >
      <div className="grid grid-cols-3 divide-x divide-[#f4d4b0]/60 rounded-2xl border border-white/65 bg-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_32px_rgba(196,134,82,0.20),0_2px_8px_rgba(196,134,82,0.08)] backdrop-blur-md [direction:ltr]">
        {FEATURES.map(({ Icon, tint, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 px-2 py-3.5 [direction:rtl]">
            <span
              className="grid h-11 w-11 place-items-center rounded-full"
              style={{
                background: `linear-gradient(180deg,${tint}44,${tint}1e)`,
                boxShadow: `inset 0 0 0 1.5px ${tint}66, 0 4px 12px ${tint}33`,
                color: tint,
              }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11.5px] font-extrabold leading-tight text-[#5e3011]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MENU ITEM
   ════════════════════════════════════════════════════════════════════ */
function MenuItem({
  children,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={() => {
        resumeAudioContext();
        playUIButton();
        onClick();
      }}
      className={`mt-1 w-full rounded-xl px-3 py-2 text-right text-sm font-semibold transition-colors first:mt-0 ${
        tone === "danger"
          ? "text-[#b45309] hover:bg-[#fff0dd]"
          : "text-[#8a3f16] hover:bg-[#fff4e4]"
      }`}
    >
      {children}
    </button>
  );
}
