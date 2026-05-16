import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { sendRoomInvite } from "@/lib/server/social-server";
import { AdminConfigError } from "@/lib/firebase/admin";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { roomId?: string; toUid?: string; message?: string };
    const roomId = String(body.roomId ?? "").trim();
    const toUid = String(body.toUid ?? "").trim();
    const message = body.message != null ? String(body.message) : undefined;
    if (!roomId || !toUid) throw new HttpError(400, "بيانات الدعوة ناقصة.");
    const res = await sendRoomInvite({ fromUid: uid, toUid, roomId, message });
    return jsonOk({ inviteId: res.inviteId });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) return jsonError(503, "الخادم غير مهيأ.");
    return jsonError(400, "تعذر إرسال الدعوة.");
  }
}
