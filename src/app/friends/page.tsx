"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { AuthGate } from "@/components/auth/AuthGate";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col, userSub } from "@/lib/firestore/paths";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { postSocial, getSocial } from "@/lib/api/social-client";
import { useLiveUserProfiles } from "@/hooks/useLiveUserProfiles";
import { useDefaultOnlinePresence } from "@/hooks/useDefaultOnlinePresence";
import { clientEffectivePresence } from "@/lib/social/game-presence-client";
import { presenceLabelAr } from "@/lib/social/presence-constants";
import { validateUsernameInput } from "@/lib/social/username";
import { playUIButton, resumeAudioContext } from "@/lib/audio/game-sounds";

type FriendRow = { friendUid: string };
type InboxRow = {
  fromUid: string;
  displayName: string;
  photoURL: string | null;
  username: string;
};
type SearchHit = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
};

export default function FriendsPage() {
  return (
    <AuthGate>
      <FriendsInner />
    </AuthGate>
  );
}

function FriendsInner() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const google = isFullAccountUser(user);
  useDefaultOnlinePresence(uid, google);

  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameErr, setUsernameErr] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [socialBusy, setSocialBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !google) { setFriends([]); setInbox([]); return; }
    const db = getFirebaseDb();
    const u1 = onSnapshot(
      collection(db, col.users, uid, userSub.friends),
      (snap) => setFriends(snap.docs.map((d) => ({ friendUid: d.id })).sort((a, b) => a.friendUid > b.friendUid ? 1 : -1)),
      () => setFriends([]),
    );
    const u2 = onSnapshot(
      collection(db, col.users, uid, userSub.friendInbox),
      (snap) => {
        const rows: InboxRow[] = [];
        for (const d of snap.docs) {
          const x = d.data() as Record<string, unknown>;
          rows.push({
            fromUid: String(x.fromUid ?? d.id),
            displayName: String(x.displayName ?? "لاعب"),
            photoURL: x.photoURL != null ? String(x.photoURL) : null,
            username: String(x.username ?? ""),
          });
        }
        setInbox(rows);
      },
      () => setInbox([]),
    );
    return () => { u1(); u2(); };
  }, [uid, google]);

  const selfUids = useMemo(() => (uid ? [uid] : []), [uid]);
  const selfLive = useLiveUserProfiles(selfUids);
  const myUsername = uid ? selfLive[uid]?.username : null;

  useEffect(() => { if (myUsername) setUsernameDraft(myUsername); }, [myUsername]);

  const friendUids = useMemo(() => friends.map((f) => f.friendUid), [friends]);
  const friendLive = useLiveUserProfiles(friendUids);

  const saveUsername = async () => {
    if (!uid) return;
    resumeAudioContext(); playUIButton();
    const v = validateUsernameInput(usernameDraft);
    if (!v.ok) { setUsernameErr(v.error); return; }
    setUsernameBusy(true); setUsernameErr(null);
    try {
      await postSocial("/api/social/username", { username: v.usernameDisplay });
    } catch (e) {
      setUsernameErr(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally { setUsernameBusy(false); }
  };

  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (q.length < 2) { setHits([]); return; }
    setSearchBusy(true);
    try {
      const res = (await getSocial<{ results: SearchHit[] }>(`/api/social/users/search?q=${encodeURIComponent(q)}`)) as { results: SearchHit[] };
      setHits((res.results ?? []).filter((h) => h.uid !== uid));
    } catch { setHits([]); } finally { setSearchBusy(false); }
  }, [searchQ, uid]);

  const sendRequest = async (toUid: string) => {
    resumeAudioContext(); playUIButton();
    setSocialBusy(toUid);
    try { await postSocial("/api/social/friends/request", { toUid }); } catch { } finally { setSocialBusy(null); }
  };

  const respond = async (fromUid: string, accept: boolean) => {
    resumeAudioContext(); playUIButton();
    setSocialBusy(fromUid);
    try { await postSocial("/api/social/friends/respond", { fromUid, accept }); } finally { setSocialBusy(null); }
  };

  const remove = async (friendUid: string) => {
    resumeAudioContext(); playUIButton();
    setSocialBusy(`rm:${friendUid}`);
    try { await postSocial("/api/social/friends/remove", { friendUid }); } finally { setSocialBusy(null); }
  };

  if (!google) {
    return (
      <div dir="rtl" className="relative min-h-[100dvh] w-full overflow-x-hidden select-none"
        style={{ background: "radial-gradient(120% 70% at 50% 0%, #FFF1DF 0%, #FCE8D2 55%, #FFEFD8 100%)" }}>
        <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center sm:max-w-lg">
          <div className="mb-4 text-5xl">👥</div>
          <p className="text-lg font-black text-[#8a3f16]">الأصدقاء — حساب كامل</p>
          <p className="mt-2 text-sm font-semibold text-[#bc7a45]">سجّل الدخول بـ Google أو رابط البريد لاستخدام الأصدقاء والدعوات.</p>
          <Button type="button" className="mt-6" onClick={() => router.push("/login?next=/friends")}>تسجيل الدخول</Button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-[100dvh] w-full overflow-x-hidden select-none"
      style={{ background: "radial-gradient(130% 72% at 50% 0%, #FFF1DF 0%, #FCE8D2 52%, #FFEFD8 100%)" }}>

      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div animate={{ y: [0, -18, 0], opacity: [0.32, 0.5, 0.32] }} transition={{ duration: 8, repeat: Infinity }}
          className="absolute -right-20 top-24 h-64 w-64 rounded-full bg-[#FFCB8A]/40 blur-3xl" />
        <motion.div animate={{ y: [0, 14, 0] }} transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className="absolute -left-24 bottom-32 h-72 w-72 rounded-full bg-[#FFB574]/32 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-6">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <motion.button type="button" whileTap={{ scale: 0.93 }} onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-2xl bg-white/92 px-4 py-2.5 text-sm font-extrabold text-[#8a3f16] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_14px_rgba(196,134,82,0.18)] ring-1 ring-[#f4d4b0]/60">
            <svg viewBox="0 0 10 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
              <path d="M8 2L2 8l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            رجوع
          </motion.button>

          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black sm:text-2xl" style={{
              background: "linear-gradient(180deg,#FF9F0A 0%,#E0660A 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 6px rgba(224,102,10,0.28))",
            }}>
              الأصدقاء
            </h1>
            {friends.length > 0 && (
              <span className="rounded-full bg-[#FF9F0A] px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                {friends.length}
              </span>
            )}
          </div>

          <span className="w-14" />
        </header>

        {/* Username section */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 overflow-hidden rounded-[1.75rem] glass-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-base">@</span>
            <p className="text-sm font-black text-[#8a3f16]">اسم المستخدم العام</p>
          </div>
          <p className="mb-3 text-xs font-semibold text-[#bc7a45]">فريد عالمياً — يمكن تغييره مرة كل 24 ساعة.</p>
          <div className="flex gap-2.5">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-base font-black text-[#ea8c2f]">@</span>
              <Input value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)}
                placeholder="أدخل اسم المستخدم الخاص بك" className="pr-9" disabled={usernameBusy} />
            </div>
            <Button type="button" className="shrink-0 px-5" disabled={usernameBusy} onClick={() => void saveUsername()}>
              {usernameBusy ? "…" : "حفظ"}
            </Button>
          </div>
          {usernameErr ? (
            <p className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs font-bold text-red-700">{usernameErr}</p>
          ) : myUsername ? (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white">✓</span>
              اسمك الحالي: @{myUsername}
            </motion.p>
          ) : (
            <p className="mt-3 text-center text-xs font-bold text-amber-600">أنشئ اسم مستخدم للبحث وإرسال الطلبات.</p>
          )}
        </motion.section>

        {/* Search section */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-5 overflow-hidden rounded-[1.75rem] glass-card p-5">
          <p className="mb-3 text-sm font-black text-[#8a3f16]">🔍 بحث عن لاعبين</p>
          <div className="flex gap-2.5">
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder="أدخل اسم المستخدم للبحث (بدون @)" className="flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }} />
            <Button type="button" className="shrink-0 px-5" disabled={searchBusy} onClick={() => void runSearch()}>
              {searchBusy ? "…" : "بحث"}
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {hits.map((h) => (
                <motion.div key={h.uid} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                  className="list-item-card flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
                  <ProfileAvatar cosmetic={undefined} fallbackPhotoURL={h.photoURL} displayName={h.displayName} size="sm" idle />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#5e3011]">@{h.username}</p>
                    <p className="truncate text-xs text-[#bc7a45]">{h.displayName}</p>
                  </div>
                  <Button type="button" size="sm" className="shrink-0"
                    disabled={!myUsername || socialBusy === h.uid}
                    onClick={() => void sendRequest(h.uid)}>
                    {socialBusy === h.uid ? "…" : "إضافة"}
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Inbox */}
        <AnimatePresence>
          {inbox.length > 0 ? (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="mb-5 overflow-hidden rounded-[1.75rem] border border-[#ddd6fe]/60 bg-gradient-to-b from-[#faf5ff] to-[#f5f0fe] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_16px_36px_rgba(139,92,246,0.14)]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black text-[#5b21b6]">طلبات الصداقة</p>
                <span className="rounded-full bg-[#7c3aed] px-2.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                  {inbox.length}
                </span>
              </div>
              <ul className="space-y-2">
                {inbox.map((row) => (
                  <li key={row.fromUid}
                    className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/70 bg-white/90 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_rgba(139,92,246,0.10)]">
                    <ProfileAvatar cosmetic={undefined} fallbackPhotoURL={row.photoURL} displayName={row.displayName} size="sm" idle />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#5e3011]">{row.displayName}</p>
                      <p className="text-xs font-bold text-[#7c3aed]">@{row.username || "…"}</p>
                    </div>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <Button type="button" variant="ghost" size="sm" className="flex-1 text-xs"
                        disabled={socialBusy === row.fromUid} onClick={() => void respond(row.fromUid, false)}>
                        رفض
                      </Button>
                      <Button type="button" size="sm" className="flex-1 text-xs"
                        disabled={socialBusy === row.fromUid} onClick={() => void respond(row.fromUid, true)}>
                        قبول
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* Friends list */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="overflow-hidden rounded-[1.75rem] glass-card p-5">
          <p className="mb-4 text-sm font-black text-[#8a3f16]">قائمة الأصدقاء</p>

          {friends.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  background: "linear-gradient(135deg,#FFF8EE,#FFEDD8)",
                  boxShadow: "inset 0 0 0 1.5px rgba(244,196,141,0.5), 0 8px 22px rgba(196,134,82,0.14)",
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-[#d4a070]" aria-hidden>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M2 21c0-4 3.13-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M17 11v6M20 14h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-black text-[#8a3f16]">لا يوجد أصدقاء بعد</p>
                <p className="mt-1 text-xs font-semibold text-[#bc7a45]">ابحث عن لاعبين بالأعلى وأضفهم!</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {friends.map((f) => {
                const p = friendLive[f.friendUid];
                const raw = p?.gamePresence ?? "offline";
                const ts = p?.gamePresenceUpdatedAtMs
                  ? ({ toMillis: () => p.gamePresenceUpdatedAtMs! } as Timestamp)
                  : null;
                const eff = clientEffectivePresence(raw, ts);
                const isOnline = eff === "online" || eff === "in_lobby";
                const isActive = eff === "matchmaking" || eff === "in_match";
                const dotColor = isOnline ? "bg-emerald-400" : isActive ? "bg-amber-400" : "bg-slate-300";

                return (
                  <motion.li layout key={f.friendUid}
                    className="list-item-card flex items-center gap-3 rounded-2xl px-3.5 py-3">
                    <div className="relative shrink-0">
                      <ProfileAvatar cosmetic={p?.cosmetic} fallbackPhotoURL={null}
                        displayName={p?.displayName ?? undefined} size="md" idle active={isOnline} />
                      <motion.span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${dotColor}`}
                        animate={isOnline ? { scale: [1, 1.25, 1], opacity: [0.85, 1, 0.85] } : {}}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#5e3011]">
                        {p?.username ? `@${p.username}` : p?.displayName ?? f.friendUid.slice(0, 8)}
                      </p>
                      <p className={`text-[11px] font-bold ${isOnline ? "text-emerald-600" : isActive ? "text-amber-600" : "text-[#bc7a45]"}`}>
                        {presenceLabelAr(eff)}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm"
                      className="shrink-0 text-[11px] font-bold text-[#b45309]"
                      disabled={socialBusy === `rm:${f.friendUid}`}
                      onClick={() => void remove(f.friendUid)}>
                      إزالة
                    </Button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </motion.section>
      </div>
    </div>
  );
}
