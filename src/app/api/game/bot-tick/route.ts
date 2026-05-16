import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { botTick } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { roomId?: string };
    if (!body.roomId) return jsonError(400, "roomId مطلوب");
    const result = await botTick({ roomId: body.roomId, callerUid: uid });
    return jsonOk(result);
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    return jsonError(400, msg || "تعذر تشغيل البوت");
  }
}
