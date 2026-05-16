import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { deleteMatchmakingResult } from "@/lib/server/matchmaking-server";

/** Clear server-side matchmaking redirect doc after navigation (optional hygiene). */
export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    await deleteMatchmakingResult(uid);
    return jsonOk({});
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    return jsonError(400, "تعذر التأكيد");
  }
}
