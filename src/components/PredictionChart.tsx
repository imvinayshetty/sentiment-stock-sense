import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useHistoricalData } from "@/hooks/useAngelOneData";

interface PredictionChartProps {
  symbol: string;
}

const PredictionChart = ({ symbol }: PredictionChartProps) => {
  const { data: historicalData, isLoading } = useHistoricalData(symbol);

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

  const data = historicalData ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Historical Price Data
          </h3>
          <p className="text-sm text-muted-foreground">
            Market feed · Last 1 month
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
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 18%)" />
          <XAxis dataKey="date" tick={{ fill: "hsl(215 15% 55%)", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "hsl(215 15% 55%)", fontSize: 12 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220 22% 10%)",
              border: "1px solid hsl(220 18% 18%)",
              borderRadius: "8px",
              color: "hsl(210 20% 92%)",
              fontSize: "13px",
              fontFamily: "JetBrains Mono, monospace",
            }}
            formatter={(value: number) => [`₹${value.toFixed(2)}`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "Inter" }} />
          <Line type="monotone" dataKey="actual" name="Close" stroke="hsl(210 20% 92%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="high" name="High" stroke="hsl(160 100% 45%)" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="low" name="Low" stroke="hsl(0 72% 55%)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PredictionChart;
