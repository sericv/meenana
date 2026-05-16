"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { DefaultAvatarIllustration } from "@/components/profile/DefaultAvatarIllustration";
import { DEFAULT_AVATAR_ID, type PlayerCosmetic } from "@/lib/profile/cosmetics";

const SIZE_MAP = {
  xs: 28,
  sm: 36,
  md: 52,
  lg: 72,
  xl: 96,
} as const;

export type ProfileAvatarSize = keyof typeof SIZE_MAP;

type Props = {
  cosmetic: PlayerCosmetic | null | undefined;
  /** Fallback when Firestore has no photo (e.g. Firebase Auth photo). */
  fallbackPhotoURL?: string | null;
  displayName?: string;
  size?: ProfileAvatarSize;
  active?: boolean;
  /** Pulsing green dot (e.g. searching / your turn). */
  showPulseDot?: boolean;
  /** Subtle idle bob for lobby / home presence. */
  idle?: boolean;
  className?: string;
};

export function ProfileAvatar({
  cosmetic,
  fallbackPhotoURL,
  displayName,
  size = "md",
  active = false,
  showPulseDot = false,
  idle = false,
  className = "",
}: Props) {
  const px = SIZE_MAP[size];
  const photo = cosmetic?.photoURL ?? fallbackPhotoURL ?? null;
  const frameId = cosmetic?.avatarFrameId ?? "none";
  const avatarKey = cosmetic?.avatarId ?? DEFAULT_AVATAR_ID;

  const inner = (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#fff8e8] to-[#ffd7a8]"
      style={{
        width: px,
        height: px,
        boxShadow: active
          ? "inset 0 2px 0 rgba(255,255,255,0.55), 0 0 0 2px rgba(255,200,80,0.55)"
          : "inset 0 2px 0 rgba(255,255,255,0.45), 0 0 0 1.5px rgba(244,196,141,0.45)",
      }}
    >
      {photo ? (
        <Image src={photo} alt="" fill className="object-cover" sizes={`${px}px`} unoptimized />
      ) : (
        <DefaultAvatarIllustration avatarId={avatarKey} size={px} />
      )}
      {!photo && (
        <span className="pointer-events-none absolute inset-x-2 top-1 h-1.5 rounded-full bg-white/35 blur-[1px]" />
      )}
    </div>
  );

  const wrapped = (
    <motion.div
      className={`relative inline-flex ${className}`}
      animate={idle ? { y: [0, -2, 0] } : undefined}
      transition={idle ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <AvatarFrame frameId={frameId} sizePx={px} active={active}>
        {inner}
      </AvatarFrame>
      {showPulseDot ? (
        <motion.span
          aria-hidden
          animate={{ scale: [1, 1.25, 1], opacity: [1, 0.75, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white"
        />
      ) : null}
    </motion.div>
  );

  return wrapped;
}
