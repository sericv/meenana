"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, startTransition, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isValidSignInEmail, normalizeEmailForSignIn } from "@/lib/auth/email-link";

function LoginInner() {
  const {
    signInGoogle,
    signInGuest,
    sendSignInEmailLink,
    completeSignInWithEmailLink,
    user,
    loading,
    needsEmailLinkEmail,
    emailLinkBanner,
    clearEmailLinkBanner,
    logout,
  } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next") || "/", [params]);
  /** Stay on this screen to pick another Google / full account (avoids instant redirect). */
  const switchAccount = useMemo(() => params.get("switch") === "1", [params]);

  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [completeEmail, setCompleteEmail] = useState("");
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeErr, setCompleteErr] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleErr, setGoogleErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    // Guests must stay here to attach Google / email; full users may stay to switch account.
    if (user.isAnonymous || switchAccount) return;
    const id = requestAnimationFrame(() => {
      startTransition(() => {
        router.replace(next);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [loading, user, router, next, switchAccount]);

  const onSendLink = async () => {
    setEmailErr(null);
    setEmailSent(false);
    const n = normalizeEmailForSignIn(email);
    if (!isValidSignInEmail(n)) {
      setEmailErr("أدخل بريداً إلكترونياً صالحاً.");
      return;
    }
    setEmailBusy(true);
    try {
      await sendSignInEmailLink(n);
      setEmailSent(true);
    } catch (e) {
      setEmailErr(e instanceof Error ? e.message : "تعذر إرسال الرابط.");
    } finally {
      setEmailBusy(false);
    }
  };

  const onCompleteLink = async () => {
    setCompleteErr(null);
    const n = normalizeEmailForSignIn(completeEmail);
    if (!isValidSignInEmail(n)) {
      setCompleteErr("أدخل نفس البريد الذي طلبت منه الرابط.");
      return;
    }
    setCompleteBusy(true);
    try {
      await completeSignInWithEmailLink(n);
    } catch (e) {
      setCompleteErr(e instanceof Error ? e.message : "تعذر إكمال الدخول.");
    } finally {
      setCompleteBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-full overflow-x-hidden px-4 py-10 sm:px-6"
      style={{
        background: "radial-gradient(120% 70% at 50% 0%, #FFF1DF 0%, #FCE8D2 55%, #FFEFD8 100%)",
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-16 top-20 h-56 w-56 rounded-full bg-[#FFCB8A]/40 blur-3xl" />
        <div className="absolute -left-20 bottom-24 h-72 w-72 rounded-full bg-[#FFB574]/35 blur-3xl" />
      </div>

        <div className="relative z-10 mx-auto w-full max-w-md sm:max-w-lg">
        {user && !user.isAnonymous && switchAccount ? (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm font-bold text-[#92400e] shadow-sm"
          >
            <p className="leading-relaxed">
              أنت مسجّل الدخول حالياً. للمتابعة بنفس الحساب اضغط «متابعة»، أو سجّل الخروج ثم اختر حساباً
              آخر.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-[48px] flex-1 font-black"
                onClick={() => {
                  startTransition(() => router.replace(next));
                }}
              >
                متابعة
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-[48px] flex-1 font-black text-[#b45309] ring-1 ring-[#f4d4b0]"
                onClick={() => void logout().then(() => router.replace("/login"))}
              >
                تسجيل الخروج
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mb-6 text-center">
          <h1
            className="text-3xl font-black tracking-tight sm:text-4xl"
            style={{
              background: "linear-gradient(180deg,#FF9F0A 0%,#E0660A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            تسجيل الدخول
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#a16231] sm:text-base">
            ادخل بسرعة وتابع اللعب — Google أو رابط بريدك بدون كلمة مرور.
          </p>
        </div>

        {emailLinkBanner ? (
          <div
            role="alert"
            className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${
              emailLinkBanner.kind === "success"
                ? "border-emerald-200/80 bg-emerald-50/95 text-emerald-900"
                : emailLinkBanner.kind === "error"
                  ? "border-red-200/80 bg-red-50/95 text-red-900"
                  : "border-amber-200/80 bg-amber-50/95 text-amber-950"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1">{emailLinkBanner.text}</span>
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-black text-current underline-offset-2 hover:underline"
                onClick={() => clearEmailLinkBanner()}
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_44px_rgba(196,134,82,0.22)] sm:p-6">
          <Button
            type="button"
            className="min-h-[52px] w-full text-base font-black shadow-[0_8px_24px_rgba(234,140,47,0.35)]"
            disabled={loading || googleBusy}
            onClick={() => {
              if (googleBusy) return;
              setGoogleBusy(true);
              setGoogleErr(null);
              void signInGoogle()
                .catch((e: unknown) => {
                  const code =
                    e && typeof e === "object" && "code" in e
                      ? String((e as { code: unknown }).code)
                      : "";
                  // User closed the picker intentionally — not an error.
                  if (
                    code === "auth/popup-closed-by-user" ||
                    code === "auth/cancelled-popup-request"
                  ) {
                    return;
                  }
                  const msg =
                    code === "auth/in-app-browser"
                      ? "افتح هذه الصفحة في Safari أو Chrome لتسجيل الدخول عبر Google."
                      : e instanceof Error && e.message
                        ? e.message
                        : "تعذر فتح Google. تحقق من الاتصال وحاول مجدداً.";
                  setGoogleErr(msg);
                })
                .finally(() => setGoogleBusy(false));
            }}
          >
            {googleBusy ? "جاري فتح Google…" : "المتابعة عبر Google"}
          </Button>
          {googleErr ? (
            <p role="alert" className="text-center text-sm font-bold text-red-700">
              {googleErr}
            </p>
          ) : null}

          <div className="relative py-1 text-center">
            <span className="relative z-10 inline-block rounded-full bg-white px-3 text-xs font-black text-[#bc7a45]">
              أو
            </span>
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-[#f4d4b0]" />
          </div>

          {needsEmailLinkEmail ? (
            <div className="rounded-2xl border border-[#ede9fe] bg-[#faf5ff]/90 p-4">
              <p className="text-sm font-black text-[#5b21b6]">إكمال الدخول بالبريد</p>
              <p className="mt-1 text-xs font-semibold text-[#6b21a8]/90">
                افتح الرابط من نفس الجهاز إن أمكن. إن فتحته من جهاز آخر، أدخل البريد الذي استخدمته لطلب
                الرابط.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  className="min-h-[48px] flex-1 font-medium"
                  placeholder="you@example.com"
                  value={completeEmail}
                  onChange={(e) => setCompleteEmail(e.target.value)}
                  disabled={completeBusy}
                />
                <Button
                  type="button"
                  className="min-h-[48px] shrink-0 px-5 font-black"
                  disabled={completeBusy}
                  onClick={() => void onCompleteLink()}
                >
                  {completeBusy ? "…" : "تأكيد الدخول"}
                </Button>
              </div>
              {completeErr ? <p className="mt-2 text-xs font-bold text-red-700">{completeErr}</p> : null}
            </div>
          ) : (
            <div>
              <p className="text-sm font-black text-[#8a3f16]">تسجيل الدخول بالبريد</p>
              <p className="mt-1 text-xs font-semibold text-[#bc7a45]">
                نرسل لك رابطاً آمناً — انقره من بريدك لتسجيل الدخول فوراً (بدون كلمة مرور).
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  className="min-h-[48px] flex-1 font-medium"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={emailBusy || emailSent}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onSendLink();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[48px] shrink-0 bg-gradient-to-b from-[#fff7ed] to-[#ffedd5] px-5 font-black text-[#9a3412] shadow-inner ring-1 ring-[#f4d4b0]"
                  disabled={emailBusy || emailSent}
                  onClick={() => void onSendLink()}
                >
                  {emailBusy ? "جاري الإرسال…" : emailSent ? "تم الإرسال" : "إرسال الرابط"}
                </Button>
              </div>
              {emailErr ? <p className="mt-2 text-xs font-bold text-red-700">{emailErr}</p> : null}
              {emailSent ? (
                <p className="mt-3 rounded-xl bg-emerald-50/90 px-3 py-2 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200/80">
                  تم إرسال الرابط. افتح بريدك وانقر الرابط هنا في هذا المتصفح. إن لم يصل خلال دقيقة، تحقق من
                  مجلد الرسائل غير المرغوبة.
                </p>
              ) : null}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="min-h-[48px] w-full font-bold text-[#b45309]"
            disabled={loading}
            onClick={() => void signInGuest()}
          >
            دخول كزائر
          </Button>

          <Link
            className="block text-center text-sm font-bold text-[#ea8c2f] underline-offset-4 hover:underline"
            href="/"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[100dvh] items-center justify-center text-sm font-bold text-[#a16231]"
          style={{
            background: "radial-gradient(120% 70% at 50% 0%, #FFF1DF 0%, #FCE8D2 55%, #FFEFD8 100%)",
          }}
        >
          جاري التحميل…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
