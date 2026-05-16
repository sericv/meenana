import type { StoredCustomRoomCard } from "@/types";

/**
 * Lobby + wire: opponent-custom card is complete enough to count toward "both picked"
 * and to show saved / ready UI. Mirrors server expectations (name + usable image URL).
 */
export function isOpponentCustomCardComplete(
  card: Pick<StoredCustomRoomCard, "nameAr" | "imageUrl"> | undefined | null,
): boolean {
  if (!card) return false;
  const nameAr = String(card.nameAr ?? "").trim();
  const imageUrl = String(card.imageUrl ?? "").trim();
  if (nameAr.length < 1) return false;
  if (imageUrl.length < 12) return false;
  const lower = imageUrl.toLowerCase();
  if (lower.startsWith("https://") || lower.startsWith("http://")) return true;
  if (!lower.startsWith("data:image/")) return false;
  const m = /^data:image\/([\w.+-]+)/i.exec(imageUrl);
  const subtype = (m?.[1] ?? "").toLowerCase();
  return ["png", "jpeg", "jpg", "webp", "gif"].includes(subtype);
}
