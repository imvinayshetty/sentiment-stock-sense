import { useEffect, useRef } from "react";

export type ExitReason = "stop_loss" | "target_reached";

/**
 * Watches live prices for positions that carry a stop-loss and/or target level
 * and fires the callback once per breach. Prices come from the existing quote
 * polling, so this effect only re-evaluates when a new quote batch arrives.
 */
export function useAutoExitMonitoring(
  positions: { symbol: string; stopLossPrice?: number; targetPrice?: number }[],
  priceMap: Map<string, number>,
  onExitTriggered: (symbol: string, exitPrice: number, reason: ExitReason) => void,
) {
  // Guard against firing repeatedly for the same position while state settles.
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const active = new Set(
      positions
        .filter((p) => p.stopLossPrice != null || p.targetPrice != null)
        .map((p) => p.symbol),
    );
    // Reset the guard for symbols that no longer have an active auto-exit rule.
    firedRef.current.forEach((s) => {
      if (!active.has(s)) firedRef.current.delete(s);
    });

    positions.forEach((p) => {
      if (p.stopLossPrice == null && p.targetPrice == null) return;
      if (firedRef.current.has(p.symbol)) return;
      const price = priceMap.get(p.symbol);
      if (!price || price <= 0) return;

      if (p.stopLossPrice != null && price <= p.stopLossPrice) {
        firedRef.current.add(p.symbol);
        onExitTriggered(p.symbol, price, "stop_loss");
        return;
      }
      if (p.targetPrice != null && price >= p.targetPrice) {
        firedRef.current.add(p.symbol);
        onExitTriggered(p.symbol, price, "target_reached");
      }
    });
  }, [positions, priceMap, onExitTriggered]);
}
