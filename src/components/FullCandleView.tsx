import { useState } from "react";
import { CandlestickChart, ExternalLink, Undo2 } from "lucide-react";

type ChartRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y";

const RANGE_OPTIONS: { value: ChartRange; label: string; interval: string }[] = [
  { value: "1d", label: "1 day", interval: "5" },
  { value: "5d", label: "5 days", interval: "15" },
  { value: "1mo", label: "1 month", interval: "60" },
  { value: "3mo", label: "3 months", interval: "D" },
  { value: "6mo", label: "6 months", interval: "D" },
  { value: "1y", label: "1 year", interval: "D" },
  { value: "5y", label: "5 years", interval: "W" },
];

interface FullCandleViewProps {
  symbol: string;
  onBack: () => void;
}

const FullCandleView = ({ symbol, onBack }: FullCandleViewProps) => {
  const [range, setRange] = useState<ChartRange>("1d");
  const option = RANGE_OPTIONS.find((o) => o.value === range) ?? RANGE_OPTIONS[0];
  const nseSymbol = `${symbol.toUpperCase()}-EQ`;
  const nseUrl = `https://charting.nseindia.com/?symbol=${encodeURIComponent(nseSymbol)}`;
  const embedUrl =
    `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(`NSE:${symbol.toUpperCase()}`)}` +
    `&interval=${option.interval}&theme=dark&style=1&timezone=Asia%2FKolkata&hide_side_toolbar=0&withdateranges=1&allow_symbol_change=0&save_image=0&locale=in`;

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CandlestickChart className="h-5 w-5 text-primary" />
            {nseSymbol} · Candle View
          </h3>
          <p className="text-sm text-muted-foreground">
            Interactive NSE candlestick chart · {option.label} view · drawing tools and indicators available
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as ChartRange)}
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

      <iframe
        key={`${symbol}-${option.interval}`}
        src={embedUrl}
        title={`${nseSymbol} candlestick chart`}
        className="h-[480px] w-full rounded-lg border border-border bg-background"
        allow="fullscreen"
        loading="lazy"
      />
    </div>
  );
};

export default FullCandleView;
