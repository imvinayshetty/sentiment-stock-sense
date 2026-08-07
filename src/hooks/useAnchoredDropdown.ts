import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface AnchoredPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

/**
 * Positions a dropdown panel in the viewport (position: fixed) so it is never
 * clipped by an overflow/scroll ancestor (table x-scroll, dialog y-scroll).
 * Flips above the anchor when there isn't room below, clamps to the viewport
 * horizontally, and closes on outside pointerdown / Escape / resize-scroll.
 */
export function useAnchoredDropdown(open: boolean, onClose: () => void) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<AnchoredPosition | null>(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const below = window.innerHeight - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const flip = below < 160 && above > below;
    const maxHeight = Math.max(120, Math.min(280, flip ? above : below));
    const width = Math.max(rect.width, 220);
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - width - margin),
    );
    setPos({
      left,
      top: flip ? rect.top - gap - maxHeight : rect.bottom + gap,
      width,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return { anchorRef, panelRef, pos, reposition: update };
}
