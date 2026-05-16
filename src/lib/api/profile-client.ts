"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

function parseJson(text: string): { ok?: boolean; error?: string; photoURL?: string } {
  if (!text) return {};
  try {
    return JSON.parse(text) as { ok?: boolean; error?: string; photoURL?: string };
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
}

/**
 * Uploads a JPEG base64 payload to the server; returns the public Storage URL written to Firestore.
 * Uses XMLHttpRequest so `onProgress` can reflect upload bytes (mobile-friendly).
 */
export async function uploadProfileAvatarImage(
  imageBase64: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("يجب تسجيل الدخول.");
  const token = await user.getIdToken(true);
  const body = JSON.stringify({ imageBase64 });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/profile/avatar");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable || e.total <= 0) return;
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };

    xhr.onload = () => {
      const j = parseJson(xhr.responseText ?? "");
      if (xhr.status >= 200 && xhr.status < 300 && j.ok && typeof j.photoURL === "string") {
        onProgress?.(100);
        resolve(j.photoURL);
        return;
      }
      reject(new Error(j.error ?? "تعذر رفع الصورة."));
    };
    xhr.onerror = () => reject(new Error("تعذر الاتصال بالخادم."));
    xhr.send(body);
  });
}
