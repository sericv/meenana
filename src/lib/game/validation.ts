/**
 * Server-side guess validation — checks if the player's typed guess matches
 * the name of their hidden card. Uses Arabic-aware normalization + per-card
 * aliases (spelling variations only).
 */

import { getAliasesForCard } from "./cards";
import { matchesGuess } from "./aliases";

export function guessMatchesCard(
  guess: string,
  cardName: string,
  cardNameAr: string,
  cardId?: string,
  storedAliases?: string[],
): boolean {
  const registry =
    cardId && !String(cardId).startsWith("custom:") ? getAliasesForCard(cardId) : [];
  const merged = [...registry, ...(storedAliases ?? [])];
  return matchesGuess(guess, cardName, cardNameAr, merged);
}
