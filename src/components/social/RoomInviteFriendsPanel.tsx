"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/Button";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col, userSub } from "@/lib/firestore/paths";
import { postSocial } from "@/lib/api/social-client";
import { useLiveUserProfiles } from "@/hooks/useLiveUserProfiles";
import { clientEffectivePresence } from "@/lib/social/game-presence-client";
import { INVITE_BLOCKING_PRESENCE, presenceLabelAr } from "@/lib/social/presence-constants";
import { playUIButton, resumeAudioContext } from "@/lib/audio/game-sounds";

type FriendRow = { friendUid: string; since?: Timestamp | null };

export function RoomInviteFriendsPanel({
  myUid,
  roomId,
  onClose,
}: {
  myUid: string;
  roomId: string;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onSnapshot(
      collection(db, col.users, myUid, userSub.friends),
      (snap) => {
        const rows: FriendRow[] = snap.docs.map((d) => ({
          friendUid: d.id,
          since: (d.data().since as Timestamp | null) ?? null,
        }));
        rows.sort((a, b) => (a.friendUid > b.friendUid ? 1 : -1));
        setFriends(rows);
      },
      () => setFriends([]),
    );
    return () => unsub();
  }, [myUid]);

  const friendUids = useMemo(() => friends.map((f) => f.friendUid), [friends]);
  const live = useLiveUserProfiles(friendUids);

  const sendInvite = async (toUid: string) => {
    resumeAudioContext();
    playUIButton();
    setInviteBusy(toUid);
    setErr(null);
    try {
      await postSocial("/api/social/room-invite", { roomId, toUid });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذر الإرسال");
    } finally {
      setInviteBusy(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#4a2a0d]/40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-16 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[min(78dvh,560px)] w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/80 shadow-[0_24px_60px_rgba(196,134,82,0.35)]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,252,248,0.98) 0%, rgba(255,241,220,0.98) 100%)",
        }}
      >
        <div className="flex items-center justify-between border-b border-[#f4d4b0] px-4 py-3">
          <h2 className="text-lg font-black text-[#8a3f16]">دعوة أصدقاء</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1.5 text-sm font-bold text-[#bc7a45] hover:bg-white/80"
          >
            إغلاق
          </button>
        </div>

        <div className="max-h-[min(58dvh,480px)] space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          <p className="text-center text-xs font-semibold text-[#bc7a45]">
            اختر صديقاً متاحاً للانضمام إلى غرفتك.
          </p>

          <AnimatePresence>
            {err ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-800"
              >
                {err}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <div>
            {friends.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#f4d4b0] bg-[#fffaf5] px-3 py-8 text-center text-sm text-[#bc7a45]">
                لا يوجد أصدقاء بعد — أضفهم من صفحة الأصدقاء أولاً.
              </p>
            ) : (
              <ul className="space-y-2">
                {friends.map((f) => {
                  const p = live[f.friendUid];
                  const raw = p?.gamePresence ?? "offline";
                  const ts = p?.gamePresenceUpdatedAtMs
                    ? ({ toMillis: () => p.gamePresenceUpdatedAtMs! } as Timestamp)
                    : null;
                  const eff = clientEffectivePresence(raw, ts);
                  const blocked = INVITE_BLOCKING_PRESENCE.has(eff);
                  return (
                    <li
                      key={f.friendUid}
                      className="flex items-center gap-3 rounded-2xl border border-[#f4d4b0] bg-white/90 px-3 py-2.5 shadow-sm"
                    >
                      <div className="relative shrink-0">
                        <ProfileAvatar
                          cosmetic={p?.cosmetic}
                          fallbackPhotoURL={null}
                          displayName={p?.displayName ?? undefined}
                          size="md"
                          idle
                          active={eff === "online" || eff === "in_lobby"}
                        />
                        <motion.span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${
                            eff === "online" || eff === "in_lobby"
                              ? "bg-emerald-400"
                              : eff === "matchmaking" || eff === "in_match"
                                ? "bg-amber-400"
                                : eff === "away"
                                  ? "bg-amber-200"
                                  : "bg-slate-300"
                          }`}
                          animate={
                            eff === "online" || eff === "in_lobby"
                              ? { scale: [1, 1.2, 1], opacity: [0.85, 1, 0.85] }
                              : {}
                          }
                          transition={{ duration: 1.6, repeat: Infinity }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#5e3011]">
                          {p?.username ? `@${p.username}` : p?.displayName ?? f.friendUid.slice(0, 8)}
                        </p>
                        <p className="text-[11px] font-bold text-[#bc7a45]">{presenceLabelAr(eff)}</p>
                      </div>
                      <Button
                        type="button"
                        variant={blocked ? "ghost" : "primary"}
                        className="shrink-0 px-3 py-2 text-xs disabled:opacity-45"
                        disabled={blocked || inviteBusy === f.friendUid}
                        title={blocked ? "اللاعب غير متاح للدعوة" : undefined}
                        onClick={() => void sendInvite(f.friendUid)}
                      >
                        {blocked ? "غير متاح" : inviteBusy === f.friendUid ? "…" : "دعوة"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
