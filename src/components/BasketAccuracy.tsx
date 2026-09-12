import { CalendarCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useDailyBasket, useBasketAccuracy } from "@/hooks/useDailyBasket";

const BasketAccuracy = () => {
  const { topBuy, budgetMax } = useDailyBasket();
  const symbols = topBuy.map((s) => s.symbol);
  const { data, isLoading } = useBasketAccuracy(budgetMax != null ? symbols : []);

  if (budgetMax == null) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="mb-3 flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Today's Basket Accuracy</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Set a total budget in Portfolio settings. Each day the app will log a forecast for the
          10 stocks suggested for that budget at market open, then score them against the actual
          close after 15:30 IST.
        </p>
      </div>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Today's Basket Accuracy</h3>
        </div>
        <span className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
          {data?.basketDate ?? "—"} · {data?.phase === "closed" ? "session closed" : "session open"}
        </span>
      </div>

      {isLoading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Recording today's basket…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stocks fit today's budget yet, so nothing has been logged for today.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className={`font-mono text-2xl font-bold ${data?.accuracy != null && data.accuracy >= 55 ? "text-chart-up" : "text-chart-neutral"}`}>
                {data?.accuracy != null ? `${data.accuracy}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Directional accuracy</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">{rows.length}</div>
              <div className="text-xs text-muted-foreground">Stocks in basket</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">
                {data?.mae != null ? `₹${data.mae.toFixed(2)}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Mean abs. error</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">
                {data?.mape != null ? `${data.mape.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Avg % error</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <div
                key={r.symbol}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-secondary/30 p-2 text-xs"
              >
                <span className="font-medium text-foreground">{r.symbol}</span>
                <span className="font-mono text-muted-foreground">
                  open ₹{r.base_price.toFixed(2)} → pred ₹{r.predicted_close.toFixed(2)}
                  {r.close_price != null && (
                    <span className="text-foreground"> · close ₹{r.close_price.toFixed(2)}</span>
                  )}
                </span>
                {r.close_price == null ? (
                  <span className="flex items-center gap-1 text-chart-neutral">
                    <Clock className="h-3.5 w-3.5" /> awaiting close
                  </span>
                ) : (
                  <span className={`flex items-center gap-1 font-medium ${r.correct ? "text-chart-up" : "text-chart-down"}`}>
                    {r.correct ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {r.direction.toUpperCase()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground/70">
        Each trading day the stocks suggested for your total budget are locked in at the open with a
        same-day price forecast, then scored against the actual close after 15:30 IST. Not financial advice.
      </p>
    </div>
  );
};

export default BasketAccuracy;
