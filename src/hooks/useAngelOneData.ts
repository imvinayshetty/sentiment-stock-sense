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

// Single fetch wrapper for every edge function call. Pass the function name and
// query params; callers that hit angel-one-data include their own `action` param.
async function callFunction(fn: string, params: Record<string, string> = {}) {
  const queryParams = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${PROJECT_URL}/functions/v1/${fn}?${queryParams}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
    });
    if (!res.ok) throw new Error(`Edge function error: ${await res.text()}`);
    return res.json();
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Edge function timed out: ${fn}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Free-form symbol resolution ----------
export interface ResolvedSymbol {
  symbol: string;
  name: string;
  price: number;
  exchange: string;
  curated: boolean;
}
export async function resolveSymbol(symbol: string): Promise<ResolvedSymbol> {
  const clean = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9&_\-]{1,20}$/.test(clean)) throw new Error("Invalid symbol format");
  const result = await callFunction("angel-one-data", { action: "resolve", symbol: clean });
  if (!result.success) throw new Error(result.error ?? "Symbol not found");
  return {
    symbol: result.symbol,
    name: result.name ?? result.symbol,
    price: Number(result.price ?? 0),
    exchange: result.exchange ?? "NSE",
    curated: Boolean(result.curated),
  };
}

export function useStockQuotes() {
  return useQuery<QuotesPayload>({
    queryKey: ["stock-quotes"],
    queryFn: async () => {
      const result = await callFunction("angel-one-data", { action: "quotes" });
      if (!result.success) throw new Error(result.error);
      return {
        data: result.data ?? [],
        marketStatus: result.marketStatus ?? "CLOSED",
        istTime: result.istTime ?? "",
        source: result.source ?? "live",
      };
    },
    refetchInterval: 45000,
    staleTime: 30000,
    retry: 1,
  });
}

export function useHistoricalData(symbol: string) {
  return useQuery<PredictionData[]>({
    queryKey: ["historical", symbol],
    queryFn: async () => {
      const result = await callFunction("angel-one-data", { action: "historical", symbol });
      if (!result.success) throw new Error(result.error);

      // Transform candle data [timestamp, open, high, low, close, volume].
      // candle[0] is normally an ISO string but defensively handle Unix seconds.
      return (result.data || []).map((candle: any[]) => ({
        date: new Date(isNaN(Number(candle[0])) ? candle[0] : Number(candle[0]) * 1000)
          .toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        actual: candle[4], // close price
        open: candle[1],
        high: candle[2],
        low: candle[3],
        volume: candle[5],
      }));
    },
    enabled: !!symbol,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

// ---------- News sentiment (Google News RSS + Groq) ----------
export interface SentimentArticle {
  title: string;
  source: string;
  time: string;
  link: string;
  sentiment: "positive" | "negative" | "neutral";
}
export interface SentimentPayload {
  symbol: string;
  score: number;
  label: string;
  buzz: number;
  articles: SentimentArticle[];
  scoredBy: "groq" | "default";
}

export function useNewsSentiment(symbol: string) {
  return useQuery<SentimentPayload>({
    queryKey: ["news-sentiment", symbol],
    queryFn: async () => {
      const result = await callFunction("news-sentiment", { symbol });
      if (!result.success) throw new Error(result.error);
      return {
        symbol: result.symbol,
        score: result.score,
        label: result.label,
        buzz: result.buzz ?? 0,
        articles: result.articles ?? [],
        scoredBy: (result.scored_by ?? result.scoredBy ?? "default") as "groq" | "default",
      };
    },
    enabled: !!symbol,
    // Slightly longer than the server cache TTL (60min) so the client never
    // forces a live fetch while the server would still return cached data.
    staleTime: 65 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

// ---------- Forecast (SES + linear regression) ----------
export interface ForecastPoint {
  date: string;
  isoDate: string;
  forecast: number;
  lower: number;
  upper: number;
}
export interface ForecastIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  momentum: number;
}
export interface ForecastPayload {
  lastPrice: number;
  sigma: number;
  indicators?: ForecastIndicators;
  forecast: ForecastPoint[];
}

export function useForecast(symbol: string) {
  return useQuery<ForecastPayload>({
    queryKey: ["forecast", symbol],
    queryFn: async () => {
      const result = await callFunction("angel-one-data", { action: "forecast", symbol });
      if (!result.success) throw new Error(result.error);
      return { lastPrice: result.lastPrice, sigma: result.sigma, indicators: result.indicators, forecast: result.forecast ?? [] };
    },
    enabled: !!symbol,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

// ---------- Backtest (directional accuracy) ----------
export interface BacktestRow {
  symbol: string;
  predicted_at: string;
  horizon_date: string;
  base_price: number;
  predicted_price: number;
  direction: string;
  actual_price: number | null;
  correct: boolean | null;
}
export interface BacktestPayload {
  evaluated: number;
  correct: number;
  directionalAccuracy: number | null;
  mae: number | null;
  mape: number | null;
  withinBandPct: number | null;
  pending: number;
  recent: BacktestRow[];
}

export function useBacktest(symbol?: string) {
  return useQuery<BacktestPayload>({
    queryKey: ["backtest", symbol ?? "all"],
    queryFn: async () => {
      const result = await callFunction("angel-one-data", symbol ? { action: "backtest", symbol } : { action: "backtest" });
      if (!result.success) throw new Error(result.error);
      return {
        evaluated: result.evaluated ?? 0,
        correct: result.correct ?? 0,
        directionalAccuracy: result.directionalAccuracy ?? null,
        mae: result.mae ?? null,
        mape: result.mape ?? null,
        withinBandPct: result.withinBandPct ?? null,
        pending: result.pending ?? 0,
        recent: result.recent ?? [],
      };
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
