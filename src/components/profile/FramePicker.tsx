"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { playUIButton, resumeAudioContext } from "@/lib/audio/game-sounds";
import {
  FRAME_REGISTRY,
  frameCardSurfaceClass,
  preloadFrameAssets,
  type FrameId,
  type FrameRarity,
  type PlayerCosmetic,
} from "@/lib/profile/cosmetics";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type Props = {
  previewCosmetic: PlayerCosmetic;
  selectedFrameId: FrameId;
  onSelect: (id: FrameId) => void;
  fallbackPhotoURL?: string | null;
  displayName?: string;
};

function rarityGlow(r: FrameRarity): string {
  switch (r) {
    case "legendary":
      return "hover:shadow-[0_0_22px_rgba(251,191,36,0.45)]";
    case "epic":
      return "hover:shadow-[0_0_20px_rgba(167,139,250,0.38)]";
    case "rare":
      return "hover:shadow-[0_0_18px_rgba(56,189,248,0.32)]";
    default:
      return "hover:shadow-[0_0_16px_rgba(255,200,120,0.28)]";
  }
}

export function FramePicker({ previewCosmetic, selectedFrameId, onSelect, fallbackPhotoURL, displayName }: Props) {
  useEffect(() => {
    preloadFrameAssets();
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold leading-relaxed text-[#bc7a45]">
        معاينة حية — صورتك مع كل إطار. مرّر أفقياً على الجوال.
      </p>
      <div
        className={`-mx-1 flex gap-3 overflow-x-auto overflow-y-visible overscroll-x-contain px-1 pb-2 pt-1 sm:grid sm:max-h-[min(52vh,460px)] sm:grid-cols-3 sm:overflow-y-auto sm:overflow-x-visible sm:pb-3 lg:grid-cols-4`}
        style={{ scrollSnapType: "x mandatory" }}
      >
        {FRAME_REGISTRY.map((f, index) => {
          const selected = selectedFrameId === f.id;
          const cosmetic: PlayerCosmetic = { ...previewCosmetic, avatarFrameId: f.id };
          return (
            <motion.button
              key={f.id}
              type="button"
              aria-label={`إطار ${index + 1}`}
              style={{ scrollSnapAlign: "center" }}
              whileHover={{ scale: 1.035, y: -3 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                resumeAudioContext();
                playUIButton();
                onSelect(f.id);
              }}
              className={`relative flex min-w-[6.25rem] shrink-0 flex-col items-center justify-center gap-0 rounded-2xl px-2.5 py-3.5 ring-2 transition-shadow duration-200 sm:min-w-0 ${frameCardSurfaceClass(f.rarity)} ${rarityGlow(f.rarity)} ${
                selected
                  ? "ring-[#FF9F0A] shadow-[0_10px_32px_rgba(255,159,10,0.38)]"
                  : "ring-[#f4d4b0]/70 shadow-sm"
              } `}
            >
              <div className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center sm:h-[4.25rem] sm:w-[4.25rem]">
                <ProfileAvatar
                  cosmetic={cosmetic}
                  fallbackPhotoURL={fallbackPhotoURL}
                  displayName={displayName}
                  size="md"
                />
              </div>
              {selected ? (
                <span className="absolute -bottom-1 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#FF9F0A] to-[#FF6B00] shadow-sm" />
              ) : null}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
