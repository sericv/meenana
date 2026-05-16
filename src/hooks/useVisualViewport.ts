"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight VisualViewport sync for **diagnostics / legacy footers only**.
 *
 * **Does not** set `--app-vh` from `visualViewport.height` anymore: tying the
 * whole document (or a `h-[var(--app-vh)]` room shell) to the visual viewport
 * while `<html>` used `height: 100%` (layout viewport) produced empty “beige”
 * bands on iOS Safari when the soft keyboard opened (double height story).
 *
 * Still exposes:
 *   • --vv-top / --vv-left / --vv-width
 *   • --kbd-h + `html.kbd-open` for `.kbd-safe` on **non-room** pages only
 */
export function useVisualViewport(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const vv = window.visualViewport;

    let raf = 0;
    const apply = () => {
      raf = 0;
      const fullH = window.innerHeight;
      const visibleH = vv?.height ?? fullH;
      const top = vv ? Math.round(vv.offsetTop) : 0;
      const left = vv ? Math.round(vv.offsetLeft) : 0;
      const kbd = Math.max(0, Math.round(fullH - visibleH));
      const vw = vv ? Math.round(vv.width) : Math.round(window.innerWidth);
      root.style.setProperty("--vv-top", `${top}px`);
      root.style.setProperty("--vv-left", `${left}px`);
      root.style.setProperty("--vv-width", `${vw}px`);
      root.style.setProperty("--kbd-h", `${kbd}px`);
      if (kbd > 80) root.classList.add("kbd-open");
      else root.classList.remove("kbd-open");
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(apply);
    };

    apply();

    if (vv) {
      vv.addEventListener("resize", schedule);
      vv.addEventListener("scroll", schedule);
    }
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, []);
}

/**
 * Pixels of layout viewport covered from below by the keyboard / browser UI
 * (iOS overlay keyboard). Use **only** while the chat composer is focused —
 * add to the composer/footer `padding-bottom` so the message list shrinks
 * (`flex-1 min-h-0`) without resizing the whole page to `visualViewport.height`.
 */
export function useVisualKeyboardOverlapPx(active: boolean): number {
  const [px, setPx] = useState(0);

  useEffect(() => {
    if (!active) {
      setPx(0);
      return;
    }
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const read = () => {
      if (!vv) {
        setPx(0);
        return;
      }
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height));
      setPx(overlap);
    };
    read();
    vv?.addEventListener("resize", read);
    vv?.addEventListener("scroll", read);
    window.addEventListener("resize", read);
    return () => {
      vv?.removeEventListener("resize", read);
      vv?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [active]);

  return px;
}
