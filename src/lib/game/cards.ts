/**
 * Auto-loaded card database.
 *
 * Each category lives in its own JSON file under ./cards-data/.
 * Image files are stored under public/cards/<slug>/<image>.
 *
 * No Firestore round-trip is needed for card data at runtime; cards are
 * embedded in the bundle. Adding/removing items only requires editing JSON.
 */

import type { GameCard } from "@/types";
import { CATEGORIES, type CategoryDef } from "./categories";

import generalRaw from "./cards-data/general.json";
import animalsRaw from "./cards-data/animals.json";
import celebritiesRaw from "./cards-data/celebrities.json";
import gamesRaw from "./cards-data/games.json";
import animeRaw from "./cards-data/anime.json";

type RawDeck = {
  category: string;
  items: Array<{
    name: string;
    nameAr: string;
    aliases?: string[];
    image: string;
    wiki?: string;
  }>;
};

const RAW_DECKS: RawDeck[] = [
  generalRaw as RawDeck,
  animalsRaw as RawDeck,
  celebritiesRaw as RawDeck,
  gamesRaw as RawDeck,
  animeRaw as RawDeck,
];

/* ───── Slug helper used to build a stable, unique card id ───── */
function slugifyAscii(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function categoryDef(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/* ───── Build flattened card list ───── */
function buildAllCards(): GameCard[] {
  const out: GameCard[] = [];
  const seenIds = new Set<string>();
  for (const deck of RAW_DECKS) {
    const def = categoryDef(deck.category);
    if (!def) {
      console.warn(`[cards] unknown category ${deck.category}, skipping deck`);
      continue;
    }
    for (const it of deck.items) {
      const baseSlug = slugifyAscii(it.name) || slugifyAscii(it.image);
      let id = `card_${def.slug}_${baseSlug}`;
      let n = 2;
      while (seenIds.has(id)) {
        id = `card_${def.slug}_${baseSlug}_${n++}`;
      }
      seenIds.add(id);
      out.push({
        id,
        name: it.name,
        nameAr: it.nameAr,
        imageUrl: `/cards/${def.slug}/${it.image}`,
        categoryId: def.id,
        tags: it.aliases ?? [],
      });
    }
  }
  return out;
}

export const ALL_CARDS: readonly GameCard[] = buildAllCards();

/** Backwards-compatible alias used by older imports. */
export const STATIC_CARDS = ALL_CARDS;

/* ───── Category-aware random pick ───── */
function poolForCategory(categoryId: string | undefined): readonly GameCard[] {
  if (!categoryId) return ALL_CARDS;
  const filtered = ALL_CARDS.filter((c) => c.categoryId === categoryId);
  return filtered.length >= 2 ? filtered : ALL_CARDS;
}

/**
 * Pick two distinct cards at random, preferring the requested category.
 * Falls back to the global pool when a category has fewer than 2 entries.
 */
export function pickTwoCards(
  categoryId?: string | null,
): [GameCard, GameCard] | null {
  const pool = poolForCategory(categoryId ?? undefined);
  if (pool.length < 2) return null;
  const list = [...pool];
  const i = Math.floor(Math.random() * list.length);
  const a = list.splice(i, 1)[0]!;
  const j = Math.floor(Math.random() * list.length);
  const b = list[j]!;
  return [a, b];
}

/** Return the aliases declared for a card id (empty when unknown). */
export function getAliasesForCard(cardId: string): readonly string[] {
  const card = ALL_CARDS.find((c) => c.id === cardId);
  return card?.tags ?? [];
}

/** Convenience for debugging / admin tools. */
export function getCardsByCategory(categoryId: string): readonly GameCard[] {
  return ALL_CARDS.filter((c) => c.categoryId === categoryId);
}
