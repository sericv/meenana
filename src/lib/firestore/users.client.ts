"use client";

import type { User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col } from "@/lib/firestore/paths";
import { DEFAULT_AVATAR_ID, DEFAULT_FRAME_ID, isValidAvatarId, isValidFrameId } from "@/lib/profile/cosmetics";

export async function upsertUserDocument(user: User) {
  const db = getFirebaseDb();
  const ref = doc(db, col.users, user.uid);
  const displayFromEmail =
    user.displayName?.trim() ||
    (user.email ? user.email.split("@")[0]?.trim() : "") ||
    "";
  await setDoc(
    ref,
    {
      displayName: displayFromEmail || "زائر",
      photoURL: user.photoURL || null,
      isGuest: user.isAnonymous,
      lastSeen: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Persist cosmetic choices (illustrated avatar preset + animated frame). */
export async function updateUserCosmetics(
  uid: string,
  patch: { avatarId?: string; avatarFrameId?: string },
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, col.users, uid);
  const avatarId =
    patch.avatarId && isValidAvatarId(patch.avatarId) ? patch.avatarId : DEFAULT_AVATAR_ID;
  const avatarFrameId =
    patch.avatarFrameId && isValidFrameId(patch.avatarFrameId)
      ? patch.avatarFrameId
      : DEFAULT_FRAME_ID;
  await setDoc(
    ref,
    {
      avatarId,
      avatarFrameId,
      lastSeen: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Set profile photo URL from Google/email provider or clear to use illustrated preset. */
export async function updateUserPhotoURL(uid: string, photoURL: string | null): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, col.users, uid);
  await setDoc(
    ref,
    {
      photoURL: photoURL ?? null,
      lastSeen: serverTimestamp(),
    },
    { merge: true },
  );
}
