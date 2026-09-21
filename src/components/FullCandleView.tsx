import { useState } from "react";
import { CandlestickChart, ExternalLink, Undo2, Loader2 } from "lucide-react";
import CandleChart from "./CandleChart";
import { useHistoricalData, type HistoryRange } from "@/hooks/useAngelOneData";

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
  const option = RANGE_OPTIONS.find((o) => o.value === range) ?? RANGE_OPTIONS[0];
  const nseSymbol = `${symbol.toUpperCase()}-EQ`;
  const nseUrl = `https://charting.nseindia.com/?symbol=${encodeURIComponent(nseSymbol)}`;
  const { data: candles, isLoading, error } = useHistoricalData(symbol, range);

  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CandlestickChart className="h-5 w-5 text-primary" />
            {nseSymbol} · Candle View
          </h3>
          <p className="text-sm text-muted-foreground">
            Real NSE candlestick data · {option.label} view
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
          <a
            href={nseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70"
          >
            <ExternalLink className="h-4 w-4" />
            NSE charting
          </a>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70"
          >
            <Undo2 className="h-4 w-4" />
            Back to forecast
          </button>
        </div>
      </div>

      <div className="min-h-[420px] w-full flex-1 rounded-lg border border-border bg-background p-2 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm">Loading {nseSymbol} candles…</span>
          </div>
        ) : error ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Candle data unavailable for {nseSymbol}. Try another range.
          </div>
        ) : (
          <CandleChart data={candles ?? []} height="100%" />
        )}
      </div>
    </div>
  );
};

export default FullCandleView;
