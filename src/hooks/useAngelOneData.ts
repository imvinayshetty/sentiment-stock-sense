import { useQuery } from "@tanstack/react-query";
import type { StockQuote, PredictionData } from "@/lib/stockData";

export type MarketStatus = "OPEN" | "CLOSED";
export interface QuotesPayload {
  data: StockQuote[];
  marketStatus: MarketStatus;
  istTime: string;
  source: "live" | "last-close";
}

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callEdgeFunction(action: string, params: Record<string, string> = {}) {
  const queryParams = new URLSearchParams({ action, ...params }).toString();

  const res = await fetch(`${PROJECT_URL}/functions/v1/angel-one-data?${queryParams}`, {
    headers: {
      "Authorization": `Bearer ${ANON_KEY}`,
      "apikey": ANON_KEY,
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Edge function error: ${errBody}`);
  }

  return res.json();
}

export function useStockQuotes() {
  return useQuery<QuotesPayload>({
    queryKey: ["stock-quotes"],
    queryFn: async () => {
      const result = await callEdgeFunction("quotes");
      if (!result.success) throw new Error(result.error);
      return {
        data: result.data ?? [],
        marketStatus: result.marketStatus ?? "CLOSED",
        istTime: result.istTime ?? "",
        source: result.source ?? "live",
      };
    },
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  });
}

export function useHistoricalData(symbol: string) {
  return useQuery<PredictionData[]>({
    queryKey: ["historical", symbol],
    queryFn: async () => {
      const result = await callEdgeFunction("historical", { symbol });
      if (!result.success) throw new Error(result.error);

      // Transform Angel One candle data [timestamp, open, high, low, close, volume]
      return (result.data || []).map((candle: any[]) => ({
        date: new Date(candle[0]).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        actual: candle[4], // close price
        open: candle[1],
        high: candle[2],
        low: candle[3],
        volume: candle[5],
      }));
    },
    enabled: !!symbol,
    staleTime: 60000,
    retry: 1,
  });
}
