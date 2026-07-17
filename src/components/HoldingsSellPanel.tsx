import { TrendingDown } from "lucide-react";
import { useForecast, useNewsSentiment, useStockQuotes } from "@/hooks/useAngelOneData";
import type { Holding } from "@/hooks/useUserSettings";

interface Props {
  holdings: Holding[];
  onSelect: (symbol: string) => void;
  selectedSymbol: string;
}

type Recommendation = "SELL" | "HOLD" | "STRONG SELL";

function HoldingRow({
  holding,
  currentPrice,
  onSelect,
  selected,
}: {
  holding: Holding;
  currentPrice: number | undefined;
  onSelect: (s: string) => void;
  selected: boolean;
}) {
  const { data: forecast, isLoading: fLoading } = useForecast(holding.symbol);
  const { data: sentiment } = useNewsSentiment(holding.symbol);

  const price = currentPrice ?? forecast?.lastPrice ?? holding.buyPrice;
  const pnl = (price - holding.buyPrice) * holding.quantity;
  const pnlPct = holding.buyPrice > 0 ? ((price - holding.buyPrice) / holding.buyPrice) * 100 : 0;

  // Signal scoring: combine forecast direction, sentiment, RSI, MACD.
  let recommendation: Recommendation = "HOLD";
  let targetPrice: number | null = null;
  let reasons: string[] = [];

  if (forecast && forecast.forecast.length > 0) {
    const fc = forecast.forecast;
    const day7 = fc[fc.length - 1];
    const forecastChangePct = ((day7.forecast - price) / price) * 100;
    const sentScore = sentiment?.score ?? 50;
    const rsi = forecast.indicators?.rsi ?? 50;
    const macd = forecast.indicators?.macd ?? 0;
    const macdSig = forecast.indicators?.macdSignal ?? 0;

    // Normalize MACD histogram by price so high-price stocks don't dominate
    // (raw MACD scales with price; percentage-based makes it comparable).
    const macdNorm = Math.max(
      -1,
      Math.min(1, ((macd - macdSig) / (price || 1)) * 200),
    );

    // Weighted score: positive = hold, negative = sell.
    const score =
      forecastChangePct * 1.0 +
      (sentScore - 50) * 0.05 +
      -(rsi - 50) * 0.05 +
      macdNorm * 0.5;

    if (forecastChangePct < 0) reasons.push(`Forecast ${forecastChangePct.toFixed(1)}%`);
    else reasons.push(`Forecast +${forecastChangePct.toFixed(1)}%`);
    if (rsi > 70) reasons.push(`RSI ${rsi.toFixed(0)} overbought`);
    else if (rsi < 30) reasons.push(`RSI ${rsi.toFixed(0)} oversold`);
    if (macd < macdSig) reasons.push("MACD bearish");
    if (sentiment) reasons.push(`Sentiment ${sentScore}`);

    if (score < -1.5 || rsi > 75) recommendation = "STRONG SELL";
    else if (score < 0) recommendation = "SELL";
    else recommendation = "HOLD";

    // For SELL/STRONG SELL show the model's expected 7-day price (may be below
    // current price). For HOLD show the forecast peak upper band as an upside
    // reference.
    if (recommendation === "HOLD") {
      const peak = fc.reduce((m, p) => (p.upper > m ? p.upper : m), fc[0].upper);
      targetPrice = Math.max(price, peak);
    } else {
      targetPrice = day7.forecast;
    }
  }

  const isSell = recommendation !== "HOLD";
  const badgeClass =
    recommendation === "STRONG SELL"
      ? "bg-chart-down/20 text-chart-down border-chart-down/40"
      : recommendation === "SELL"
        ? "bg-chart-down/10 text-chart-down border-chart-down/30"
        : "bg-chart-neutral/10 text-chart-neutral border-chart-neutral/30";

  return (
    <button
      onClick={() => onSelect(holding.symbol)}
      className={`w-full rounded-lg border p-3 text-left transition-all hover:border-primary/50 ${
        selected ? "border-primary bg-primary/10 card-glow" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-foreground">{holding.symbol}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {holding.quantity} @ ₹{holding.buyPrice.toFixed(2)}
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
          {fLoading ? "..." : recommendation}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm text-foreground">₹{price.toFixed(2)}</span>
        <span className={`font-mono text-xs ${pnl >= 0 ? "text-chart-up" : "text-chart-down"}`}>
          {pnl >= 0 ? "+" : ""}₹{pnl.toFixed(0)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
        </span>
      </div>
      {targetPrice != null && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {isSell ? "Expected in 7d" : "Upside target"}:{" "}
          <span className="font-mono text-foreground">₹{targetPrice.toFixed(2)}</span>
        </div>
      )}
      {reasons.length > 0 && (
        <div className="mt-1 truncate text-[10px] text-muted-foreground/80">{reasons.join(" · ")}</div>
      )}
    </button>
  );
}

const HoldingsSellPanel = ({ holdings, onSelect, selectedSymbol }: Props) => {
  const { data: quotes } = useStockQuotes();
  const priceMap = new Map((quotes?.data ?? []).map((q) => [q.symbol, q.price]));

  return (
    <section className="rounded-lg border border-chart-down/30 bg-chart-down/5 p-3">
      <header className="mb-2 flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-chart-down" />
        <h2 className="text-sm font-semibold text-foreground">Your Holdings — Sell Suggestions</h2>
        <span className="ml-auto text-xs text-muted-foreground">Forecast + sentiment + RSI/MACD</span>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {holdings.map((h) => (
          <HoldingRow
            key={h.symbol}
            holding={h}
            currentPrice={priceMap.get(h.symbol)}
            onSelect={onSelect}
            selected={selectedSymbol === h.symbol}
          />
        ))}
      </div>
    </section>
  );
};

export default HoldingsSellPanel;