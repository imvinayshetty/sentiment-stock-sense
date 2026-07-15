import { useStockQuotes, useForecast } from "@/hooks/useAngelOneData";
import { getStockMeta } from "@/lib/stockData";
import { ArrowUpRight, ArrowDownRight, BarChart3, DollarSign, Activity, TrendingUp, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface StockDetailProps {
  symbol: string;
}

const StockDetail = ({ symbol }: StockDetailProps) => {
  const { data: quotes } = useStockQuotes();
  const { data: forecastData } = useForecast(symbol);
  const liveStock = quotes?.data?.find((s) => s.symbol === symbol);
  const marketOpen = quotes?.marketStatus === "OPEN";
  const stockMeta = getStockMeta(symbol);
  const stock = liveStock;
  if (!stock) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">{symbol}</h2>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">NSE</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{stockMeta?.name ?? "Waiting for verified market data"}</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">No verified price</span>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Live backend data is required before this stock can be shown.
        </p>
      </div>
    );
  }

  const isUp = stock.change >= 0;

  // Forward-looking levels from the 7-day forecast band: lower = support (buy zone),
  // upper = resistance (sell zone). Only shown when a forecast is available.
  const day7 = forecastData?.forecast?.[forecastData.forecast.length - 1];
  const recommendedBuy = day7?.lower;
  const recommendedSell = day7?.upper;

  // Technical-indicator signal row (RSI / MACD) + combined momentum confidence label.
  const ind = forecastData?.indicators;
  const rsiLabel = ind ? (ind.rsi >= 70 ? "Overbought" : ind.rsi <= 30 ? "Oversold" : "Neutral") : null;
  const macdLabel = ind ? (ind.macd >= ind.macdSignal ? "Bullish cross" : "Bearish cross") : null;
  const momentum = ind?.momentum ?? 0;
  const signalLabel =
    momentum >= 0.3 ? "Strong Bullish Signal"
    : momentum >= 0.1 ? "Mild Bullish Signal"
    : momentum <= -0.3 ? "Strong Bearish Signal"
    : momentum <= -0.1 ? "Mild Bearish Signal"
    : "Neutral / Weak Signal";
  const signalColor =
    momentum >= 0.1 ? "text-chart-up" : momentum <= -0.1 ? "text-chart-down" : "text-muted-foreground";

  const stats = [
    { label: "Open", value: `₹${stock.open.toFixed(2)}`, icon: DollarSign },
    { label: "High", value: `₹${stock.high.toFixed(2)}`, icon: TrendingUp },
    { label: "Low", value: `₹${stock.low.toFixed(2)}`, icon: Activity },
    ...(recommendedSell != null ? [{ label: "Sell (7d resist.)", value: `₹${recommendedSell.toFixed(2)}`, icon: ArrowUpCircle }] : []),
    ...(recommendedBuy != null ? [{ label: "Buy (7d support)", value: `₹${recommendedBuy.toFixed(2)}`, icon: ArrowDownCircle }] : []),
    { label: "Volume", value: stock.volume, icon: BarChart3 },
    { label: "Exchange", value: stock.exchange || "NSE", icon: DollarSign },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-glow sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">{stock.symbol}</h2>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">NSE</span>
            {liveStock && marketOpen && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                LIVE
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{stock.name}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-foreground text-glow sm:text-3xl">₹{stock.price.toFixed(2)}</div>
          <div className={`mt-1 flex items-center justify-end gap-1 font-mono text-sm ${isUp ? "text-chart-up" : "text-chart-down"}`}>
            {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {isUp ? "+" : ""}{stock.change.toFixed(2)} ({isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-secondary/50 p-2 text-center sm:p-3">
            <stat.icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <div className="font-mono text-sm font-semibold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
      {ind && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-xs">
          <span className="text-muted-foreground">
            RSI(14): <span className="font-mono font-semibold text-foreground">{ind.rsi}</span>{" "}
            <span className="text-muted-foreground">({rsiLabel})</span>
          </span>
          <span className="text-muted-foreground">
            MACD: <span className="font-mono font-semibold text-foreground">{ind.macd}</span> /{" "}
            <span className="font-mono text-foreground">{ind.macdSignal}</span>{" "}
            <span className="text-muted-foreground">({macdLabel})</span>
          </span>
          <span className={`ml-auto font-semibold ${signalColor}`}>{signalLabel}</span>
        </div>
      )}
    </div>
  );
};

export default StockDetail;
