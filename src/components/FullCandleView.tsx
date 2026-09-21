import { useState } from "react";
import { CandlestickChart, Undo2 } from "lucide-react";
import { useHistoricalData, useForecast, type HistoryRange } from "@/hooks/useAngelOneData";
import CandleChart from "@/components/CandleChart";

const RANGE_OPTIONS: { value: HistoryRange; label: string }[] = [
  { value: "1d", label: "1 day" },
  { value: "5d", label: "5 days" },
  { value: "1mo", label: "1 month" },
  { value: "3mo", label: "3 months" },
  { value: "6mo", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "5y", label: "5 years" },
];

interface FullCandleViewProps {
  symbol: string;
  onBack: () => void;
}

const FullCandleView = ({ symbol, onBack }: FullCandleViewProps) => {
  const [range, setRange] = useState<HistoryRange>("1d");
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "1 day";
  const { data: histData, isLoading } = useHistoricalData(symbol, range);
  const historicalData = histData ?? [];
  const { data: forecastData } = useForecast(symbol);

  const history = historicalData.map((d) => ({ ...d }));
  const forecastRows = (forecastData?.forecast ?? []).map((f) => ({
    date: f.date,
    forecast: f.forecast,
    high: undefined,
    low: undefined,
  }));
  const data = [...history, ...forecastRows];

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CandlestickChart className="h-5 w-5 text-primary" />
            {symbol} · Candle View
          </h3>
          <p className="text-sm text-muted-foreground">
            Last {rangeLabel} · green candles closed above their open, red below · dashed line is the 7-day projection
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as HistoryRange)}
            aria-label="Candle chart range"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70"
          >
            <Undo2 className="h-4 w-4" />
            Back to forecast
          </button>
        </div>
      </div>

      {isLoading && historicalData.length === 0 ? (
        <div className="h-[420px] w-full animate-pulse rounded-lg bg-muted/40" />
      ) : historicalData.length === 0 ? (
        <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Candle data is unavailable for this stock right now.
        </div>
      ) : (
        <CandleChart data={data as any} height={420} />
      )}
    </div>
  );
};

export default FullCandleView;
