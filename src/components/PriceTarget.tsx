import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { useForecast, useNewsSentiment } from "@/hooks/useAngelOneData";

interface PriceTargetProps {
  symbol: string;
}

const PriceTarget = ({ symbol }: PriceTargetProps) => {
  const { data: forecastData } = useForecast(symbol);
  const { data: sentiment } = useNewsSentiment(symbol);
  const score = sentiment?.score ?? 50;
  const label = sentiment?.label ?? "Neutral";

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
    const horizon30 = 30;
    const expected30 = price * Math.pow(perDayGrowth, horizon30);
    const band30 = expected30 * sigma * Math.sqrt(horizon30);
    const d30 = {
      expected: expected30,
      low: expected30 - band30,
      high: expected30 + band30,
      changePct: ((expected30 - price) / price) * 100,
    };

    return { sigma, d7, d30 };
  }, [forecastData]);

  if (!projections) return null;

  const renderHorizon = (
    title: string,
    p: { expected: number; low: number; high: number; changePct: number }
  ) => {
    const up = p.changePct >= 0;
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
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
        <div className="mt-2 font-mono text-xl font-bold text-foreground">
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
          </div>
          <div>
            Daily volatility:{" "}
            <span className="font-mono text-foreground">{(projections.sigma * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {renderHorizon("Next 7 days", projections.d7)}
        {renderHorizon("Next 30 days", projections.d30)}
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