import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { handleLeaveMatch } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { roomId?: string };
    if (!body.roomId) return jsonError(400, "بيانات ناقصة");
    await handleLeaveMatch({ roomId: body.roomId, uid });
    return jsonOk({});
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    const map: Record<string, string> = {
      ROOM_NOT_FOUND: "الغرفة غير موجودة",
      NOT_IN_ROOM: "أنت لست في هذه الغرفة",
      NO_OPPONENT: "لا يوجد خصم",
      MATCH_NOT_FOUND: "المباراة غير موجودة",
      MATCH_ALREADY_ENDED: "المباراة منتهية",
    };
    return jsonError(400, map[msg] ?? "تعذر المغادرة");
  }
}
