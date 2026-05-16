import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { respondRoomInvite } from "@/lib/server/social-server";
import { AdminConfigError } from "@/lib/firebase/admin";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { inviteId?: string; accept?: boolean };
    const inviteId = String(body.inviteId ?? "").trim();
    const accept = Boolean(body.accept);
    if (!inviteId) throw new HttpError(400, "معرّف الدعوة مفقود.");
    const res = await respondRoomInvite({ toUid: uid, inviteId, accept });
    return jsonOk({ roomId: res.roomId ?? null });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) return jsonError(503, "الخادم غير مهيأ.");
    return jsonError(400, "تعذر الرد على الدعوة.");
  }
}
