import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { replayEndedPrivateRoom } from "@/lib/server/room-lifecycle";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { roomId?: string };
    if (!body.roomId) return jsonError(400, "roomId مطلوب");
    await replayEndedPrivateRoom({ roomId: body.roomId, actingUid: uid });
    return jsonOk({});
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    const map: Record<string, string> = {
      ROOM_NOT_FOUND: "الغرفة غير موجودة",
      NOT_IN_ROOM: "أنت لست في هذه الغرفة",
      NOT_ENDED: "لا يمكن إعادة اللعب الآن",
      NO_REPLAY: "إعادة اللعب غير متاحة لهذه الغرفة",
    };
    return jsonError(400, map[msg] ?? "تعذر إعادة اللعب");
  }
}
