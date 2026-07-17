import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { useForecast, useNewsSentiment } from "@/hooks/useAngelOneData";

interface PriceTargetProps {
  symbol: string;
}

const PriceTarget = ({ symbol }: PriceTargetProps) => {
  const { data: forecastData, isLoading } = useForecast(symbol);
  const { data: sentiment } = useNewsSentiment(symbol);
  const score = sentiment?.score ?? 50;
  const label = sentiment?.label ?? "Neutral";
  const isDefaultSentiment = (sentiment?.scoredBy ?? "default") === "default";

  const projections = useMemo(() => {
    const fc = forecastData?.forecast ?? [];
    if (!forecastData || fc.length === 0) return null;
    const price = forecastData.lastPrice;
    const sigma = forecastData.sigma || 0.015;

    // Day 7 comes straight from the backend SES + linear-regression + RSI/MACD model.
    const day7 = fc[fc.length - 1];
    const d7 = {
      expected: day7.forecast,
      low: day7.lower,
      high: day7.upper,
      changePct: ((day7.forecast - price) / price) * 100,
    };

    // 30-day target: extrapolate the same model's per-trading-day growth rate.
    const tradingDays = fc.length; // 7
    const perDayGrowth = price > 0 ? Math.pow(day7.forecast / price, 1 / tradingDays) : 1;
    const isFlat = Math.abs(perDayGrowth - 1) < 0.0001;
    const horizon30 = 30;
    const expected30 = price * Math.pow(perDayGrowth, horizon30);
    const band30 = expected30 * sigma * Math.sqrt(horizon30);
    const d30 = {
      expected: expected30,
      low: expected30 - band30,
      high: expected30 + band30,
      changePct: ((expected30 - price) / price) * 100,
    };

    return { sigma, d7, d30, isFlat };
  }, [forecastData]);

  if (isLoading || !projections) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        </div>
      </div>
    );
  }

  const renderHorizon = (
    title: string,
    p: { expected: number; low: number; high: number; changePct: number },
    note?: string
  ) => {
    const up = p.changePct >= 0;
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
            {note && (
              <span className="rounded-full bg-chart-neutral/15 px-1.5 py-0.5 text-[9px] font-medium text-chart-neutral">
                {note}
              </span>
            )}
          </div>
          <span
            className={`flex items-center gap-1 font-mono text-xs ${
              up ? "text-chart-up" : "text-chart-down"
            }`}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? "+" : ""}
            {p.changePct.toFixed(2)}%
          </span>
        </div>
        <div className={`mt-2 font-mono text-xl font-bold ${note ? "text-muted-foreground" : "text-foreground"}`}>
          ₹{p.expected.toFixed(2)}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Range:{" "}
          <span className="font-mono text-foreground">
            ₹{p.low.toFixed(2)} – ₹{p.high.toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Projected Price Target</h3>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            Sentiment: <span className="font-mono text-foreground">{score}</span> · {label}
            {isDefaultSentiment && (
              <span className="ml-1 text-chart-neutral">(default)</span>
            )}
          </div>
          <div>
            Daily volatility:{" "}
            <span className="font-mono text-foreground">{(projections.sigma * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {renderHorizon("Next 7 days", projections.d7)}
        {renderHorizon(
          "Next 30 days",
          projections.d30,
          projections.isFlat ? "flat — no directional signal" : "lower confidence · extrapolated",
        )}
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground/70">
        Targets come from the same SES + linear-regression + RSI/MACD model used in the forecast chart.
        The 30-day figure extrapolates the model's daily growth rate; ±1σ range reflects expected
        variability, not guaranteed outcomes. Not financial advice.
      </p>
    </div>
  );
};

export default PriceTarget;