import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { useHistoricalData } from "@/hooks/useAngelOneData";
import { useStockQuotes } from "@/hooks/useAngelOneData";
import { getSentimentScore } from "@/lib/stockData";

interface PriceTargetProps {
  symbol: string;
}

// Compute daily log-return volatility (stdev) from close prices
function computeVolatility(closes: number[]): number {
  if (closes.length < 2) return 0.015; // fallback ~1.5% daily
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) || 0.015;
}

const PriceTarget = ({ symbol }: PriceTargetProps) => {
  const { data: historical } = useHistoricalData(symbol);
  const { data: quotes } = useStockQuotes();
  const liveStock = quotes?.data?.find((s) => s.symbol === symbol);
  const stock = liveStock;
  const { score, label } = getSentimentScore(symbol);

  const projections = useMemo(() => {
    if (!stock) return null;
    const price = stock.price;
    const closes = (historical || []).map((d) => d.actual).filter((v): v is number => typeof v === "number");
    const sigma = computeVolatility(closes); // daily stdev of log returns

    // Sentiment bias: map score [0..100] -> daily drift [-0.15%..+0.15%]
    const drift = ((score - 50) / 50) * 0.0015;

    const buildHorizon = (days: number) => {
      const expected = price * Math.exp(drift * days);
      // ~1 stdev band over the horizon
      const band = sigma * Math.sqrt(days);
      const low = price * Math.exp(drift * days - band);
      const high = price * Math.exp(drift * days + band);
      const changePct = ((expected - price) / price) * 100;
      return { expected, low, high, changePct };
    };

    return {
      sigma,
      d7: buildHorizon(7),
      d30: buildHorizon(30),
    };
  }, [stock, historical, score]);

  if (!stock || !projections) return null;

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
        Estimated using historical log-return volatility with a sentiment-driven drift. ±1σ range
        reflects expected variability, not guaranteed outcomes. Not financial advice.
      </p>
    </div>
  );
};

export default PriceTarget;