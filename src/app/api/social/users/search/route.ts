import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { assertGoogleUid, searchUsernamesByPrefix } from "@/lib/server/social-server";
import { AdminConfigError } from "@/lib/firebase/admin";

export async function GET(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    await assertGoogleUid(uid);
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const results = await searchUsernamesByPrefix(q);
    const filtered = results.filter((r) => r.uid !== uid);
    return jsonOk({ results: filtered });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) return jsonError(503, "الخادم غير مهيأ.");
    return jsonError(400, "تعذر البحث.");
  }
}
