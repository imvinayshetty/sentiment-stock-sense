import { useEffect, useRef } from "react";

export interface AutoBuyRuleLike {
  id: string;
  symbol: string;
  triggerPrice: number;
  status: "active" | "filled" | "cancelled";
}

/**
 * Watches live prices for active auto-buy rules and fires the callback once per
 * rule when the price falls to or below its trigger level. Rules are one-shot:
 * the caller marks them filled, and the local guard prevents a double fire
 * while that state settles.
 */
export function useAutoBuyMonitoring(
  rules: AutoBuyRuleLike[],
  priceMap: Map<string, number>,
  onTriggered: (ruleId: string, price: number) => void,
) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const active = new Set(rules.filter((r) => r.status === "active").map((r) => r.id));
    firedRef.current.forEach((id) => {
      if (!active.has(id)) firedRef.current.delete(id);
    });

    rules.forEach((r) => {
      if (r.status !== "active") return;
      if (firedRef.current.has(r.id)) return;
      const price = priceMap.get(r.symbol);
      if (!price || price <= 0) return;
      if (price <= r.triggerPrice) {
        firedRef.current.add(r.id);
        onTriggered(r.id, price);
      }
    });
  }, [rules, priceMap, onTriggered]);
}
