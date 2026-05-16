import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { AdminConfigError } from "@/lib/firebase/admin";
import { joinMatchmakingQueue } from "@/lib/server/matchmaking-server";
import { DEFAULT_CATEGORY_ID } from "@/lib/game/categories";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as {
      poolId?: string;
      categoryId?: string;
      displayName?: string;
    };
    const poolId = body.poolId?.trim() || "all";
    const categoryId = body.categoryId?.trim() || DEFAULT_CATEGORY_ID;
    const displayName = body.displayName?.trim() || "لاعب";

    const result = await joinMatchmakingQueue({
      poolId,
      uid,
      displayName,
      categoryId,
    });

    if (result.status === "waiting") {
      return jsonOk({ status: "waiting" });
    }
    return jsonOk({ status: "matched", roomId: result.roomId });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) {
      return jsonError(503, "الخادم غير مهيأ لمطابقة اللاعبين.");
    }
    return jsonError(400, "تعذر الانضمام لقائمة الانتظار");
  }
}
