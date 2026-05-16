/**
 * Client-only: square-crop, resize, compress to WebP (JPEG fallback), return a Firestore-safe data URL.
 * Two card images + room metadata must stay under Firestore's 1 MiB document limit — keep outputs small.
 */

const MAX_BYTES_IN = 5 * 1024 * 1024;
/** Target max length of data URL string (~100–120KB binary payload after base64) */
const TARGET_MAX_DATA_URL_CHARS = 135_000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
/** Try largest first; shrink if still above TARGET (Firestore 1 MiB doc budget) */
const DIMENSION_STEPS = [400, 336, 288, 240, 200, 176, 160, 144, 128] as const;

function extensionLooksAllowed(name: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(name.trim());
}

function assertAllowedImageFile(file: File): void {
  const mime = (file.type || "").toLowerCase().trim();
  if (mime && ALLOWED_MIME.has(mime)) return;
  if (!mime && extensionLooksAllowed(file.name)) return;
  throw new Error("الصيغ المدعومة: PNG أو JPG أو WEBP");
}

function loadImageElementFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذر قراءة الصورة — جرّب ملفًا آخر"));
    };
    img.src = url;
  });
}

async function decodeImageSource(file: File): Promise<
  | { kind: "bitmap"; bitmap: ImageBitmap }
  | { kind: "element"; img: HTMLImageElement }
> {
  try {
    const bitmap = await createImageBitmap(file);
    return { kind: "bitmap", bitmap };
  } catch {
    const img = await loadImageElementFromFile(file);
    return { kind: "element", img };
  }
}

function canvasToWebpOrJpeg(canvas: HTMLCanvasElement, quality: number): string {
  const webp = canvas.toDataURL("image/webp", quality);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", Math.min(0.88, quality + 0.08));
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL("image/jpeg", quality);
}

function drawSquareCrop(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  src: { kind: "bitmap"; bitmap: ImageBitmap } | { kind: "element"; img: HTMLImageElement },
  outSize: number,
): void {
  const w = src.kind === "bitmap" ? src.bitmap.width : src.img.naturalWidth;
  const h = src.kind === "bitmap" ? src.bitmap.height : src.img.naturalHeight;
  if (!w || !h) throw new Error("صورة غير صالحة");
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  canvas.width = outSize;
  canvas.height = outSize;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (src.kind === "bitmap") {
    ctx.drawImage(src.bitmap, sx, sy, side, side, 0, 0, outSize, outSize);
  } else {
    ctx.drawImage(src.img, sx, sy, side, side, 0, 0, outSize, outSize);
  }
}

/** Last-resort encode after dimension loop; throws if still too large. */
function compressCanvasToTarget(canvas: HTMLCanvasElement, maxChars: number): string {
  const webpQs = [0.72, 0.6, 0.48, 0.38, 0.3, 0.24] as const;
  for (const q of webpQs) {
    const url = canvasToWebpOrJpeg(canvas, q);
    if (url.length <= maxChars) return url;
  }
  const jpegQs = [0.72, 0.58, 0.45, 0.34, 0.26, 0.2] as const;
  for (const q of jpegQs) {
    const url = canvasToJpeg(canvas, q);
    if (url.length <= maxChars) return url;
  }
  throw new Error(
    "الصورة لا تزال كبيرة جداً بعد الضغط — جرّب صورة أبسط أو بخلفية أوضح",
  );
}

export async function processCardImageFile(
  file: File,
  options?: { maxDataUrlChars?: number },
): Promise<string> {
  assertAllowedImageFile(file);
  if (file.size > MAX_BYTES_IN) {
    throw new Error("الصورة كبيرة جداً (الحد 5 ميجا)");
  }

  const target = options?.maxDataUrlChars ?? TARGET_MAX_DATA_URL_CHARS;

  const src = await decodeImageSource(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر معالجة الصورة");

  try {
    for (const dim of DIMENSION_STEPS) {
      drawSquareCrop(canvas, ctx, src, dim);
      const qualities = [0.78, 0.72, 0.66, 0.6, 0.54, 0.48, 0.42, 0.38, 0.34, 0.3] as const;
      for (const q of qualities) {
        let dataUrl = canvasToWebpOrJpeg(canvas, q);
        if (dataUrl.length <= target) return dataUrl;
        dataUrl = canvasToJpeg(canvas, Math.min(0.85, q + 0.06));
        if (dataUrl.length <= target) return dataUrl;
      }
      for (const q of [0.26, 0.22, 0.18] as const) {
        const dataUrl = canvasToJpeg(canvas, q);
        if (dataUrl.length <= target) return dataUrl;
      }
    }

    drawSquareCrop(canvas, ctx, src, DIMENSION_STEPS[DIMENSION_STEPS.length - 1]!);
    return compressCanvasToTarget(canvas, target);
  } finally {
    if (src.kind === "bitmap") src.bitmap.close();
  }
}
