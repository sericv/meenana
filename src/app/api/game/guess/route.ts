import { CHAT_COOLDOWN_MS } from "@/lib/game/constants";
import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { enforceChatRate, handleGuess } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = (await req.json()) as {
      roomId?: string;
      matchId?: string;
      guess?: string;
      displayName?: string;
    };
    if (!body.roomId || !body.matchId || !body.guess?.trim()) {
      return jsonError(400, "بيانات ناقصة");
    }
    // Slightly longer cooldown for guesses to prevent spam
    await enforceChatRate(body.roomId, uid, CHAT_COOLDOWN_MS * 5);
    const result = await handleGuess({
      roomId: body.roomId,
      matchId: body.matchId,
      uid,
      displayName: body.displayName?.trim() || "لاعب",
      guess: body.guess.trim(),
    });
    return jsonOk(result);
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    if (msg === "RATE_LIMIT") return jsonError(429, "انتظر قليلاً قبل التخمين مجدداً");
    const map: Record<string, string> = {
      MATCH_NOT_FOUND: "المباراة غير موجودة",
      MATCH_ENDED: "انتهت المباراة",
      NO_HIDDEN_CARD: "لم يتم تعيين بطاقتك بعد",
      NOT_YOUR_TURN_GUESS: "يمكن التخمين فقط في دورك",
    };
    return jsonError(400, map[msg] ?? "تعذر إرسال التخمين");
  }
}
