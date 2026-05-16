import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { revealMatchCards } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { roomId?: string };
    if (!body.roomId) return jsonError(400, "roomId مطلوب");
    const result = await revealMatchCards({ roomId: body.roomId, uid });
    return jsonOk(result);
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    const map: Record<string, string> = {
      ROOM_NOT_FOUND: "الغرفة غير موجودة",
      NOT_IN_ROOM: "لست في هذه الغرفة",
      MATCH_NOT_STARTED: "المباراة لم تبدأ بعد",
    };
    return jsonError(400, map[msg] ?? "تعذر جلب البطاقات");
  }
}
