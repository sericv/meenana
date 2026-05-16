/**
 * Auto-generates spelling / script variants for custom card answers.
 * Shared by client (preview) and server (merge at match start).
 */

import { normalizeArabic } from "./aliases";

function stripSpaces(s: string): string {
  return s.replace(/\s+/g, "");
}

/** Collapse 3+ repeated characters to 2 (typing exaggeration). */
function collapseRepeats(s: string): string {
  return s.replace(/(.)\1{2,}/gu, "$1$1");
}

const KNOWN_PACKS: Array<{ test: (s: string) => boolean; extras: string[] }> = [
  {
    test: (s) =>
      /رونالدو|ronaldo|cr7|كريستيانو|cristiano/i.test(s) ||
      normalizeArabic(s).includes(normalizeArabic("رونالدو")),
    extras: [
      "رونالدو",
      "رونلدو",
      "كريستيانو",
      "كريستيانو رونالدو",
      "كرستيانو",
      "cristiano",
      "cristiano ronaldo",
      "ronaldo",
      "CR7",
      "cr7",
      "سي ار 7",
    ],
  },
];

export function generateGuessAliases(primary: string): string[] {
  const base = primary.trim();
  if (!base) return [];

  const out = new Set<string>();
  const add = (x: string) => {
    const t = x.trim();
    if (t.length >= 1) out.add(t);
  };

  add(base);
  add(base.toLowerCase());

  const norm = normalizeArabic(base);
  add(norm);
  add(collapseRepeats(norm));
  add(stripSpaces(base));
  add(stripSpaces(base.toLowerCase()));
  add(stripSpaces(norm));

  const probe = `${base} ${norm}`;
  for (const pack of KNOWN_PACKS) {
    if (pack.test(probe)) {
      for (const e of pack.extras) add(e);
    }
  }

  return [...out].filter((s) => s.length >= 1);
}
