import { AdminConfigError, getAdminDb } from "@/lib/firebase/admin";
import { col, userSub } from "@/lib/firestore/paths";
import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { respondFriendRequest } from "@/lib/server/social-server";

const DEBUG = process.env.SOCIAL_API_DEBUG === "1";

function parseAccept(body: Record<string, unknown>): boolean {
  if (typeof body.accept === "boolean") return body.accept;
  if (typeof body.accept === "string") {
    const s = body.accept.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  const action = String(body.action ?? "").trim().toLowerCase();
  if (action === "accept" || action === "yes") return true;
  if (action === "decline" || action === "reject" || action === "deny") return false;
  throw new HttpError(400, "يجب تحديد قبول أو رفض (accept أو action).");
}

function parseFromUid(body: Record<string, unknown>): string {
  const raw = body.fromUid ?? body.senderUid ?? body.from ?? "";
  return String(raw ?? "").trim();
}

export async function POST(req: Request) {
  let rawBodyText = "";
  let body: Record<string, unknown> = {};

  try {
    const uid = await requireUidFromRequest(req);

    try {
      rawBodyText = await req.text();
      body = rawBodyText ? (JSON.parse(rawBodyText) as Record<string, unknown>) : {};
    } catch {
      if (DEBUG) console.error("[friends/respond] JSON parse failed", { rawBodyText: rawBodyText.slice(0, 500) });
      throw new HttpError(400, "جسم الطلب ليس JSON صالحاً.");
    }

    const fromUid = parseFromUid(body);
    let accept: boolean;
    try {
      accept = parseAccept(body);
    } catch (e) {
      if (DEBUG) {
        console.error("[friends/respond] accept parse failed", {
          uid,
          fromUid,
          bodyKeys: Object.keys(body),
          acceptRaw: body.accept,
          actionRaw: body.action,
        });
      }
      throw e;
    }

    if (!fromUid) throw new HttpError(400, "معرّف المرسل مفقود.");

    if (DEBUG) {
      const db = getAdminDb();
      const inboxRef = db.collection(col.users).doc(uid).collection(userSub.friendInbox).doc(fromUid);
      const inboxSnap = await inboxRef.get();
      console.error("[friends/respond] incoming", {
        authUid: uid,
        fromUid,
        accept,
        inboxDocPath: inboxRef.path,
        inboxExists: inboxSnap.exists,
        bodyKeys: Object.keys(body),
      });
    }

    await respondFriendRequest(uid, fromUid, accept);
    return jsonOk({});
  } catch (e) {
    if (DEBUG) {
      console.error("[friends/respond] error", {
        message: e instanceof Error ? e.message : String(e),
        name: e instanceof Error ? e.name : typeof e,
        isHttp: e instanceof HttpError,
        status: e instanceof HttpError ? e.status : undefined,
      });
    }
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) return jsonError(503, "الخادم غير مهيأ.");
    console.error("[friends/respond] unexpected", e);
    return jsonError(500, "تعذر معالجة الطلب.");
  }
}
