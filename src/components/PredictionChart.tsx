import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useHistoricalData, useForecast } from "@/hooks/useAngelOneData";

interface PredictionChartProps {
  symbol: string;
}

const PredictionChart = ({ symbol }: PredictionChartProps) => {
  const { data: historicalData, isLoading } = useHistoricalData(symbol);
  const { data: forecastData } = useForecast(symbol);

  if (!isLoading && !historicalData?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Historical Price Data</h3>
            <p className="text-sm text-muted-foreground">Verified history is unavailable for this stock right now.</p>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-muted px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">NO DATA</span>
          </div>
        </div>
      </div>
    );
  }

  const history = (historicalData ?? []).map((d) => ({ ...d }));
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
  const yMin = allValues.length ? Math.min(...allValues) * 0.995 : 0;
  const yMax = allValues.length ? Math.max(...allValues) * 1.005 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Price History & 7-Day Forecast
          </h3>
          <p className="text-sm text-muted-foreground">
            Market feed · Last 1 month + SES/linear-regression projection
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1">
          <span className={`h-2 w-2 rounded-full ${historicalData?.length ? "bg-primary animate-pulse-glow" : "bg-muted-foreground"}`} />
          <span className={`font-mono text-xs ${historicalData?.length ? "text-primary" : "text-muted-foreground"}`}>
            {isLoading ? "LOADING..." : historicalData?.length ? "LIVE" : "NO DATA"}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={false} />
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
