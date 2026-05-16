import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { sendFriendRequest } from "@/lib/server/social-server";
import { AdminConfigError } from "@/lib/firebase/admin";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { toUid?: string };
    const toUid = String(body.toUid ?? "").trim();
    if (!toUid) throw new HttpError(400, "معرّف اللاعب مفقود.");
    await sendFriendRequest(uid, toUid);
    return jsonOk({});
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) return jsonError(503, "الخادم غير مهيأ.");
    return jsonError(400, "تعذر إرسال الطلب.");
  }
}
