/**
 * Arabic-aware text normalization & alias matching for guess validation.
 *
 * Goal: fix common Arabic spelling/typing variations only — NOT general
 * synonyms. The system should feel fair, not exploitable.
 *
 * Normalisations applied (both sides):
 *   - lowercase
 *   - strip diacritics (fatha/damma/kasra/shadda/sukun + dagger alif + tatweel)
 *   - unify alef variants  أ إ آ ٱ → ا
 *   - unify ya variants    ى → ي
 *   - unify ta marbuta     ة → ه   (so "غرفة" == "غرفه")
 *   - unify hamza on waw   ؤ → و
 *   - unify hamza on ya    ئ → ي
 *   - unify hamza          ء → ""   (often skipped while typing)
 *   - convert Arabic-Indic digits to ASCII
 *   - collapse non-letter/non-digit chars to spaces
 *   - collapse whitespace
 *
 * Aliases are additional accepted spellings declared per card. They are
 * normalised the same way, so callers do not have to repeat all variants.
 */

const DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;
const TASHKEEL_DUPLICATES_RE = /(.)\1{2,}/g; // collapse 3+ repeats (e.g. "أأأ")

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export function normalizeArabic(input: string): string {
  if (!input) return "";
  let s = String(input).toLowerCase();
  s = s.replace(DIACRITICS_RE, "");
  s = s
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أ إ آ ٱ → ا
    .replace(/\u0649/g, "\u064A")                       // ى → ي
    .replace(/\u0629/g, "\u0647")                       // ة → ه
    .replace(/\u0624/g, "\u0648")                       // ؤ → و
    .replace(/\u0626/g, "\u064A")                       // ئ → ي
    .replace(/\u0621/g, "")                             // ء → ""
    .replace(/[\u0660-\u0669]/g, (d) => ARABIC_DIGITS[d] ?? d);
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(TASHKEEL_DUPLICATES_RE, "$1$1"); // "أأأ" → "أأ"
  return s;
}

/**
 * Returns true when the user's guess matches the card's name, Arabic name,
 * or any provided alias — after Arabic-aware normalisation.
 */
export function matchesGuess(
  guess: string,
  cardName: string,
  cardNameAr: string,
  aliases: readonly string[] = [],
): boolean {
  const g = normalizeArabic(guess);
  if (g.length < 2) return false;

  const candidates = [cardName, cardNameAr, ...aliases]
    .map(normalizeArabic)
    .filter((s) => s.length > 0);

  for (const c of candidates) {
    if (g === c) return true;
    // Allow substring matches in either direction for short multi-word names
    if (c.length >= 3 && g.includes(c)) return true;
    if (g.length >= 3 && c.includes(g)) return true;
  }
  return false;
}
