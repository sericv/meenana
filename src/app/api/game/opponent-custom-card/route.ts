import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { setOpponentCustomCard } from "@/lib/server/game-server";

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    let body: {
      roomId?: string;
      card?: {
        id?: string;
        nameAr?: string;
        name?: string;
        imageUrl?: string;
        aliases?: string[];
      };
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return jsonError(
        413,
        "حجم البيانات كبير جداً أو الطلب غير صالح — جرّب صورة أصغر ثم أعد المحاولة.",
      );
    }
    if (!body.roomId) return jsonError(400, "roomId مطلوب");
    if (!body.card?.nameAr || !body.card?.imageUrl) return jsonError(400, "بيانات البطاقة ناقصة");
    await setOpponentCustomCard({
      roomId: body.roomId,
      uid,
      card: {
        id: body.card.id,
        nameAr: body.card.nameAr,
        name: body.card.name,
        imageUrl: body.card.imageUrl,
        aliases: body.card.aliases,
      },
    });
    return jsonOk({});
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    const msg = String(e instanceof Error ? e.message : e);
    const map: Record<string, string> = {
      ROOM_NOT_FOUND: "الغرفة غير موجودة",
      ROOM_NOT_LOBBY: "لا يمكن التعديل خارج الانتظار",
      NOT_IN_ROOM: "أنت لست في هذه الغرفة",
      CUSTOM_NOT_ENABLED: "البطاقات المخصصة غير مفعّلة هنا",
      WAIT_FOR_OPPONENT: "انتظر انضمام الخصم أولاً",
      CUSTOM_OPPONENT_INVALID: "بيانات الصورة أو الاسم غير صالحة",
      CUSTOM_IMAGE_TOO_LARGE: "صورة البطاقة كبيرة جداً للحفظ — أعد رفع الصورة (سيتم ضغطها تلقائياً)",
    };
    if (/exceed|too large|1048576|1\s*MiB|maximum entity size/i.test(msg)) {
      return jsonError(
        400,
        "فشل حفظ الصورة: حجم بيانات الغرفة كبير جداً. جرّب صورة أبسط أو أعد التحميل.",
      );
    }
    return jsonError(400, map[msg] ?? "فشل حفظ الصورة — حاول مجدداً");
  }
}
