/**
 * Detect in-app browsers (Instagram, Facebook, TikTok, Twitter/X, WhatsApp,
 * WeChat, Snapchat, LinkedIn app, Google Search App, …).
 *
 * These browsers intercept all navigations and block both window.open() popups
 * AND full-page OAuth redirects. The only fix for the user is to open the page
 * in their real browser (Safari / Chrome).
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Twitter\/|LinkedInApp|TikTok|Snapchat|WhatsApp|Line\/|MicroMessenger|GSA\//.test(ua);
}

/**
 * Prefer redirect-based Google OAuth as a fallback when popups are unavailable.
 * Kept for reference; signInGoogle() now tries popup first on all platforms.
 */
export function preferGoogleAuthRedirect(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ can report as desktop Safari.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  // Desktop Safari (not Chrome/Firefox/Edge): popups + COOP are unreliable; use full-page redirect.
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua);
  if (isSafari) return true;
  return false;
}
