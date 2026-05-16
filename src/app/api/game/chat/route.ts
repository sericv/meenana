import { CHAT_COOLDOWN_MS } from "@/lib/game/constants";
import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { enforceChatRate, handleChat } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as {
      roomId?: string;
      matchId?: string;
      text?: string;
      displayName?: string;
    };
    if (!body.roomId || !body.matchId || !body.text?.trim()) {
      return jsonError(400, "بيانات ناقصة");
    }
    await enforceChatRate(body.roomId, uid, CHAT_COOLDOWN_MS);
    await handleChat({
      roomId: body.roomId,
      matchId: body.matchId,
      uid,
      displayName: body.displayName?.trim() || "لاعب",
      text: body.text.trim().slice(0, 500),
    });
    return jsonOk({});
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    if (msg === "RATE_LIMIT") return jsonError(429, "بطء قليلاً بين الرسائل");
    if (msg.includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
      return jsonError(503, "الخادم غير مهيأ لإرسال الدردشة");
    }
    const map: Record<string, string> = {
      MATCH_NOT_FOUND: "المباراة غير موجودة",
      MATCH_ENDED: "انتهت المباراة",
      NOT_YOUR_TURN: "ليس دورك الآن",
      NOT_IN_MATCH: "لست ضمن هذه المباراة",
      TURN_EXPIRED: "انتهى وقت دورك",
    };
    return jsonError(400, map[msg] ?? "تعذر إرسال الرسالة");
  }
}
