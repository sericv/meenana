"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col, userSub } from "@/lib/firestore/paths";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { postSocial } from "@/lib/api/social-client";
import { normalizeCosmetic } from "@/lib/profile/cosmetics";
import { playRoomJoin, resumeAudioContext } from "@/lib/audio/game-sounds";
import type { Timestamp } from "firebase/firestore";

type InviteDoc = {
  id: string;
  fromUid: string;
  roomId: string;
  roomCode: string;
  message: string;
  hostDisplayName: string;
  hostPhotoURL: string | null;
  hostUsername: string;
  hostAvatarId?: string | null;
  hostAvatarFrameId?: string | null;
  createdMs: number;
};

function parseInvite(id: string, data: Record<string, unknown>): InviteDoc | null {
  const roomId = String(data.roomId ?? "");
  const fromUid = String(data.fromUid ?? "");
  if (!roomId || !fromUid) return null;
  const c = data.createdAt as Timestamp | undefined;
  const createdMs = c && typeof c.toMillis === "function" ? c.toMillis() : 0;
  return {
    id,
    fromUid,
    roomId,
    roomCode: String(data.roomCode ?? ""),
    message: String(data.message ?? ""),
    hostDisplayName: String(data.hostDisplayName ?? "مضيف"),
    hostPhotoURL: data.hostPhotoURL != null ? String(data.hostPhotoURL) : null,
    hostUsername: String(data.hostUsername ?? ""),
    hostAvatarId: data.hostAvatarId != null ? String(data.hostAvatarId) : null,
    hostAvatarFrameId: data.hostAvatarFrameId != null ? String(data.hostAvatarFrameId) : null,
    createdMs,
  };
}

function InviteCinematic({
  inv,
  onComplete,
}: {
  inv: InviteDoc;
  onComplete: () => void;
}) {
  const cosmetic = normalizeCosmetic({
    avatarId: inv.hostAvatarId ?? undefined,
    avatarFrameId: inv.hostAvatarFrameId ?? undefined,
    photoURL: inv.hostPhotoURL,
  });

  useEffect(() => {
    const t = window.setTimeout(onComplete, 1480);
    return () => window.clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        background:
          "radial-gradient(120% 80% at 50% 30%, rgba(255,220,170,0.95) 0%, rgba(255,190,120,0.88) 45%, rgba(255,150,70,0.92) 100%)",
      }}
    >
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-2 w-2 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.9)]"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
          }}
          initial={{ opacity: 0, scale: 0.2, y: 40 }}
          animate={{
            opacity: [0, 1, 0.6],
            scale: [0.2, 1.4, 0.8],
            y: [40, -120 - (i % 5) * 30],
            x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 3)],
          }}
          transition={{ duration: 1.45, delay: i * 0.02, ease: "easeOut" }}
        />
      ))}
      <motion.div
        initial={{ scale: 0.2, y: 120, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.85 }}
        className="relative z-10 flex flex-col items-center"
      >
        <motion.div
          animate={{
            filter: [
              "drop-shadow(0 0 0 rgba(255,200,80,0))",
              "drop-shadow(0 0 28px rgba(255,200,80,0.95))",
              "drop-shadow(0 0 12px rgba(255,160,40,0.7))",
            ],
          }}
          transition={{ duration: 1.2, times: [0, 0.45, 1] }}
        >
          <ProfileAvatar
            cosmetic={cosmetic}
            fallbackPhotoURL={inv.hostPhotoURL}
            displayName={inv.hostDisplayName}
            size="xl"
            idle
            active
          />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="mt-5 text-center text-lg font-black text-[#5e3011]"
        >
          انضمام للحفلة…
        </motion.p>
        <p className="mt-1 text-center text-sm font-bold text-[#8a3f16]">
          @{inv.hostUsername} يستضيفك
        </p>
      </motion.div>
    </motion.div>
  );
}

export function GlobalRoomInviteDock() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const google = isFullAccountUser(user);
  const [invites, setInvites] = useState<InviteDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [cinematic, setCinematic] = useState<InviteDoc | null>(null);

  useEffect(() => {
    if (loading || !uid || !google) {
      setInvites([]);
      return;
    }
    const db = getFirebaseDb();
    const unsub = onSnapshot(
      collection(db, col.users, uid, userSub.roomInvites),
      (snap) => {
        const list: InviteDoc[] = [];
        for (const d of snap.docs) {
          const parsed = parseInvite(d.id, d.data() as Record<string, unknown>);
          if (parsed) list.push(parsed);
        }
        list.sort((a, b) => b.createdMs - a.createdMs);
        setInvites(list);
      },
      () => setInvites([]),
    );
    return () => unsub();
  }, [loading, uid, google]);

  const top = invites[0] ?? null;

  const onDecline = useCallback(async () => {
    if (!top) return;
    setBusy(true);
    try {
      await postSocial("/api/social/room-invite/respond", { inviteId: top.id, accept: false });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [top]);

  const onAccept = useCallback(async () => {
    if (!top) return;
    const frozen = top;
    setBusy(true);
    try {
      resumeAudioContext();
      playRoomJoin();
      const res = (await postSocial<{ roomId?: string | null }>("/api/social/room-invite/respond", {
        inviteId: frozen.id,
        accept: true,
      })) as { roomId?: string | null };
      const rid = res.roomId ? String(res.roomId) : "";
      if (rid) {
        setCinematic(frozen);
        window.setTimeout(() => {
          router.replace(`/room/${rid}`);
        }, 420);
      }
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [top, router]);

  const cosmeticPreview = useMemo(() => {
    if (!top) return normalizeCosmetic(undefined);
    return normalizeCosmetic({
      avatarId: top.hostAvatarId ?? undefined,
      avatarFrameId: top.hostAvatarFrameId ?? undefined,
      photoURL: top.hostPhotoURL,
    });
  }, [top]);

  if (!google || loading) return null;

  return (
    <>
      <AnimatePresence>
        {cinematic ? (
          <InviteCinematic
            key={cinematic.id}
            inv={cinematic}
            onComplete={() => setCinematic(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {top && !cinematic ? (
          <motion.div
            key={top.id}
            initial={{ y: 120, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-3 z-[110] mx-auto flex max-w-md justify-center sm:left-6 sm:right-6"
          >
            <div
              className="relative w-full overflow-hidden rounded-[1.75rem] border border-white/80 p-4 shadow-[0_24px_60px_rgba(196,90,20,0.45)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,252,246,0.98) 0%, rgba(255,236,210,0.96) 55%, rgba(255,214,170,0.98) 100%)",
              }}
            >
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#ffb347]/50 blur-3xl"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
              <div className="relative flex gap-3">
                <div className="relative shrink-0">
                  <motion.div
                    animate={{ rotate: [0, 4, -4, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ProfileAvatar
                      cosmetic={cosmeticPreview}
                      fallbackPhotoURL={top.hostPhotoURL}
                      displayName={top.hostDisplayName}
                      size="lg"
                      idle
                      active
                    />
                  </motion.div>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#c48652]">
                    دعوة غرفة
                  </p>
                  <p className="truncate text-base font-black text-[#5e3011]">{top.hostDisplayName}</p>
                  <p className="text-xs font-bold text-[#8a3f16]">
                    @{top.hostUsername}
                    {top.roomCode ? (
                      <span className="mr-2 text-[#bc7a45]"> · رمز {top.roomCode}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#7a4a28]">{top.message}</p>
                  <div className="mt-3 flex gap-2">
                    <motion.button
                      type="button"
                      disabled={busy}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => void onDecline()}
                      className="flex-1 rounded-2xl border border-[#f4c48d] bg-white/90 py-2.5 text-sm font-extrabold text-[#8a3f16] shadow-sm disabled:opacity-50"
                    >
                      رفض
                    </motion.button>
                    <motion.button
                      type="button"
                      disabled={busy}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => void onAccept()}
                      className="flex-1 rounded-2xl py-2.5 text-sm font-black text-white disabled:opacity-50"
                      style={{
                        background: "linear-gradient(180deg,#FF9F0A 0%,#FF6B00 100%)",
                        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.42), 0 8px 0 #be5200",
                      }}
                    >
                      {busy ? "…" : "قبول"}
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
