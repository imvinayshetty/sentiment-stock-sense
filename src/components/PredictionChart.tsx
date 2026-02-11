import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useHistoricalData } from "@/hooks/useAngelOneData";
import { generatePredictions } from "@/lib/stockData";

interface PredictionChartProps {
  symbol: string;
}

const PredictionChart = ({ symbol }: PredictionChartProps) => {
  const { data: historicalData, isLoading } = useHistoricalData(symbol);
  const mockData = useMemo(() => generatePredictions(symbol), [symbol]);
  
  const data = historicalData?.length ? historicalData : mockData;

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {historicalData?.length ? "Historical Price Data" : "7-Day Price Prediction"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {historicalData?.length ? "Angel One · Last 15 Days" : "ARIMA · LSTM · Linear Regression"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1">
          <span className={`h-2 w-2 rounded-full ${historicalData?.length ? "bg-primary animate-pulse-glow" : "bg-muted-foreground"}`} />
          <span className={`font-mono text-xs ${historicalData?.length ? "text-primary" : "text-muted-foreground"}`}>
            {isLoading ? "LOADING..." : historicalData?.length ? "LIVE" : "MOCK"}
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
          <Line type="monotone" dataKey="actual" name={historicalData?.length ? "Close" : "Actual"} stroke="hsl(210 20% 92%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          {!historicalData?.length && (
            <>
              <Line type="monotone" dataKey="arima" name="ARIMA" stroke="hsl(160 100% 45%)" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="lstm" name="LSTM" stroke="hsl(190 90% 50%)" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="linearReg" name="Linear Reg." stroke="hsl(45 90% 55%)" strokeWidth={2} dot={{ r: 2 }} />
            </>
          )}
          {historicalData?.length && (
            <>
              <Line type="monotone" dataKey="high" name="High" stroke="hsl(160 100% 45%)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="low" name="Low" stroke="hsl(0 72% 55%)" strokeWidth={1.5} dot={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PredictionChart;
