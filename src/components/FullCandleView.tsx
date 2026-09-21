import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart, ExternalLink, Undo2 } from "lucide-react";

type ChartRange = "1D" | "5D" | "1M" | "3M" | "6M" | "12M" | "60M";

const RANGE_OPTIONS: { value: ChartRange; label: string; interval: string }[] = [
  { value: "1D", label: "1 day", interval: "5" },
  { value: "5D", label: "5 days", interval: "15" },
  { value: "1M", label: "1 month", interval: "60" },
  { value: "3M", label: "3 months", interval: "D" },
  { value: "6M", label: "6 months", interval: "D" },
  { value: "12M", label: "1 year", interval: "D" },
  { value: "60M", label: "5 years", interval: "W" },
];

interface FullCandleViewProps {
  symbol: string;
  onBack: () => void;
}

const WIDGET_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

const FullCandleView = ({ symbol, onBack }: FullCandleViewProps) => {
  const [range, setRange] = useState<ChartRange>("1D");
  const containerRef = useRef<HTMLDivElement>(null);
  const option = RANGE_OPTIONS.find((o) => o.value === range) ?? RANGE_OPTIONS[0];
  const nseSymbol = `${symbol.toUpperCase()}-EQ`;
  const nseUrl = `https://charting.nseindia.com/?symbol=${encodeURIComponent(nseSymbol)}`;

  const widgetConfig = useMemo(
    () => ({
      autosize: true,
      symbol: `NSE:${symbol.toUpperCase()}`,
      interval: option.interval,
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(0, 0, 0, 0)",
      hide_side_toolbar: false,
      allow_symbol_change: false,
      withdateranges: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    }),
    [symbol, option.interval],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetHost = document.createElement("div");
    widgetHost.className = "tradingview-widget-container__widget";
    widgetHost.style.height = "100%";
    widgetHost.style.width = "100%";
    container.appendChild(widgetHost);

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(widgetConfig);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [widgetConfig]);

  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CandlestickChart className="h-5 w-5 text-primary" />
            {nseSymbol} · Candle View
          </h3>
          <p className="text-sm text-muted-foreground">
            Interactive candlestick chart · {option.label} view · drawing tools and indicators available
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

      <div
        ref={containerRef}
        className="tradingview-widget-container min-h-[420px] w-full flex-1 rounded-lg border border-border bg-background overflow-hidden"
      />
    </div>
  );
};

export default FullCandleView;
