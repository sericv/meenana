/**
 * Loads `.env.local` and verifies FIREBASE_SERVICE_ACCOUNT_JSON initializes firebase-admin.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseEnvLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const eq = t.indexOf("=");
  if (eq === -1) return null;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if (!key) return null;
  if (val.startsWith('"') && val.endsWith('"')) {
    try {
      val = JSON.parse(val);
    } catch {
      val = val.slice(1, -1);
    }
  } else if (val.startsWith("'") && val.endsWith("'")) {
    val = val.slice(1, -1);
  }
  return [key, val];
}

function loadDotEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) {
    console.error("Missing .env.local — run: npm run env:sync");
    process.exit(1);
  }
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed) process.env[parsed[0]] = parsed[1];
  }
}

function parseServiceAccount(raw) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty");
  const candidates = [trimmed];
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.trimStart().startsWith("{")) candidates.push(decoded);
  } catch {
    // ignore
  }
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        const pk = parsed.private_key.includes("\\n")
          ? parsed.private_key.replace(/\\n/g, "\n")
          : parsed.private_key;
        return { ...parsed, private_key: pk };
      }
    } catch {
      // try next
    }
  }
  throw new Error("could not parse FIREBASE_SERVICE_ACCOUNT_JSON");
}

loadDotEnvLocal();
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw?.trim()) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON is empty. Add serviceAccount.json and run npm run env:sync");
  process.exit(1);
}

let sa;
try {
  sa = parseServiceAccount(raw);
} catch (e) {
  console.error("Parse error:", e.message);
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
  });
}

getFirestore();
console.log("[verify-admin] OK — firebase-admin initialized for project:", sa.project_id);
