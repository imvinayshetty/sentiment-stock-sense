import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CandlestickChart } from "lucide-react";
import { useHistoricalData, useForecast, type HistoryRange } from "@/hooks/useAngelOneData";

interface PredictionChartProps {
  symbol: string;
  onCandleView?: () => void;
}

const RANGE_OPTIONS: { value: HistoryRange; label: string }[] = [
  { value: "1d", label: "1 day" },
  { value: "5d", label: "5 days" },
  { value: "1mo", label: "1 month" },
  { value: "3mo", label: "3 months" },
  { value: "6mo", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "5y", label: "5 years" },
];

const PredictionChart = ({ symbol, onCandleView }: PredictionChartProps) => {
  const [range, setRange] = useState<HistoryRange>("1d");
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "1 day";
  const { data: histData, isLoading } = useHistoricalData(symbol, range);
  const historicalData = histData ?? [];
  const { data: forecastData } = useForecast(symbol);

  const rangePicker = (
    <select
      value={range}
      onChange={(e) => setRange(e.target.value as HistoryRange)}
      aria-label="Price history range"
      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {RANGE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  if (isLoading && historicalData.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-52 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-[350px] w-full animate-pulse rounded-lg bg-muted/40" />
      </div>
    );
  }

  if (!isLoading && historicalData.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Historical Price Data</h3>
            <p className="text-sm text-muted-foreground">Verified history is unavailable for this stock right now.</p>
          </div>
          <div className="flex items-center gap-2">
            {rangePicker}
            <div className="flex items-center gap-1 rounded-md bg-muted px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">NO DATA</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const history = historicalData.map((d) => ({ ...d }));
  // Append forecast points so the chart shows a continuous projected line.
  const forecastRows = (forecastData?.forecast ?? []).map((f) => ({
    date: f.date,
    forecast: f.forecast,
    lower: f.lower,
    upper: f.upper,
    high: undefined,
    low: undefined,
  }));
  // Bridge: anchor the forecast line to the last actual close.
  if (history.length && forecastRows.length) {
    const last = history[history.length - 1] as Record<string, unknown>;
    last.forecast = last.actual as number;
  }
  const data = [...history, ...forecastRows];

  // Compute an explicit Y domain so historical + forecast ranges are both visible.
  const allValues = (data as any[])
    .flatMap((d) => [d.actual, d.forecast, d.upper, d.lower, d.high, d.low])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  // Use 2% padding so daily high/low extremes don't squish the close/forecast lines.
  const yMin = allValues.length ? Math.min(...allValues) * 0.98 : 0;
  const yMax = allValues.length ? Math.max(...allValues) * 1.02 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Price History & 7-Day Forecast
          </h3>
          <p className="text-sm text-muted-foreground">
            Market feed · Last {rangeLabel} + SES/linear-regression projection
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rangePicker}
          <button
            onClick={onCandleView}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <CandlestickChart className="h-4 w-4" />
            Candle view
          </button>
          <div className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1">
            <span className={`h-2 w-2 rounded-full ${historicalData.length ? "bg-primary animate-pulse-glow" : "bg-muted-foreground"}`} />
            <span className={`font-mono text-xs ${historicalData.length ? "text-primary" : "text-muted-foreground"}`}>
              {isLoading ? "LOADING..." : historicalData.length ? "LIVE" : "NO DATA"}
            </span>
          </div>
        </div>
      </div>

      <Dialog open={candleOpen} onOpenChange={setCandleOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <CandlestickChart className="h-5 w-5 text-primary" />
              <span>{symbol} · candles</span>
              <span className="text-sm font-normal text-muted-foreground">Last {rangeLabel} + forecast</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">{rangePicker}</div>
          <CandleChart data={data as any} height={400} />
          <p className="text-xs text-muted-foreground">
            Green candles closed above their open, red below. The dashed line is the 7-day projection.
          </p>
        </DialogContent>
      </Dialog>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={false} domain={[yMin, yMax]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--foreground))",
              fontSize: "13px",
              fontFamily: "JetBrains Mono, monospace",
            }}
            formatter={(value: number) => [`₹${value.toFixed(2)}`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "Inter" }} />
          <Line type="monotone" dataKey="actual" name="Close" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="high" name="High" stroke="hsl(var(--chart-up))" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="low" name="Low" stroke="hsl(var(--chart-down))" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="forecast" name="Forecast" stroke="hsl(var(--chart-neutral))" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          <Line type="monotone" dataKey="upper" name="Upper band" stroke="hsl(var(--chart-neutral))" strokeWidth={1} strokeOpacity={0.4} dot={false} connectNulls />
          <Line type="monotone" dataKey="lower" name="Lower band" stroke="hsl(var(--chart-neutral))" strokeWidth={1} strokeOpacity={0.4} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PredictionChart;
