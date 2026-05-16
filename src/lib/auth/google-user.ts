import type { User } from "firebase/auth";

export function isGoogleLinkedUser(user: User | null | undefined): boolean {
  if (!user || user.isAnonymous) return false;
  return user.providerData.some((p) => p.providerId === "google.com");
}

/** Google OAuth or Email Link (Firebase `password` provider with a verified email sign-in). */
export function isFullAccountUser(user: User | null | undefined): boolean {
  if (!user || user.isAnonymous) return false;
  if (user.providerData.some((p) => p.providerId === "google.com")) return true;
  if (user.email && user.providerData.some((p) => p.providerId === "password")) return true;
  return false;
}
