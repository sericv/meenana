"use client";

import { getFrameDefinition } from "@/lib/profile/cosmetics";

type Props = {
  frameId: string;
  sizePx: number;
  active?: boolean;
  children: React.ReactNode;
};

/**
 * Circular avatar with an optional animated GIF frame as a true overlay
 * (centered, `object-contain`, preserves transparency). GIFs use `<img>` so
 * animation is not stripped by the image optimizer.
 */
export function AvatarFrame({ frameId, sizePx, active = false, children }: Props) {
  const def = getFrameDefinition(frameId);
  const s = sizePx;
  const overlayScale = Math.max(1, def.overlayScale);
  const outer = s * overlayScale;

  if (!def.src) {
    return (
      <div className="relative inline-flex items-center justify-center" style={{ width: s, height: s }}>
        {children}
      </div>
    );
  }

  const ow = Math.round(s * overlayScale);
  const oh = Math.round(s * overlayScale);

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-visible ${active ? "drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]" : ""}`}
      style={{ width: outer, height: outer }}
    >
      <div
        className="relative z-[1] flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ width: s, height: s }}
      >
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- GIF animation must not go through `next/image` optimization */}
      <img
        src={def.src}
        alt=""
        width={ow}
        height={oh}
        decoding="async"
        loading="lazy"
        draggable={false}
        className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
        style={{ width: ow, height: oh, maxWidth: ow, maxHeight: oh }}
      />
    </div>
  );
}
