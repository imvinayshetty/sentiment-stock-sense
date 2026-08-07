import { useEffect, useRef } from "react";

/**
 * Watches live prices for positions that carry a stop-loss level and fires the
 * callback once per breach. Prices come from the existing quote polling, so this
 * effect only re-evaluates when a new quote batch arrives (no 1s polling loop).
 */
export function useStopLossMonitoring(
  positions: { symbol: string; stopLossPrice?: number }[],
  priceMap: Map<string, number>,
  onStopLossHit: (symbol: string, exitPrice: number) => void,
) {
  // Guard against firing repeatedly for the same position while state settles.
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const active = new Set(
      positions.filter((p) => p.stopLossPrice != null).map((p) => p.symbol),
    );
    // Reset the guard for symbols that no longer have an active stop loss.
    firedRef.current.forEach((s) => {
      if (!active.has(s)) firedRef.current.delete(s);
    });

    positions.forEach((p) => {
      if (p.stopLossPrice == null) return;
      if (firedRef.current.has(p.symbol)) return;
      const price = priceMap.get(p.symbol);
      if (!price || price <= 0) return;
      if (price <= p.stopLossPrice) {
        firedRef.current.add(p.symbol);
        onStopLossHit(p.symbol, price);
      }
    });
  }, [positions, priceMap, onStopLossHit]);
}
