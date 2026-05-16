/** Keys for Email Link (passwordless) sign-in — must match AuthProvider + login page. */
export const EMAIL_FOR_SIGN_IN_KEY = "whomai_emailForSignIn";
export const EMAIL_LINK_NEXT_KEY = "whomai_emailLinkNext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailForSignIn(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidSignInEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmailForSignIn(email));
}

/** Build the continue URL Firebase opens after the user taps the email link (same origin, `/login`). */
export function buildEmailLinkContinueUrl(origin: string, nextPath: string): string {
  const base = origin.replace(/\/$/, "");
  const next = (nextPath || "/").trim() || "/";
  if (next === "/") return `${base}/login`;
  return `${base}/login?next=${encodeURIComponent(next)}`;
}
