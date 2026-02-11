import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { generatePredictions } from "@/lib/stockData";

interface PredictionChartProps {
  symbol: string;
}

const PredictionChart = ({ symbol }: PredictionChartProps) => {
  const data = useMemo(() => generatePredictions(symbol), [symbol]);
  const todayIndex = data.findIndex((d) => !d.actual && data[data.indexOf(d) - 1]?.actual);
  const todayLabel = todayIndex > 0 ? data[todayIndex - 1].date : "";

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">7-Day Price Prediction</h3>
          <p className="text-sm text-muted-foreground">ARIMA · LSTM · Linear Regression</p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1">
          <span className="h-2 w-2 animate-pulse-glow rounded-full bg-primary" />
          <span className="font-mono text-xs text-primary">LIVE</span>
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
            formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "Inter" }} />
          {todayLabel && (
            <ReferenceLine x={todayLabel} stroke="hsl(215 15% 55%)" strokeDasharray="5 5" label={{ value: "Today", fill: "hsl(215 15% 55%)", fontSize: 11 }} />
          )}
          <Line type="monotone" dataKey="actual" name="Actual" stroke="hsl(210 20% 92%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="arima" name="ARIMA" stroke="hsl(160 100% 45%)" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="0" />
          <Line type="monotone" dataKey="lstm" name="LSTM" stroke="hsl(190 90% 50%)" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="linearReg" name="Linear Reg." stroke="hsl(45 90% 55%)" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PredictionChart;
