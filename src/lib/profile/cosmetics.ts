/** Built-in avatar keys (stored in Firestore `users/{uid}.avatarId`). */
export const DEFAULT_AVATAR_ID = "star";
export const DEFAULT_FRAME_ID = "none";

/** Style presets when the player has no `photoURL` (IDs only — visuals are illustrated in the client). */
export const AVATAR_PRESETS = [
  { id: "star" },
  { id: "fox" },
  { id: "lion" },
  { id: "panda" },
  { id: "robot" },
  { id: "alien" },
  { id: "ghost" },
  { id: "crown" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

/** Rarity for shop / UX accents (frame picker ring colors). */
export type FrameRarity = "common" | "rare" | "epic" | "legendary";

/**
 * Animated GIF frames live under `public/fream/` (asset paths are `/fream/*.gif`).
 * `overlayScale` controls how large the GIF sits vs the avatar circle (centered overlay).
 */
export const FRAME_REGISTRY = [
  {
    id: "none",
    src: null,
    displayNameAr: "بدون إطار",
    rarity: "common",
    animated: false,
    overlayScale: 1,
  },
  {
    id: "frame_01",
    src: "/fream/1.gif",
    displayNameAr: "توهج برتقالي",
    rarity: "rare",
    animated: true,
    overlayScale: 1.14,
  },
  {
    id: "frame_02",
    src: "/fream/2.gif",
    displayNameAr: "هالة ذهبية",
    rarity: "rare",
    animated: true,
    overlayScale: 1.12,
  },
  {
    id: "frame_03",
    src: "/fream/3.gif",
    displayNameAr: "وميض ناري",
    rarity: "epic",
    animated: true,
    overlayScale: 1.16,
  },
  {
    id: "frame_04",
    src: "/fream/4.gif",
    displayNameAr: "درع لامع",
    rarity: "rare",
    animated: true,
    overlayScale: 1.13,
  },
  {
    id: "frame_05",
    src: "/fream/5.gif",
    displayNameAr: "نبض كهرماني",
    rarity: "epic",
    animated: true,
    overlayScale: 1.15,
  },
  {
    id: "frame_06",
    src: "/fream/6.gif",
    displayNameAr: "طاقة مركزية",
    rarity: "rare",
    animated: true,
    overlayScale: 1.14,
  },
  {
    id: "frame_07",
    src: "/fream/7.gif",
    displayNameAr: "حلقة ملكية",
    rarity: "legendary",
    animated: true,
    overlayScale: 1.18,
  },
  {
    id: "frame_08",
    src: "/fream/8.gif",
    displayNameAr: "شرارة سماوية",
    rarity: "epic",
    animated: true,
    overlayScale: 1.15,
  },
  {
    id: "frame_09",
    src: "/fream/9.gif",
    displayNameAr: "توهج بنفسجي",
    rarity: "epic",
    animated: true,
    overlayScale: 1.14,
  },
  {
    id: "frame_10",
    src: "/fream/10.gif",
    displayNameAr: "قوس قزح لطيف",
    rarity: "legendary",
    animated: true,
    overlayScale: 1.17,
  },
] as const;

export type FrameId = (typeof FRAME_REGISTRY)[number]["id"];

export type FrameDefinition = (typeof FRAME_REGISTRY)[number];

export function getFrameDefinition(id: string): FrameDefinition {
  const hit = FRAME_REGISTRY.find((f) => f.id === id);
  return hit ?? FRAME_REGISTRY[0]!;
}

export type PlayerCosmetic = {
  avatarId: string;
  avatarFrameId: string;
  photoURL: string | null;
};

export function normalizeCosmetic(raw: Record<string, unknown> | undefined): PlayerCosmetic {
  const rawFrame = typeof raw?.avatarFrameId === "string" && raw.avatarFrameId ? raw.avatarFrameId : DEFAULT_FRAME_ID;
  return {
    avatarId: typeof raw?.avatarId === "string" && raw.avatarId ? raw.avatarId : DEFAULT_AVATAR_ID,
    avatarFrameId: isValidFrameId(rawFrame) ? rawFrame : DEFAULT_FRAME_ID,
    photoURL: typeof raw?.photoURL === "string" ? raw.photoURL : null,
  };
}

export function isValidFrameId(id: string): id is FrameId {
  return FRAME_REGISTRY.some((f) => f.id === id);
}

export function isValidAvatarId(id: string): id is AvatarPresetId {
  return AVATAR_PRESETS.some((a) => a.id === id);
}

/** Preload GIF assets (call once when opening frame UI). */
export function preloadFrameAssets(): void {
  if (typeof window === "undefined") return;
  for (const f of FRAME_REGISTRY) {
    if (!f.src) continue;
    const im = new window.Image();
    im.decoding = "async";
    im.src = f.src;
  }
}

export function frameCardSurfaceClass(rarity: FrameRarity): string {
  switch (rarity) {
    case "legendary":
      return "bg-gradient-to-b from-white via-amber-50/90 to-amber-100/70";
    case "epic":
      return "bg-gradient-to-b from-white via-violet-50/80 to-fuchsia-50/60";
    case "rare":
      return "bg-gradient-to-b from-white via-sky-50/75 to-cyan-50/55";
    default:
      return "bg-gradient-to-b from-white to-[#fffaf5]";
  }
}
