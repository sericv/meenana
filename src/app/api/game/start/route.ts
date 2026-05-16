import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { startMatchForRoom } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { roomId?: string };
    if (!body.roomId) return jsonError(400, "roomId مطلوب");
    const { matchId } = await startMatchForRoom({ roomId: body.roomId, actingUid: uid });
    return jsonOk({ matchId });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
      return jsonError(
        503,
        "الخادم غير مهيأ. أضف مفتاح حساب الخدمة في FIREBASE_SERVICE_ACCOUNT_JSON.",
      );
    }
    const map: Record<string, string> = {
      ROOM_NOT_FOUND: "الغرفة غير موجودة",
      NOT_HOST: "فقط مضيف الغرفة يبدأ المباراة",
      ROOM_NOT_LOBBY: "الغرفة ليست في الانتظار",
      NEED_TWO_PLAYERS: "يلزم لاعبان",
      NOT_READY: "اللاعبون ليسوا جاهزين",
      NOT_ENOUGH_CARDS: "لا توجد بطاقات كافية في التصنيف",
      CUSTOM_CARDS_INVALID: "البطاقات المخصصة غير مكتملة أو غير صالحة",
      CUSTOM_OPPONENT_INCOMPLETE: "يلزم أن يختار كل لاعب بطاقة للخصم قبل البدء",
      CUSTOM_OPPONENT_INVALID: "بطاقة مخصصة غير صالحة",
      CUSTOM_IMAGE_TOO_LARGE: "صورة بطاقة مخصصة كبيرة جداً في الغرفة — احذف البطاقات وأعد حفظها من الانتظار",
    };
    return jsonError(400, map[msg] ?? "تعذر بدء المباراة");
  }
}
