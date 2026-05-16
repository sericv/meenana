"use client";

import { useId } from "react";
import { DEFAULT_AVATAR_ID, isValidAvatarId } from "@/lib/profile/cosmetics";

type Props = {
  avatarId: string;
  /** Pixel width/height of the square avatar circle. */
  size: number;
};

/**
 * Soft illustrated placeholder avatars (warm social palette) — no emoji.
 */
export function DefaultAvatarIllustration({ avatarId, size }: Props) {
  const key = useId().replace(/:/g, "");
  const v = isValidAvatarId(avatarId) ? avatarId : DEFAULT_AVATAR_ID;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="pointer-events-none block shrink-0 select-none"
      aria-hidden
    >
      <IllustrationInner variant={v} gid={key} />
    </svg>
  );
}

function IllustrationInner({ variant, gid }: { variant: string; gid: string }) {
  const bg = (a: string, b: string) => (
    <linearGradient id={`${gid}-bg`} x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stopColor={a} />
      <stop offset="100%" stopColor={b} />
    </linearGradient>
  );
  switch (variant) {
    case "fox": {
      return (
        <>
          <defs>{bg("#ffe8d4", "#ff9f5a")}</defs>
          <circle cx="50" cy="52" r="40" fill={`url(#${gid}-bg)`} />
          <ellipse cx="34" cy="30" rx="10" ry="18" fill="#ff7a3a" opacity="0.95" transform="rotate(-18 34 30)" />
          <ellipse cx="66" cy="30" rx="10" ry="18" fill="#ff7a3a" opacity="0.95" transform="rotate(18 66 30)" />
          <ellipse cx="50" cy="56" rx="28" ry="24" fill="#fffaf0" opacity="0.9" />
          <ellipse cx="50" cy="58" rx="22" ry="8" fill="#ffd8b8" opacity="0.55" />
          <circle cx="40" cy="52" r="4.5" fill="#5c2d12" />
          <circle cx="60" cy="52" r="4.5" fill="#5c2d12" />
          <ellipse cx="50" cy="62" rx="5" ry="3" fill="#ff8a65" opacity="0.5" />
        </>
      );
    }
    case "lion": {
      return (
        <>
          <defs>
            {bg("#fff2d6", "#ffb347")}
            <radialGradient id={`${gid}-mane`} cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#ffd27a" />
              <stop offset="100%" stopColor="#ff8c42" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="52" r="42" fill={`url(#${gid}-mane)`} />
          <circle cx="50" cy="54" r="30" fill={`url(#${gid}-bg)`} />
          <path
            d="M50 28 L54 36 L62 32 L60 40 L68 42 L60 46 L62 54 L54 50 L50 58 L46 50 L38 54 L40 46 L32 42 L40 40 L38 32 L46 36 Z"
            fill="#fff2cc"
            opacity="0.55"
          />
          <circle cx="42" cy="52" r="3.8" fill="#4a2410" />
          <circle cx="58" cy="52" r="3.8" fill="#4a2410" />
          <path d="M44 62 Q50 66 56 62" stroke="#c45c2c" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    }
    case "panda": {
      return (
        <>
          <defs>{bg("#f5f5f5", "#e8e0dc")}</defs>
          <circle cx="50" cy="54" r="36" fill={`url(#${gid}-bg)`} />
          <ellipse cx="34" cy="38" rx="14" ry="16" fill="#3d2c29" />
          <ellipse cx="66" cy="38" rx="14" ry="16" fill="#3d2c29" />
          <ellipse cx="50" cy="60" rx="22" ry="18" fill="#faf8f6" />
          <ellipse cx="40" cy="56" rx="5" ry="6" fill="#3d2c29" />
          <ellipse cx="60" cy="56" rx="5" ry="6" fill="#3d2c29" />
          <ellipse cx="50" cy="64" rx="6" ry="4" fill="#ffd6e0" opacity="0.85" />
        </>
      );
    }
    case "robot": {
      return (
        <>
          <defs>{bg("#e8f4ff", "#b8d9ff")}</defs>
          <rect x="22" y="30" width="56" height="48" rx="14" fill={`url(#${gid}-bg)`} />
          <rect x="30" y="40" width="40" height="22" rx="8" fill="#1e3a5f" opacity="0.88" />
          <circle cx="40" cy="50" r="5" fill="#7cf0ff" />
          <circle cx="60" cy="50" r="5" fill="#7cf0ff" />
          <rect x="44" y="58" width="12" height="3" rx="1.5" fill="#7cf0ff" opacity="0.7" />
          <rect x="46" y="22" width="8" height="12" rx="3" fill="#ffd29a" />
          <circle cx="50" cy="20" r="5" fill="#ffb36b" />
        </>
      );
    }
    case "alien": {
      return (
        <>
          <defs>{bg("#e6ffe8", "#7bed9f")}</defs>
          <ellipse cx="50" cy="54" rx="34" ry="38" fill={`url(#${gid}-bg)`} />
          <ellipse cx="28" cy="48" rx="9" ry="6" fill="#58d68d" opacity="0.9" />
          <ellipse cx="72" cy="48" rx="9" ry="6" fill="#58d68d" opacity="0.9" />
          <ellipse cx="50" cy="52" rx="22" ry="18" fill="#c8ffd4" opacity="0.95" />
          <ellipse cx="41" cy="52" rx="5" ry="7" fill="#1f5f3a" />
          <ellipse cx="59" cy="52" rx="5" ry="7" fill="#1f5f3a" />
          <ellipse cx="50" cy="64" rx="8" ry="4" fill="#8ef5b0" opacity="0.7" />
        </>
      );
    }
    case "ghost": {
      return (
        <>
          <defs>{bg("#f3e8ff", "#d4b5ff")}</defs>
          <path
            d="M50 22 C30 22 24 38 24 52 L24 72 L32 66 L40 74 L50 68 L60 74 L68 66 L76 72 L76 52 C76 38 70 22 50 22 Z"
            fill={`url(#${gid}-bg)`}
          />
          <ellipse cx="50" cy="48" rx="20" ry="18" fill="#fff" opacity="0.55" />
          <circle cx="42" cy="48" r="4" fill="#5b21b6" />
          <circle cx="58" cy="48" r="4" fill="#5b21b6" />
          <path d="M44 58 Q50 62 56 58" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    }
    case "crown": {
      return (
        <>
          <defs>{bg("#fff8e1", "#ffd54f")}</defs>
          <circle cx="50" cy="56" r="36" fill={`url(#${gid}-bg)`} />
          <path
            d="M26 48 L34 58 L50 38 L66 58 L74 48 L70 72 L30 72 Z"
            fill="#fff"
            opacity="0.9"
            stroke="#f4a020"
            strokeWidth="1.5"
          />
          <circle cx="34" cy="48" r="4" fill="#ff7043" />
          <circle cx="50" cy="40" r="4.5" fill="#ff7043" />
          <circle cx="66" cy="48" r="4" fill="#ff7043" />
          <ellipse cx="50" cy="60" rx="14" ry="10" fill="#fff3c4" opacity="0.85" />
        </>
      );
    }
    case "star":
    default: {
      return (
        <>
          <defs>
            {bg("#fff5e6", "#ffb347")}
            <radialGradient id={`${gid}-glow`} cx="40%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="52" r="40" fill={`url(#${gid}-bg)`} />
          <circle cx="50" cy="48" r="26" fill={`url(#${gid}-glow)`} />
          <path
            d="M50 20 L56.5 39.2 L76.4 39.2 L60 51.4 L66.5 70.6 L50 58.4 L33.5 70.6 L40 51.4 L23.6 39.2 L43.5 39.2 Z"
            fill="#fff"
            fillOpacity="0.42"
            stroke="#fff7e8"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="54" r="10" fill="#ffecd2" fillOpacity="0.55" />
        </>
      );
    }
  }
}
