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
}

export interface BreakevenPayload {
  budget: number;
  marketStatus: "OPEN" | "CLOSED";
  istTime: string;
  priceSource: "live" | "last-close";
  rows: BreakevenRow[];
  profitableCount: number;
  skippedCount: number;
  totalProjectedProfit: number;
  totalMargin: number;
}

/**
 * Per-stock intraday breakeven analysis: Angel One round-trip charges vs the
 * day's forecast gain, plus a margin-sized share suggestion per stock.
 */
export function useIntradayBreakeven(symbols: string[], budget: number | null, enabled = true) {
  const list = [...symbols].sort().join(",");
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
    enabled: enabled && symbols.length > 0 && !!budget && budget > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
