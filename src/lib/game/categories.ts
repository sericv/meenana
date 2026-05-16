/**
 * Single source of truth for in-game categories.
 *
 * Each entry powers:
 *   - the Create Room category picker
 *   - matchmaking categoryId
 *   - server-side card pool selection
 *   - the seed script for Firestore
 */

export type CategoryDef = {
  /** Firestore doc id + room.categoryId field */
  id: string;
  /** url-safe slug, also used for image folder name */
  slug: string;
  /** Arabic label shown in UI */
  nameAr: string;
  /** sort order in pickers */
  order: number;
};

export const CATEGORIES: readonly CategoryDef[] = [
  { id: "cat_general",     slug: "general",     nameAr: "عام",      order: 10 },
  { id: "cat_celebrities", slug: "celebrities", nameAr: "مشاهير",   order: 20 },
  { id: "cat_animals",     slug: "animals",     nameAr: "حيوانات",  order: 30 },
  { id: "cat_games",       slug: "games",       nameAr: "ألعاب",    order: 40 },
  { id: "cat_anime",       slug: "anime",       nameAr: "أنمي",      order: 50 },
] as const;

export const DEFAULT_CATEGORY_ID = "cat_general";

export function getCategoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
