import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStockQuotes } from "./useAngelOneData";
import { useUserSettings } from "./useUserSettings";
import { getStockDirectory, type StockQuote } from "@/lib/stockData";

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SESSION_KEY = "demo-trading-session-id";

export function getBasketSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return "anonymous";
    }
  }
}

export function scoreStock(s: StockQuote): number {
  const move = s.changePercent ?? 0;
  const range = (s.high ?? s.price) - (s.low ?? s.price);
  const pos = range > 0 ? (s.price - (s.low ?? s.price)) / range : 0.5;
  const gap = s.open ? ((s.price - s.open) / s.open) * 100 : 0;
  return move * 1.0 + (pos - 0.5) * 2 + gap * 0.3;
}

/**
 * Shared "Top 10 to buy" allocation. Splits the total budget into up to 10
 * equal slots and greedily fills each with the highest-ranked affordable stock,
 * producing a diversified mix. Used by both the suggestion list and the daily
 * prediction-accuracy panel so both always describe the same basket.
 */
export function useDailyBasket() {
  const { settings } = useUserSettings();
  const budgetMax = settings.budgetMax;
  const { data: quotes, isLoading } = useStockQuotes();
  const liveStocks = quotes?.data ?? [];
  const directory = getStockDirectory();

  const stocks = useMemo<StockQuote[]>(() => {
    const liveMap = new Map(liveStocks.map((s) => [s.symbol, s]));
    return directory
      .map((entry) => liveMap.get(entry.symbol))
      .filter((stock): stock is StockQuote => Boolean(stock));
  }, [directory, liveStocks]);

  const ranked = useMemo(() => [...stocks].sort((a, b) => scoreStock(b) - scoreStock(a)), [stocks]);

  const { topBuy, suggestedQty } = useMemo(() => {
    if (budgetMax == null) {
      return { topBuy: ranked.slice(0, 10), suggestedQty: new Map<string, number>() };
    }
    let remaining = budgetMax;
    const picks: StockQuote[] = [];
    const qty = new Map<string, number>();
    const used = new Set<string>();
    for (let slot = 0; slot < 10 && remaining > 0; slot++) {
      const perSlot = remaining / (10 - slot);
      const candidate = ranked.find((s) => !used.has(s.symbol) && s.price > 0 && s.price <= perSlot);
      if (!candidate) continue;
      const shares = Math.max(1, Math.floor(perSlot / candidate.price));
      const cost = shares * candidate.price;
      if (cost > remaining) continue;
      used.add(candidate.symbol);
      picks.push(candidate);
      qty.set(candidate.symbol, shares);
      remaining -= cost;
    }
    return { topBuy: picks, suggestedQty: qty };
  }, [ranked, budgetMax]);

  return { stocks, ranked, topBuy, suggestedQty, budgetMax, isLoading, marketStatus: quotes?.marketStatus };
}

// ---------- Daily basket prediction accuracy ----------
export interface BasketRow {
  symbol: string;
  base_price: number;
  predicted_close: number;
  direction: string;
  close_price: number | null;
  correct: boolean | null;
}
export interface BasketAccuracyPayload {
  basketDate: string;
  phase: "open" | "closed";
  tradingToday: boolean;
  rows: BasketRow[];
  scored: number;
  correct: number;
  accuracy: number | null;
  mae: number | null;
  mape: number | null;
}

export function useBasketAccuracy(symbols: string[]) {
  const list = [...symbols].sort().join(",");
  return useQuery<BasketAccuracyPayload>({
    queryKey: ["basket-accuracy", list],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: "basket",
        session: getBasketSessionId(),
        symbols: list,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(`${PROJECT_URL}/functions/v1/angel-one-data?${params}`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
        });
        if (!res.ok) throw new Error(`Edge function error: ${await res.text()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error ?? "Basket analysis failed");
        return result as BasketAccuracyPayload;
      } finally {
        clearTimeout(timer);
      }
    },
    enabled: symbols.length > 0,
    // Re-check a few times an hour: the open snapshot is recorded once, then
    // rows are scored after the 15:30 IST close.
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
