import { useBacktest } from "@/hooks/useAngelOneData";
import { Target, CheckCircle2, XCircle } from "lucide-react";

interface BacktestProps {
  symbol: string;
}

const Backtest = ({ symbol }: BacktestProps) => {
  const { data, isLoading } = useBacktest(symbol);
  const accuracy = data?.directionalAccuracy ?? null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Prediction Accuracy · {symbol}</h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading backtest results…</p>
      ) : !data || data.evaluated === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matured predictions yet. Each 7-day forecast is logged and scored once its horizon date passes —
          check back after a week of forecasts.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className={`font-mono text-2xl font-bold ${accuracy !== null && accuracy >= 55 ? "text-chart-up" : "text-chart-neutral"}`}>
                {accuracy !== null ? `${accuracy}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Directional accuracy</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">{data.evaluated}</div>
              <div className="text-xs text-muted-foreground">Predictions scored</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-chart-up">{data.correct}</div>
              <div className="text-xs text-muted-foreground">Correct calls</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">
                {data.mae !== null ? `₹${data.mae.toFixed(2)}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Mean abs. error</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">
                {data.mape !== null ? `${data.mape.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">MAPE (avg % error)</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className={`font-mono text-2xl font-bold ${data.withinBandPct !== null && data.withinBandPct >= 68 ? "text-chart-up" : "text-chart-neutral"}`}>
                {data.withinBandPct !== null ? `${data.withinBandPct}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Within ±1σ band</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-chart-down">{data.evaluated - data.correct}</div>
              <div className="text-xs text-muted-foreground">Incorrect calls</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {data.recent.map((r, idx) => (
              <div key={`${r.symbol}-${r.predicted_at}-${r.horizon_date}`} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2 text-xs">
                <span className="text-muted-foreground">{r.predicted_at} → {r.horizon_date}</span>
                <span className="font-mono text-foreground">
                  ₹{Number(r.base_price).toFixed(0)} → ₹{Number(r.predicted_price).toFixed(0)}
                  {r.actual_price !== null && <span className="text-muted-foreground"> (act ₹{Number(r.actual_price).toFixed(0)})</span>}
                </span>
                <span className={`flex items-center gap-1 font-medium ${r.correct ? "text-chart-up" : "text-chart-down"}`}>
                  {r.correct ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {r.direction.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground/70">
        Directional accuracy measures whether the forecast's up/down call matched the actual move.
        MAE is the average rupee error vs. actual close; "within ±1σ band" is how often the actual
        landed inside the estimated range (≈68% expected for a well-calibrated model). Not financial advice.
      </p>
    </div>
  );
};

export default Backtest;