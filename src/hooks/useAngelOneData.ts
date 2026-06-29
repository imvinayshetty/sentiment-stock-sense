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
    refetchInterval: 45000,
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

async function callFunction(fn: string, params: Record<string, string> = {}) {
  const queryParams = new URLSearchParams(params).toString();
  const res = await fetch(`${PROJECT_URL}/functions/v1/${fn}?${queryParams}`, {
    headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
  });
  if (!res.ok) throw new Error(`Edge function error: ${await res.text()}`);
  return res.json();
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
    staleTime: 55 * 60 * 1000,
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
    refetchOnWindowFocus: true,
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
        recent: result.recent ?? [],
      };
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
