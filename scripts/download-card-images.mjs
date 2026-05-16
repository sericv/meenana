/**
 * Download + optimize card images.
 *
 * Source: Wikipedia REST API (page-summary endpoint), which returns a
 * publicly-cached thumbnail URL (`thumbnail.source`). These images come from
 * Wikimedia Commons under permissive licenses and are stable to hot-link.
 *
 * For every card in src/lib/game/cards-data/<deck>.json:
 *   1. Read the optional `wiki` slug.
 *   2. Fetch the page summary → grab the original image URL.
 *   3. Download the binary.
 *   4. Resize → 512x512 cover crop, encode WebP (quality 82), save to
 *      public/cards/<categorySlug>/<image>.
 *
 * Usage:
 *   node scripts/download-card-images.mjs
 *   node scripts/download-card-images.mjs --force      # overwrite existing
 *   node scripts/download-card-images.mjs --deck=animals
 */

import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "src", "lib", "game", "cards-data");
const OUT_DIR = join(ROOT, "public", "cards");

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DECK_FILTER = [...args]
  .find((a) => a.startsWith("--deck="))
  ?.split("=")[1]
  ?.trim();

const SIZE = 512;
const WEBP_QUALITY = 82;
const CONCURRENCY = 1;            // single-threaded to respect Wikipedia rate limits
const REQUEST_DELAY_MS = 400;     // pause between requests
const MAX_RETRIES = 4;            // retries on 429 / transient network errors
const USER_AGENT = "MeenAnaCardImporter/1.0 (https://example.local; educational/non-commercial)";

const DECKS = ["general", "animals", "celebrities", "games", "anime"];

/* ──────────────────────────────────────────────────────────────────── */

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url, label) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        const backoff = Math.max(1500, retryAfter * 1000) * (attempt + 1);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`${label} ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error(`${label} failed after retries`);
}

async function fetchWikipediaImageUrl(slug) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
  const res = await politeFetch(url, "wiki summary");
  const json = await res.json();
  const src = json?.originalimage?.source ?? json?.thumbnail?.source;
  if (!src) throw new Error("no image in summary");
  return src;
}

async function downloadBuffer(url) {
  const res = await politeFetch(url, "download");
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function processCard(card, slug) {
  const outFile = join(OUT_DIR, slug, card.image);
  if (!FORCE && (await exists(outFile))) return { skipped: true, card };

  if (!card.wiki) {
    return { skipped: true, card, reason: "no wiki source" };
  }

  await mkdir(dirname(outFile), { recursive: true });

  try {
    const src = await fetchWikipediaImageUrl(card.wiki);
    await sleep(REQUEST_DELAY_MS);
    const buf = await downloadBuffer(src);
    const out = await sharp(buf)
      .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();
    await writeFile(outFile, out);
    await sleep(REQUEST_DELAY_MS);
    return { ok: true, card, bytes: out.length };
  } catch (err) {
    return { err: err instanceof Error ? err.message : String(err), card };
  }
}

async function processDeck(deckName) {
  const file = join(DATA_DIR, `${deckName}.json`);
  const raw = await readFile(file, "utf8");
  const json = JSON.parse(raw);
  const items = json.items ?? [];
  const slug = inferSlug(json.category);
  console.log(`\n=== ${deckName} (${items.length} cards) → public/cards/${slug}/ ===`);

  let queue = [...items];
  let ok = 0, skipped = 0, fail = 0;

  async function worker() {
    while (queue.length) {
      const card = queue.shift();
      if (!card) return;
      process.stdout.write(`  • ${card.nameAr} (${card.image}) … `);
      const r = await processCard(card, slug);
      if (r.ok) {
        console.log(`ok (${(r.bytes / 1024).toFixed(1)}kb)`);
        ok++;
      } else if (r.err) {
        console.log(`fail: ${r.err}`);
        fail++;
      } else {
        console.log(r.reason ? `skip (${r.reason})` : "skip (exists)");
        skipped++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`-- ${deckName}: ${ok} downloaded, ${skipped} skipped, ${fail} failed`);
  return { ok, skipped, fail };
}

function inferSlug(categoryId) {
  const map = {
    cat_general: "general",
    cat_celebrities: "celebrities",
    cat_animals: "animals",
    cat_games: "games",
    cat_anime: "anime",
  };
  return map[categoryId] ?? categoryId.replace(/^cat_/, "");
}

async function main() {
  const list = DECK_FILTER ? [DECK_FILTER] : DECKS;
  let total = { ok: 0, skipped: 0, fail: 0 };
  for (const deck of list) {
    try {
      const r = await processDeck(deck);
      total.ok += r.ok;
      total.skipped += r.skipped;
      total.fail += r.fail;
    } catch (e) {
      console.error(`Deck ${deck} failed to load:`, e);
    }
  }
  console.log(
    `\nDONE — ${total.ok} new, ${total.skipped} kept, ${total.fail} failed.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
