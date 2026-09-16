import { useState } from "react";
import { CalendarCheck, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useDailyBasket, useBasketAccuracy, type BasketRow } from "@/hooks/useDailyBasket";

const RowLine = ({ r }: { r: BasketRow }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-secondary/30 p-2 text-xs">
    <span className="font-medium text-foreground">{r.symbol}</span>
    <span className="font-mono text-muted-foreground">
      open ₹{r.base_price.toFixed(2)} → pred ₹{r.predicted_close.toFixed(2)}
      {r.close_price != null && (
        <>
          <span className="text-foreground"> · close ₹{r.close_price.toFixed(2)}</span>
          <span className={r.close_price >= r.base_price ? "text-chart-up" : "text-chart-down"}>
            {" "}· {r.close_price >= r.base_price ? "+" : "−"}₹
            {Math.abs(r.close_price - r.base_price).toFixed(2)}/share
          </span>
        </>
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
);

const BasketAccuracy = () => {
  const { candidates, budgetMax } = useDailyBasket();
  const { data, isLoading } = useBasketAccuracy(budgetMax != null ? candidates : []);
  const [openDay, setOpenDay] = useState<string | null>(null);

  if (budgetMax == null) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="mb-3 flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Today's Basket Accuracy</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Set a total budget in Portfolio settings. Each morning the app picks up to 8 stocks that
          have a track record of gaining between open and close and are forecast to rise today, then
          checks after 15:30 IST whether a same-day trade would have made money. Every day is saved
          so you can compare accuracy across days.
        </p>

      </div>
    );
  }

  const rows = data?.rows ?? [];
  const history = data?.history ?? [];


  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Today's Basket Accuracy</h3>
        </div>
        <span className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
          {data?.basketDate ?? "—"} ·{" "}
          {data && !data.tradingToday
            ? "last trading day"
            : data?.phase === "closed"
              ? "session closed"
              : "session open"}
        </span>
      </div>

      {isLoading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Recording today's basket…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {data && !data.tradingToday
            ? "The market is shut today, so no basket was logged. The next one is recorded at the next market open."
            : "No stock within your budget looks likely to make a same-day profit today, so nothing was logged."}
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
              <RowLine key={r.symbol} r={r} />
            ))}
          </div>
        </>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground">Previous days</h4>
          <div className="space-y-2">
            {history.map((day) => {
              const isOpen = openDay === day.basketDate;
              return (
                <div key={day.basketDate} className="rounded-lg border border-border bg-secondary/20">
                  <button
                    type="button"
                    onClick={() => setOpenDay(isOpen ? null : day.basketDate)}
                    className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 p-2 text-left text-xs"
                  >
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {day.basketDate}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {day.rows.length} stocks · {day.correct}/{day.scored} correct
                      {day.mae != null && <> · MAE ₹{day.mae.toFixed(2)}</>}
                      {day.mape != null && <> · {day.mape.toFixed(1)}% err</>}
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        day.accuracy == null
                          ? "text-muted-foreground"
                          : day.accuracy >= 55
                            ? "text-chart-up"
                            : "text-chart-down"
                      }`}
                    >
                      {day.accuracy != null ? `${day.accuracy}%` : "—"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-border p-2">
                      {day.rows.map((r) => (
                        <RowLine key={r.symbol} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground/70">
        Each trading morning, up to 8 stocks within your budget that regularly close above their
        opening price and are forecast to rise today are locked in, then checked against the actual
        close after 15:30 IST. Every day is stored so you can compare accuracy across days. Not
        financial advice.
      </p>


    </div>
  );
};

export default BasketAccuracy;
