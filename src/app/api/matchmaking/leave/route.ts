import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { leaveMatchmakingQueue } from "@/lib/server/matchmaking-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as { poolId?: string };
    const poolId = body.poolId?.trim() || "all";
    await leaveMatchmakingQueue(poolId, uid);
    return jsonOk({});
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    return jsonError(400, "تعذر مغادرة الانتظار");
  }
}
