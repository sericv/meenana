import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let adminApp: App | undefined;

type ServiceAccountShape = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type ParseResult = {
  account: ServiceAccountShape;
  format: "raw-json" | "double-quoted-json" | "base64-json" | "unescaped-json";
};

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

/**
 * Restore a private_key string to the literal PEM that firebase-admin requires.
 *
 * Handles three real-world deformations:
 *   a. Real newlines already in place (JSON.parse decoded a proper "\n" escape).
 *   b. Literal two-char "\n" sequences left over from env handlers that
 *      double-escape (Vercel / shell envs).
 *   c. Surrounding whitespace / CR characters from Windows clipboard pastes.
 */
function normalisePrivateKey(pk: string): string {
  let out = pk;
  if (out.includes("\\n")) out = out.replace(/\\n/g, "\n");
  if (out.includes("\\r")) out = out.replace(/\\r/g, "\r");
  out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return out.trim() + "\n";
}

function asServiceAccount(obj: unknown): ServiceAccountShape | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Partial<ServiceAccountShape>;
  if (!o.project_id || !o.client_email || !o.private_key) return null;
  return {
    project_id: String(o.project_id),
    client_email: String(o.client_email),
    private_key: normalisePrivateKey(String(o.private_key)),
  };
}

/**
 * Looks dotenv-like with backslash-escaped quotes outside of an opening quote.
 * E.g. `{\"type\":\"service_account\",...}` — happens when an editor strips the
 * surrounding double-quotes from a properly-formatted env line but leaves the
 * inner escapes intact.
 */
function unescapeDotenvLeftovers(raw: string): string | null {
  if (!raw.includes('\\"')) return null;
  // Convert `\"` → `"`, `\\` → `\`, `\n` literal → real newline, `\t` likewise.
  // The result should be valid JSON if this was the actual deformation.
  return raw
    .replace(/\\\\/g, "\u0000")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\u0000/g, "\\");
}

/**
 * Parse FIREBASE_SERVICE_ACCOUNT_JSON. Supports — and auto-detects — these forms:
 *   1. Raw minified JSON              {"project_id":"...","private_key":"-----BEGIN..."}
 *   2. Double/single quoted JSON      "{ ...}"      ('CI / some shells wrap with quotes)
 *   3. Base64 of the JSON file        eyJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsLi4ufQ==
 *   4. dotenv-mangled JSON            {\"type\":\"service_account\",...}
 *      (happens when an editor strips the outer quotes but keeps inner \" escapes)
 *
 * Private keys may arrive as real "\n" newlines or literal "\\n" two-char escapes;
 * both are normalised. Returns the detected format so callers can log it.
 */
export function parseServiceAccount(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_JSON قيمة فارغة.");
  }

  // 1. Raw JSON
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      const sa = asServiceAccount(obj);
      if (sa) return { account: sa, format: "raw-json" };
    } catch {
      // fall through — could be dotenv-mangled JSON (case 4)
    }

    const unescaped = unescapeDotenvLeftovers(trimmed);
    if (unescaped) {
      try {
        const obj = JSON.parse(unescaped);
        const sa = asServiceAccount(obj);
        if (sa) return { account: sa, format: "unescaped-json" };
      } catch {
        // continue
      }
    }
  }

  // 2. Outer-quoted JSON (parser kept the outer quotes as part of the value)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1);

    // 2a. After stripping outer quotes, inner is plain JSON.
    try {
      const obj = JSON.parse(inner);
      const sa = asServiceAccount(obj);
      if (sa) return { account: sa, format: "double-quoted-json" };
    } catch {
      // try further fallbacks
    }

    // 2b. Inner uses \"...\" escapes (dotenv-style content). Decode and parse.
    const unescaped = unescapeDotenvLeftovers(inner);
    if (unescaped) {
      try {
        const obj = JSON.parse(unescaped);
        const sa = asServiceAccount(obj);
        if (sa) return { account: sa, format: "double-quoted-json" };
      } catch {
        // continue
      }
    }

    // 2c. Some parsers (e.g. Turbopack in certain setups) deliver the FULL
    //     quoted-and-escaped form as a single literal, so the WHOLE trimmed
    //     value still contains backslash-escapes. Try unescaping the whole thing.
    const fullUnescaped = unescapeDotenvLeftovers(trimmed);
    if (fullUnescaped) {
      // Strip an extra outer quote pair if the unescape produced one.
      const candidate =
        fullUnescaped.startsWith('"') && fullUnescaped.endsWith('"')
          ? fullUnescaped.slice(1, -1)
          : fullUnescaped;
      try {
        const obj = JSON.parse(candidate);
        const sa = asServiceAccount(obj);
        if (sa) return { account: sa, format: "double-quoted-json" };
      } catch {
        // continue
      }
    }
  }

  // 3. Base64 JSON
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    try {
      const decoded = Buffer.from(trimmed.replace(/\s+/g, ""), "base64").toString("utf8");
      if (decoded.trimStart().startsWith("{")) {
        const obj = JSON.parse(decoded);
        const sa = asServiceAccount(obj);
        if (sa) return { account: sa, format: "base64-json" };
      }
    } catch {
      // continue
    }
  }

  throw new AdminConfigError(
    "تعذر قراءة FIREBASE_SERVICE_ACCOUNT_JSON. " +
      "تأكد أن المتغير يحتوي على JSON صحيح (سطر واحد) أو Base64 صالح. " +
      "تلميح: لو القيمة تبدأ بـ `{\\\"type\\\":...` فأنت تحتاج إلى وضعها بين علامتي تنصيص في .env.local.",
  );
}

/**
 * Returns (or lazily initialises) the Firebase Admin App singleton.
 * Throws AdminConfigError when FIREBASE_SERVICE_ACCOUNT_JSON is missing/invalid.
 */
export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existing = getApps();
  if (existing.length) {
    adminApp = existing[0]!;
    return adminApp;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) {
    const msg =
      "FIREBASE_SERVICE_ACCOUNT_JSON غير موجود في متغيرات البيئة. " +
      "أضفه في .env.local (للتطوير) أو في إعدادات النشر، ثم أعد تشغيل الخادم.";
    console.error("[firebase/admin] ✗", msg);
    throw new AdminConfigError(msg);
  }

  let parsed: ParseResult;
  try {
    parsed = parseServiceAccount(raw);
  } catch (err) {
    const lengthInfo = `طول القيمة=${raw.length}, يبدأ بـ=${JSON.stringify(raw.slice(0, 24))}`;
    const msg =
      err instanceof AdminConfigError
        ? `${err.message}  (${lengthInfo})`
        : `FIREBASE_SERVICE_ACCOUNT_JSON تعذر تحليله: ${String(err)}  (${lengthInfo})`;
    console.error("[firebase/admin] ✗", msg);
    throw new AdminConfigError(msg);
  }

  const { account: sa, format } = parsed;

  if (!/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(sa.private_key)) {
    const msg =
      "private_key لا يبدأ بـ '-----BEGIN PRIVATE KEY-----'. " +
      "تحقق من تنسيق الـ JSON (لا تستبدل الأسطر الجديدة يدوياً).";
    console.error("[firebase/admin] ✗", msg);
    throw new AdminConfigError(msg);
  }

  try {
    adminApp = initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
    });
    console.log(
      `[firebase/admin] ✓ initialised (format: ${format}) — project: ${sa.project_id}, account: ${sa.client_email}`,
    );
  } catch (err) {
    const msg = "فشل تهيئة Firebase Admin SDK: " + String(err);
    console.error("[firebase/admin] ✗", msg);
    throw new AdminConfigError(msg);
  }

  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

/** Default GCS bucket for profile uploads (must match Firebase Storage bucket). */
export function getAdminStorageBucketName(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    "whoami-76238.firebasestorage.app"
  );
}

export function getAdminBucket() {
  return getStorage(getAdminApp()).bucket(getAdminStorageBucketName());
}

/** Returns true when Admin is (or can be) initialised — used for health checks. */
export function isAdminConfigured(): boolean {
  if (getApps().length > 0) return true;
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}
