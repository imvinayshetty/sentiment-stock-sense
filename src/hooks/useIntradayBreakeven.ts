import { useQuery } from "@tanstack/react-query";

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface BreakevenRow {
  symbol: string;
  name: string;
  price: number;
  predictedPrice: number;
  expectedGain: number;
  expectedGainPct: number;
  breakevenPerShare: number;
  breakevenPct: number;
  netPerShare: number;
  profitable: boolean;
  marginPerShare: number;
  marginSource: "api" | "estimate";
  chargeSource: "api" | "estimate";
  priceSource: "live" | "last-close";
  shares: number;
  marginRequired: number;
  totalCharges: number;
  projectedProfit: number;
  /** Share of the budget this position's margin consumes. */
  weightPct?: number;
}

export interface BreakevenPayload {
  budget: number;
  marketStatus: "OPEN" | "CLOSED";
  istTime: string;
  priceSource: "live" | "last-close";
  rows: BreakevenRow[];
  profitableCount: number;
  /** Clears breakeven but one share's margin exceeds its budget slice. */
  unaffordableCount?: number;
  skippedCount: number;
  totalProjectedProfit: number;
  totalMargin: number;
  /** Percentage of the budget actually deployed as margin. */
  budgetUtilisation?: number;
}

/**
 * Per-stock intraday breakeven analysis: Angel One round-trip charges vs the
 * day's forecast gain, plus a margin-sized share suggestion per stock.
 */
export function useIntradayBreakeven(symbols: string[], budget: number | null, enabled = true) {
  const clean = Array.from(
    new Set(symbols.map((s) => (s ?? "").trim().toUpperCase()).filter(Boolean)),
  ).sort();
  const list = clean.join(",");
  return useQuery<BreakevenPayload>({
    queryKey: ["intraday-breakeven", list, budget],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: "breakeven",
        symbols: list,
        budget: String(budget ?? 0),
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await fetch(`${PROJECT_URL}/functions/v1/angel-one-data?${params}`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
        });
        if (!res.ok) throw new Error(`Edge function error: ${await res.text()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error ?? "Breakeven analysis failed");
        return result as BreakevenPayload;
      } finally {
        clearTimeout(timer);
      }
    },
    enabled: enabled && clean.length > 0 && !!budget && budget > 0,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Plain-language AI explanation per tradeable suggestion (cached per day on the server). */
export function useTradeRationale(rows: BreakevenRow[]) {
  const trades = rows
    .filter((r) => r.profitable && r.shares > 0)
    .map((r) => ({
      symbol: r.symbol,
      price: r.price,
      expectedGainPct: r.expectedGainPct,
      breakevenPct: r.breakevenPct,
      netPerShare: r.netPerShare,
      shares: r.shares,
      projectedProfit: r.projectedProfit,
    }));
  const key = trades.map((t) => `${t.symbol}x${t.shares}`).sort().join(",");
  return useQuery<Record<string, string>>({
    queryKey: ["trade-rationale", key],
    queryFn: async () => {
      const params = new URLSearchParams({ action: "trade-rationale", trades: JSON.stringify(trades) });
      const res = await fetch(`${PROJECT_URL}/functions/v1/angel-one-data?${params}`, {
        headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
      });
      if (!res.ok) return {};
      const result = await res.json();
      return (result?.notes ?? {}) as Record<string, string>;
    },
    enabled: trades.length > 0,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 0,
  });
}
