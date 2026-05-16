import { AdminConfigError, getAdminAuth } from "@/lib/firebase/admin";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUidFromRequest(req: Request): Promise<string> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) {
    throw new HttpError(401, "غير مصرح: يجب تسجيل الدخول أولاً.");
  }
  const token = h.slice("Bearer ".length).trim();
  if (!token) throw new HttpError(401, "غير مصرح: رمز الدخول مفقود.");

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof AdminConfigError) {
      throw new HttpError(503, "إعدادات Firebase Admin ناقصة أو غير صالحة على الخادم.");
    }

    const code = (err as { code?: string } | undefined)?.code;
    if (code === "auth/id-token-expired") {
      throw new HttpError(401, "غير مصرح: انتهت صلاحية جلسة الدخول. أعد تسجيل الدخول.");
    }
    if (code === "auth/argument-error" || code === "auth/invalid-id-token") {
      throw new HttpError(401, "غير مصرح: رمز الدخول غير صالح.");
    }
    throw new HttpError(401, "غير مصرح: تعذر التحقق من رمز الدخول.");
  }
}

export function jsonError(status: number, message: string) {
  return Response.json({ ok: false, error: message }, { status });
}

export function jsonOk(data: Record<string, unknown>) {
  return Response.json({ ok: true, ...data });
}
