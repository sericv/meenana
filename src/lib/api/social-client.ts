"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

async function parseJson(res: Response): Promise<{ ok?: boolean; error?: string } & Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { ok?: boolean; error?: string } & Record<string, unknown>;
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
}

export async function postSocial<T extends Record<string, unknown>>(
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
  const j = await parseJson(res);
  if (!j.ok) throw new Error(j.error ?? "فشل الطلب");
  return j as T & { ok: true };
}

export async function getSocial<T extends Record<string, unknown>>(path: string): Promise<T & { ok: true }> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("يجب تسجيل الدخول");
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await parseJson(res);
  if (!j.ok) throw new Error(j.error ?? "فشل الطلب");
  return j as T & { ok: true };
}
