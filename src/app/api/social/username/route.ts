import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { setUsernameForUid } from "@/lib/server/social-server";
import { AdminConfigError } from "@/lib/firebase/admin";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { username?: string };
    const username = String(body.username ?? "");
    const res = await setUsernameForUid(uid, username);
    return jsonOk({ username: res.username });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) return jsonError(503, "الخادم غير مهيأ.");
    return jsonError(400, "تعذر حفظ اسم المستخدم.");
  }
}
