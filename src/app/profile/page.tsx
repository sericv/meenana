"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { DefaultAvatarIllustration } from "@/components/profile/DefaultAvatarIllustration";
import { FramePicker } from "@/components/profile/FramePicker";
import { GuestProfileLockCard } from "@/components/profile/GuestProfileLockCard";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDefaultOnlinePresence } from "@/hooks/useDefaultOnlinePresence";
import { usePlayerCosmetics } from "@/hooks/usePlayerCosmetics";
import { uploadProfileAvatarImage } from "@/lib/api/profile-client";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { playUIButton, resumeAudioContext } from "@/lib/audio/game-sounds";
import { updateUserCosmetics, updateUserPhotoURL } from "@/lib/firestore/users.client";
import { compressAvatarImageFromFile } from "@/lib/profile/avatar-compress";
import { AVATAR_PRESETS, normalizeCosmetic, type FrameId } from "@/lib/profile/cosmetics";

export default function ProfilePage() {
  return (
    <AuthGate>
      <ProfileInner />
    </AuthGate>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-[1.75rem] glass-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#fff4e4] to-[#ffe8c8] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_3px_8px_rgba(196,134,82,0.16)]">
          {icon}
        </span>
        <p className="text-sm font-black text-[#8a3f16]">{title}</p>
      </div>
      {children}
    </section>
  );
}

function ProfileInner() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const fullAccount = isFullAccountUser(user);
  useDefaultOnlinePresence(uid, fullAccount);
  const map = usePlayerCosmetics(uid ? [uid] : []);
  const live = uid ? map[uid] : undefined;
  const resolved = useMemo(() => normalizeCosmetic(live as Record<string, unknown> | undefined), [live]);

  const [avatarId, setAvatarId] = useState(resolved.avatarId);
  const [frameId, setFrameId] = useState<FrameId>(resolved.avatarFrameId as FrameId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "compressing" | "uploading">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarId(resolved.avatarId);
    setFrameId(resolved.avatarFrameId as FrameId);
  }, [resolved.avatarId, resolved.avatarFrameId]);

  const previewCosmetic = useMemo(
    () => ({
      avatarId,
      avatarFrameId: frameId,
      photoURL: resolved.photoURL,
    }),
    [avatarId, frameId, resolved.photoURL],
  );

  const save = useCallback(async () => {
    if (!uid || !fullAccount) return;
    resumeAudioContext();
    playUIButton();
    setBusy(true);
    setErr(null);
    try {
      await updateUserCosmetics(uid, { avatarId, avatarFrameId: frameId });
    } catch {
      setErr("تعذر الحفظ — تحقق من الاتصال.");
    } finally {
      setBusy(false);
    }
  }, [uid, fullAccount, avatarId, frameId]);

  const applyProviderPhoto = useCallback(async () => {
    if (!uid || !user?.photoURL || !fullAccount) return;
    resumeAudioContext();
    playUIButton();
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      await updateUserPhotoURL(uid, user.photoURL);
    } catch {
      setPhotoErr("تعذر مزامنة صورة الحساب.");
    } finally {
      setPhotoBusy(false);
    }
  }, [uid, user?.photoURL, fullAccount]);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !uid || !fullAccount) return;
      resumeAudioContext();
      playUIButton();
      setPhotoErr(null);
      setUploadPhase("compressing");
      setUploadProgress(null);
      setPhotoBusy(true);
      try {
        const b64 = await compressAvatarImageFromFile(file);
        setUploadPhase("uploading");
        setUploadProgress(12);
        await uploadProfileAvatarImage(b64, (p) => setUploadProgress(p));
        setUploadProgress(100);
      } catch (ex) {
        setPhotoErr(ex instanceof Error ? ex.message : "تعذر رفع الصورة.");
      } finally {
        setPhotoBusy(false);
        setUploadPhase("idle");
        setUploadProgress(null);
      }
    },
    [uid, fullAccount],
  );

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-full overflow-x-hidden select-none"
      style={{
        background: "radial-gradient(130% 70% at 50% 0%, #FFF1DF 0%, #FCE8D2 52%, #FFEFD8 100%)",
      }}
    >
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-24 -top-16 h-72 w-72 rounded-full bg-[#FFCB8A]/40 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-[#FFB574]/30 blur-3xl"
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={(e) => void onFileChange(e)}
      />

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-6">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-2xl bg-white/92 px-4 py-2.5 text-sm font-extrabold text-[#8a3f16] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_14px_rgba(196,134,82,0.18)] ring-1 ring-[#f4d4b0]/60"
          >
            <svg viewBox="0 0 10 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
              <path d="M8 2L2 8l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            رجوع
          </motion.button>

          <h1
            className="text-xl font-black sm:text-2xl"
            style={{
              background: "linear-gradient(180deg,#FF9F0A 0%,#E0660A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 6px rgba(224,102,10,0.28))",
            }}
          >
            شخصيتك
          </h1>

          {fullAccount ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={() => router.push("/friends")}
              className="rounded-2xl bg-gradient-to-b from-[#ede9fe] to-[#e9e3fc] px-3.5 py-2.5 text-xs font-extrabold text-[#5b21b6] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(139,92,246,0.20)] ring-1 ring-[#c4b5fd]/70"
            >
              الأصدقاء
            </motion.button>
          ) : (
            <span className="w-16" />
          )}
        </header>

        {/* Live preview card */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 overflow-hidden rounded-[2rem] glass-card p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-black text-[#8a3f16]">معاينة مباشرة</p>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-200/70">
              مباشر
            </span>
          </div>
          <div className="flex justify-center">
            <ProfileAvatar
              cosmetic={previewCosmetic}
              fallbackPhotoURL={user?.photoURL}
              displayName={user?.displayName ?? undefined}
              size="xl"
              idle
              active
            />
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-[#bc7a45]">
            {user?.displayName ?? user?.email?.split("@")[0] ?? "لاعب"}
          </p>
        </motion.section>

        {!fullAccount ? (
          <GuestProfileLockCard />
        ) : (
          <>
            {/* Photo section */}
            <SectionCard
              icon={
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                  <circle cx="10" cy="10" r="7" stroke="#c2530c" strokeWidth="1.7" />
                  <circle cx="10" cy="8.5" r="2.5" fill="#c2530c" opacity=".6" />
                  <path d="M4.5 15.5c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5" stroke="#c2530c" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              }
              title="صورة الملف"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2.5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    disabled={photoBusy}
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 min-w-[9rem] rounded-2xl bg-gradient-to-b from-[#FF9F0A] to-[#FF6B00] px-4 py-3 text-sm font-black text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.42),0_6px_0_#be5200,0_10px_20px_rgba(255,107,0,0.26)] disabled:opacity-55"
                  >
                    {photoBusy && uploadPhase === "compressing"
                      ? "جاري تجهيز الصورة…"
                      : photoBusy && uploadPhase === "uploading"
                        ? "جاري الرفع…"
                        : "📷 رفع من المعرض"}
                  </motion.button>
                  {user?.photoURL ? (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={photoBusy}
                      onClick={() => void applyProviderPhoto()}
                      className="flex-1 min-w-[9rem] rounded-2xl bg-gradient-to-b from-white to-[#fff4e4] px-4 py-3 text-sm font-extrabold text-[#8a3f16] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),0_4px_0_rgba(228,168,100,0.3),0_8px_16px_rgba(196,134,82,0.12)] ring-1 ring-[#f4d4af]/60 disabled:opacity-55"
                    >
                      صورة Google
                    </motion.button>
                  ) : null}
                </div>

                <AnimatePresence>
                  {uploadProgress !== null && photoBusy ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden rounded-2xl bg-[#fff8ee] p-3 ring-1 ring-[#f4d4b0]/60"
                    >
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#ffe8cf]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-[#FF9F0A] to-[#FF6B00]"
                          initial={{ width: "0%" }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ type: "tween", duration: 0.25 }}
                        />
                      </div>
                      <p className="mt-1.5 text-center text-[10px] font-bold text-[#a16231]">
                        جاري الرفع… {uploadProgress}%
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {photoErr ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-center text-xs font-bold text-red-800"
                    >
                      {photoErr}
                    </motion.p>
                  ) : null}
                </AnimatePresence>

                <p className="text-[11px] font-semibold leading-relaxed text-[#bc7a45]">
                  نضغط الصورة تلقائياً لمربع ناعم وJPEG خفيف — آمنة للجوال.
                </p>
              </div>
            </SectionCard>

            {/* Avatar preset section */}
            <SectionCard
              icon={
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                  <path d="M10 2a4 4 0 100 8 4 4 0 000-8zM4 15.5C4 13 6.7 11 10 11s6 2 6 4.5" stroke="#c2530c" strokeWidth="1.7" strokeLinecap="round" />
                  <path d="M14 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="#c2530c" opacity=".55" />
                </svg>
              }
              title="الشكل الافتراضي"
            >
              <p className="mb-4 text-[11px] font-semibold leading-relaxed text-[#bc7a45]">
                يظهر حين لا توجد صورة رفع — اختر ما يعجبك.
              </p>
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-4">
                {AVATAR_PRESETS.map((a, presetIndex) => (
                  <motion.button
                    key={a.id}
                    type="button"
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      resumeAudioContext();
                      playUIButton();
                      setAvatarId(a.id);
                    }}
                    aria-label={`شكل افتراضي ${presetIndex + 1}`}
                    className={`flex aspect-square items-center justify-center rounded-2xl p-1.5 transition-all duration-200 ${
                      avatarId === a.id
                        ? "bg-gradient-to-b from-[#FF9F0A] to-[#FF6B00] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.42),0_6px_0_#be5200,0_12px_24px_rgba(255,107,0,0.30)] ring-2 ring-[#FF9F0A]/60"
                        : "bg-gradient-to-b from-white to-[#fff8ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_3px_8px_rgba(196,134,82,0.10)] ring-1 ring-[#f4d4af]/60"
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center overflow-hidden rounded-full ${
                        avatarId === a.id ? "ring-2 ring-white/80" : ""
                      }`}
                      style={{ width: 44, height: 44 }}
                    >
                      <DefaultAvatarIllustration avatarId={a.id} size={44} />
                    </span>
                  </motion.button>
                ))}
              </div>
            </SectionCard>

            {/* Frame picker section */}
            <SectionCard
              icon={
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                  <rect x="2" y="2" width="16" height="16" rx="3" stroke="#c2530c" strokeWidth="1.7" />
                  <rect x="5" y="5" width="10" height="10" rx="2" stroke="#c2530c" strokeWidth="1.2" strokeDasharray="2 1.5" opacity=".55" />
                </svg>
              }
              title="إطار متحرك"
            >
              <FramePicker
                previewCosmetic={previewCosmetic}
                selectedFrameId={frameId}
                onSelect={setFrameId}
                fallbackPhotoURL={user?.photoURL}
                displayName={user?.displayName ?? undefined}
              />
            </SectionCard>

            {/* Error */}
            <AnimatePresence>
              {err ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm font-bold text-red-800"
                >
                  {err}
                </motion.p>
              ) : null}
            </AnimatePresence>

            {/* Save button */}
            <div className="relative mt-2">
              <motion.div
                aria-hidden
                animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.96, 1.04, 0.96] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 -z-10 rounded-[1.4rem] blur-xl"
                style={{ background: "radial-gradient(closest-side,rgba(255,138,30,0.55),transparent 70%)" }}
              />
              <motion.button
                type="button"
                disabled={busy}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ y: 4, scale: 0.97 }}
                onClick={() => void save()}
                className="btn-gloss relative w-full overflow-hidden rounded-[1.4rem] py-4 text-lg font-black text-white disabled:opacity-60"
                style={{
                  background: "linear-gradient(180deg,#FF9F0A 0%,#FF6B00 100%)",
                  boxShadow:
                    "inset 0 2px 0 rgba(255,255,255,0.44), 0 10px 0 #be5200, 0 18px 34px rgba(255,107,0,0.38)",
                  textShadow: "0 2px 0 rgba(0,0,0,0.18)",
                }}
              >
                {busy ? "جاري الحفظ…" : "✓ حفظ المظهر"}
              </motion.button>
            </div>
          </>
        )}

        <p className="mt-5 text-center text-[11px] font-semibold text-[#bc7a45]">
          يظهر مظهرك للاعبين في الغرفة والدردشة بعد الحفظ.
        </p>
      </div>
    </div>
  );
}
