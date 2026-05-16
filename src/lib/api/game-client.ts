"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

export async function postGame<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<T & { ok: true }> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("يجب تسجيل الدخول");
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let j: { ok?: boolean; error?: string } & Record<string, unknown> = {};
  try {
    j = text ? (JSON.parse(text) as typeof j) : {};
  } catch {
    if (res.status === 413 || res.status === 431) {
      throw new Error("حجم الطلب كبير جداً — جرّب صورة أصغر أو أبسط");
    }
    if (res.status >= 500) {
      throw new Error("فشل حفظ الصورة — خطأ في الخادم، حاول مجدداً");
    }
    throw new Error(text?.slice(0, 200) || "فشل حفظ الصورة");
  }

  if (!j.ok) {
    const err = j.error ?? "فشل حفظ الصورة";
    if (res.status === 413 || res.status === 431) {
      throw new Error("حجم الطلب كبير جداً — جرّب صورة أصغر أو أبسط");
    }
    throw new Error(err);
  }
  return j as T & { ok: true };
}
