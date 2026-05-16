/**
 * Client-side square crop (center), resize, and JPEG encode for profile uploads.
 */

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const OUTPUT_SIDE = 512;
const JPEG_QUALITY = 0.88;

export async function compressAvatarImageFromFile(file: File, maxSide = OUTPUT_SIDE): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("اختر ملف صورة صالحاً.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("الصورة كبيرة جداً (الحد ١٢ ميجابايت قبل الضغط).");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    if (w < 32 || h < 32) {
      throw new Error("دقة الصورة منخفضة جداً.");
    }
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = (h - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = maxSide;
    canvas.height = maxSide;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذر معالجة الصورة في هذا المتصفح.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, maxSide, maxSide);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
    if (!base64) throw new Error("فشل ضغط الصورة.");
    return base64;
  } finally {
    bitmap.close();
  }
}
