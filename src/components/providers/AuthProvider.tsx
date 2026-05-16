"use client";

import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  getRedirectResult,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildEmailLinkContinueUrl,
  EMAIL_FOR_SIGN_IN_KEY,
  EMAIL_LINK_NEXT_KEY,
  isValidSignInEmail,
  normalizeEmailForSignIn,
} from "@/lib/auth/email-link";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { upsertUserDocument } from "@/lib/firestore/users.client";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { isInAppBrowser } from "@/lib/auth/google-sign-in-strategy";

export type EmailLinkBanner = { kind: "success" | "error" | "info"; text: string };

type AuthState = {
  user: User | null;
  loading: boolean;
  /** True while the URL is an email sign-in link and we still need the user to type their email (e.g. opened on a new device). */
  needsEmailLinkEmail: boolean;
  emailLinkBanner: EmailLinkBanner | null;
  signInGoogle: () => Promise<void>;
  sendSignInEmailLink: (email: string) => Promise<void>;
  completeSignInWithEmailLink: (email: string) => Promise<void>;
  clearEmailLinkBanner: () => void;
  signInGuest: () => Promise<void>;
  logout: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

function readStoredEmailForLink(): string | null {
  if (typeof window === "undefined") return null;
  const a = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  const b = window.sessionStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  const raw = a || b;
  return raw ? normalizeEmailForSignIn(raw) : null;
}

function clearStoredEmailLinkKeys(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  window.sessionStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  window.localStorage.removeItem(EMAIL_LINK_NEXT_KEY);
  window.sessionStorage.removeItem(EMAIL_LINK_NEXT_KEY);
}

/** Read `next`, strip link params from the address bar to `/login?...`, then clear stored keys. */
function finishEmailLinkNavigation(): void {
  if (typeof window === "undefined") return;
  const next =
    window.sessionStorage.getItem(EMAIL_LINK_NEXT_KEY) ||
    window.localStorage.getItem(EMAIL_LINK_NEXT_KEY) ||
    new URLSearchParams(window.location.search).get("next") ||
    "/";
  clearStoredEmailLinkKeys();
  const q = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  window.history.replaceState({}, "", `/login${q}`);
}

function firebaseAuthMessage(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = String((e as { code: unknown }).code);
    if (code === "auth/invalid-email") return "عنوان البريد غير صالح.";
    if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") {
      return "انتهت صلاحية الرابط أو أنه غير صالح. اطلب رابطاً جديداً من صفحة الدخول.";
    }
    if (code === "auth/user-disabled") return "هذا الحساب معطّل.";
    if (code === "auth/network-request-failed") return "تعذر الاتصال. تحقق من الشبكة وحاول مرة أخرى.";
  }
  if (e instanceof Error && e.message) return e.message;
  return "تعذر إكمال تسجيل الدخول.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useVisualViewport();

  const googleAuthLock = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailLinkEmail, setNeedsEmailLinkEmail] = useState(false);
  const [emailLinkBanner, setEmailLinkBanner] = useState<EmailLinkBanner | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let unsub: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        await (auth as { authStateReady?: () => Promise<void> }).authStateReady?.();
        // Pass browserPopupRedirectResolver explicitly — required when initializeAuth
        // was used (even though we now also configure it there, belt-and-suspenders).
        const redirectResult = await getRedirectResult(auth, browserPopupRedirectResolver);
        if (redirectResult?.user) {
          console.log("[auth] redirect sign-in completed for", redirectResult.user.uid);
        }
      } catch (e) {
        const code =
          e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
        console.warn("[auth] getRedirectResult error:", code, e);
        // Surface real errors (not the benign "no pending redirect" noise).
        if (code && code !== "auth/no-auth-event" && code !== "auth/null-user") {
          setEmailLinkBanner({ kind: "error", text: firebaseAuthMessage(e) });
        }
      }

      if (cancelled) return;

      if (typeof window !== "undefined" && isSignInWithEmailLink(auth, window.location.href)) {
        const stored = readStoredEmailForLink();
        if (stored) {
          try {
            await signInWithEmailLink(auth, stored, window.location.href);
            finishEmailLinkNavigation();
            setEmailLinkBanner({ kind: "success", text: "تم تسجيل الدخول عبر البريد." });
          } catch (e) {
            finishEmailLinkNavigation();
            setEmailLinkBanner({ kind: "error", text: firebaseAuthMessage(e) });
          }
        } else {
          setNeedsEmailLinkEmail(true);
        }
      }

      if (cancelled) return;

      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
        if (u) {
          setNeedsEmailLinkEmail(false);
          void upsertUserDocument(u).catch(() => undefined);
        }
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const signInGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (googleAuthLock.current) {
      console.log("[auth] signInGoogle: already in progress, ignoring");
      return;
    }
    googleAuthLock.current = true;
    try {
      // In-app browsers (Instagram, Facebook, TikTok, …) block both popups and
      // redirects. Surface a clear message so the user knows to switch browsers.
      if (isInAppBrowser()) {
        console.warn("[auth] signInGoogle: in-app browser detected");
        throw Object.assign(
          new Error("افتح الصفحة في Safari أو Chrome لتسجيل الدخول عبر Google."),
          { code: "auth/in-app-browser" },
        );
      }

      const provider = new GoogleAuthProvider();
      provider.addScope("profile");
      provider.addScope("email");
      // Always request account picker — needed for account switching on all platforms.
      provider.setCustomParameters({ prompt: "select_account" });

      console.log("[auth] signInGoogle: attempting popup");
      try {
        // Popup-first on ALL platforms (mobile Chrome, iOS Safari 15+, desktop).
        // Pass resolver explicitly — required when auth was created with initializeAuth.
        await signInWithPopup(auth, provider, browserPopupRedirectResolver);
        console.log("[auth] signInGoogle: popup succeeded");
        return;
      } catch (e: unknown) {
        const code =
          e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";

        // User deliberately closed the picker — treat as cancellation, not an error.
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          console.log("[auth] signInGoogle: popup closed by user");
          return;
        }

        // Popup was blocked by the browser → fall back to full-page redirect.
        if (
          code === "auth/popup-blocked" ||
          code === "auth/operation-not-supported-in-this-environment"
        ) {
          console.log("[auth] signInGoogle: popup blocked, falling back to redirect");
          // Pass resolver explicitly here too (belt-and-suspenders with initializeAuth config).
          await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
          return;
        }

        // Any other error (network, auth-domain mis-config, etc.) — rethrow so
        // the caller can surface it to the user.
        console.error("[auth] signInGoogle: popup error:", code, e);
        throw e;
      }
    } finally {
      googleAuthLock.current = false;
    }
  }, []);

  const sendSignInEmailLink = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    const normalized = normalizeEmailForSignIn(email);
    if (!isValidSignInEmail(normalized)) {
      throw new Error("عنوان البريد غير صالح.");
    }
    if (typeof window === "undefined") throw new Error("يُستخدم فقط في المتصفح.");

    const next = new URLSearchParams(window.location.search).get("next") || "/";
    const envUrl = process.env.NEXT_PUBLIC_EMAIL_SIGNIN_CONTINUE_URL?.trim();
    const continueUrl = envUrl || buildEmailLinkContinueUrl(window.location.origin, next);

    await sendSignInLinkToEmail(auth, normalized, {
      url: continueUrl,
      handleCodeInApp: true,
    });

    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, normalized);
    window.sessionStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, normalized);
    window.sessionStorage.setItem(EMAIL_LINK_NEXT_KEY, next);
    window.localStorage.setItem(EMAIL_LINK_NEXT_KEY, next);
  }, []);

  const completeSignInWithEmailLink = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    if (typeof window === "undefined") return;
    const normalized = normalizeEmailForSignIn(email);
    if (!isValidSignInEmail(normalized)) {
      throw new Error("عنوان البريد غير صالح.");
    }
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      throw new Error("لا يوجد رابط تسجيل صالح في هذا العنوان. اطلب رابطاً جديداً.");
    }
    try {
      await signInWithEmailLink(auth, normalized, window.location.href);
      finishEmailLinkNavigation();
      setNeedsEmailLinkEmail(false);
      setEmailLinkBanner({ kind: "success", text: "تم تسجيل الدخول عبر البريد." });
    } catch (e) {
      finishEmailLinkNavigation();
      setNeedsEmailLinkEmail(false);
      setEmailLinkBanner({ kind: "error", text: firebaseAuthMessage(e) });
    }
  }, []);

  const clearEmailLinkBanner = useCallback(() => {
    setEmailLinkBanner(null);
  }, []);

  const signInGuest = useCallback(async () => {
    const auth = getFirebaseAuth();
    await signInAnonymously(auth);
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) throw new Error("يجب تسجيل الدخول");
    const trimmed = name.trim().slice(0, 40);
    if (trimmed.length < 1) throw new Error("اسم غير صالح");
    await updateProfile(u, { displayName: trimmed });
    await upsertUserDocument(u);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      needsEmailLinkEmail,
      emailLinkBanner,
      signInGoogle,
      sendSignInEmailLink,
      completeSignInWithEmailLink,
      clearEmailLinkBanner,
      signInGuest,
      logout,
      setDisplayName,
    }),
    [
      user,
      loading,
      needsEmailLinkEmail,
      emailLinkBanner,
      signInGoogle,
      sendSignInEmailLink,
      completeSignInWithEmailLink,
      clearEmailLinkBanner,
      signInGuest,
      logout,
      setDisplayName,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
