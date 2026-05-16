/**
 * Seed categories + cards into Firestore using the Firebase Admin SDK.
 *
 * Usage (PowerShell):
 *   $env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content serviceAccount.json -Raw
 *   node scripts/seed-firestore.mjs
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

const parsed = JSON.parse(raw);
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

const categories = [
  { id: "cat_general",     nameAr: "عام",      slug: "general",     order: 10 },
  { id: "cat_celebrities", nameAr: "مشاهير",   slug: "celebrities", order: 20 },
  { id: "cat_animals",     nameAr: "حيوانات",  slug: "animals",     order: 30 },
  { id: "cat_games",       nameAr: "ألعاب",    slug: "games",       order: 40 },
  { id: "cat_anime",       nameAr: "أنمي",      slug: "anime",       order: 50 },
];

/**
 * Note: at runtime, cards are now loaded from src/lib/game/cards-data/*.json,
 * NOT from Firestore. Only categories are seeded here.
 */
const cards = [];

let batch = db.batch();
let n = 0;

async function commitIfNeeded(force = false) {
  if (n >= 400 || force) {
    if (n) await batch.commit();
    batch = db.batch();
    n = 0;
  }
}

for (const c of categories) {
  batch.set(
    db.collection("categories").doc(c.id),
    {
      nameAr: c.nameAr,
      slug: c.slug,
      order: c.order,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  n++;
  await commitIfNeeded();
}

for (const card of cards) {
  batch.set(
    db.collection("cards").doc(card.id),
    {
      name: card.name,
      nameAr: card.nameAr,
      categoryId: card.categoryId,
      imageUrl: card.imageUrl,
      tags: card.tags,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  n++;
  await commitIfNeeded();
}

await commitIfNeeded(true);
console.log(`Seeded ${categories.length} categories and ${cards.length} cards.`);
