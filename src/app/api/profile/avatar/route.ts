import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { HttpError, jsonError, jsonOk, requireUidFromRequest } from "@/lib/server/auth";
import { AdminConfigError, getAdminBucket, getAdminDb } from "@/lib/firebase/admin";
import { col } from "@/lib/firestore/paths";
import { assertFullAccountUser } from "@/lib/server/full-account-server";

function isJpegBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export async function POST(req: Request) {
  try {
    const uid = await requireUidFromRequest(req);
    await assertFullAccountUser(uid);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "جسم الطلب ليس JSON صالحاً.");
    }
    const b64 =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { imageBase64?: unknown }).imageBase64 === "string"
        ? String((body as { imageBase64: string }).imageBase64).trim()
        : "";
    if (!b64) throw new HttpError(400, "صورة مفقودة.");

    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      throw new HttpError(400, "صورة غير صالحة.");
    }
    if (buf.length < 200) throw new HttpError(400, "صورة صغيرة جداً.");
    if (buf.length > 2_400_000) throw new HttpError(413, "حجم الصورة كبير جداً بعد الترميز.");
    if (!isJpegBuffer(buf)) {
      throw new HttpError(400, "يُقبل JPEG فقط بعد المعالجة على الجهاز.");
    }

    const dest = `profileAvatars/${uid}.jpg`;
    const bucket = getAdminBucket();
    const token = randomUUID();
    const file = bucket.file(dest);

    await file.save(buf, {
      resumable: false,
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const bucketName = bucket.name;
    const pathEnc = encodeURIComponent(dest);
    const photoURL = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${pathEnc}?alt=media&token=${token}`;

    await getAdminDb()
      .collection(col.users)
      .doc(uid)
      .set({ photoURL, lastSeen: FieldValue.serverTimestamp() }, { merge: true });

    return jsonOk({ photoURL });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    if (e instanceof AdminConfigError) return jsonError(503, e.message);
    console.error("[api/profile/avatar]", e);
    return jsonError(500, "تعذر رفع الصورة. حاول مرة أخرى.");
  }
}
