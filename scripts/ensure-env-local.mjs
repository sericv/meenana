/**
 * Writes `.env.local` with Firebase client + server variables.
 * Service account: place `serviceAccount.json` (or `*firebase-adminsdk*.json`) in project root,
 * then run: node scripts/ensure-env-local.mjs
 *
 * FIREBASE_SERVICE_ACCOUNT_JSON is written as ONE LINE minified JSON.
 * `private_key` newlines are stored as JSON `\n` escapes (valid JSON, readable by admin.ts).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outFile = path.join(root, ".env.local");

/** Mirrors defaults in src/lib/firebase/config.ts */
const CLIENT_DEFAULTS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyD91ZuZTiQp7hDos-djjZisxkINB1xlItQ",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "whoami-76238.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "whoami-76238",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "whoami-76238.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1025205037441",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1025205037441:web:277d3ee3fcdd0903d6a080",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-ZESC1FN33S",
};

function findServiceAccountPath() {
  const preferred = path.join(root, "serviceAccount.json");
  if (fs.existsSync(preferred)) return preferred;
  try {
    const candidates = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name)
      .filter((name) => name.includes("firebase-adminsdk") || name.includes("serviceAccount"));
    if (candidates.length) return path.join(root, candidates[0]);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Returns Base64 of the minified service-account JSON. We use Base64 because:
 *   - it contains only [A-Za-z0-9+/=], no quotes, no backslashes, no newlines
 *   - no .env parser (dotenv, Next, Vercel, etc.) can corrupt it
 *   - admin.ts already auto-detects and decodes Base64 → JSON
 */
function serviceAccountToBase64(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const obj = JSON.parse(raw);
  if (!obj.project_id || !obj.client_email || !obj.private_key) {
    throw new Error("service account JSON missing project_id, client_email, or private_key");
  }
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function escapeEnvValue(val) {
  if (val.includes("\n") || val.includes("\r")) {
    throw new Error("env value must be single-line");
  }
  if (val.includes('"')) {
    return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  if (/[\s#]/.test(val) || val === "") {
    return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return val;
}

const lines = [];
lines.push("# Auto-generated / updated by: npm run env:sync");
lines.push("# Firebase client (also used for Auth + Firestore in the browser)");
for (const [k, v] of Object.entries(CLIENT_DEFAULTS)) {
  lines.push(`${k}=${escapeEnvValue(v)}`);
}

lines.push("");
lines.push("# Cron API (optional in dev)");
lines.push("CRON_SECRET=dev-cron-secret-change-me");

lines.push("");
lines.push(
  "# Firebase Admin — required for API routes (Firestore writes, custom card upload, etc.)",
);
lines.push("# Put serviceAccount.json in the project root, then run: npm run env:sync");

const saPath = findServiceAccountPath();
let saValue = "";
if (saPath) {
  try {
    saValue = serviceAccountToBase64(saPath);
    console.log(
      "[env:sync] Using service account:",
      path.basename(saPath),
      `(stored as Base64, ${saValue.length} chars)`,
    );
  } catch (e) {
    console.error("[env:sync] Invalid service account file:", e.message);
    process.exit(1);
  }
} else {
  console.warn(
    "[env:sync] No serviceAccount.json (or *firebase-adminsdk*) found — FIREBASE_SERVICE_ACCOUNT_JSON left empty.",
  );
  console.warn(
    "[env:sync] Download from Firebase Console → Project settings → Service accounts → Generate new private key.",
  );
}

// Base64 contains only [A-Za-z0-9+/=] so it's safe unquoted in any .env parser.
lines.push(`FIREBASE_SERVICE_ACCOUNT_JSON=${saValue}`);

fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
console.log("[env:sync] Wrote:", outFile);
