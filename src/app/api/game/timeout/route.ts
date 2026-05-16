import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { handleTurnTimeout } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { roomId?: string; matchId?: string };
    if (!body.roomId || !body.matchId) return jsonError(400, "بيانات ناقصة");

    const out = await handleTurnTimeout({
      roomId: body.roomId,
      matchId: body.matchId,
      uid,
    });
    return jsonOk(out);
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (String(e).includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
      return jsonError(503, "الخادم غير مهيأ");
    }
    return jsonError(400, "تعذر معالجة المؤقت");
  }
}
