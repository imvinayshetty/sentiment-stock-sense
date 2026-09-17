import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDailyBasket, useBasketAccuracy, resetBasket, type BasketRow } from "@/hooks/useDailyBasket";
import type { StockQuote } from "@/lib/stockData";

const riskTone = (score: number) =>
  score <= 33 ? "text-chart-up" : score <= 66 ? "text-chart-neutral" : "text-chart-down";

const RiskBadge = ({ r }: { r: BasketRow }) => {
  if (r.risk_score == null) return null;
  const label = r.risk_label ?? (r.risk_score <= 33 ? "low" : r.risk_score <= 66 ? "medium" : "high");
  return (
    <span className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
      <span className={`rounded-full bg-secondary/60 px-2 py-0.5 font-medium ${riskTone(r.risk_score)}`}>
        risk {r.risk_score}/100 · {label}
      </span>
      <span className="text-muted-foreground">
        {r.volatility_pct != null && <>swing ±{r.volatility_pct.toFixed(2)}%</>}
        {r.avg_range_pct != null && <> · day range {r.avg_range_pct.toFixed(2)}%</>}
      </span>
    </span>
  );
};

const LiveStat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono font-medium ${tone ?? "text-foreground"}`}>{value}</span>
  </div>
);

const RowLine = ({ r, live }: { r: BasketRow; live?: StockQuote }) => (
  <div className="group relative">
    <button
      type="button"
      className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-secondary/30 p-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-secondary/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
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
      {r.risk_score != null && (
        <span className="w-full">
          <RiskBadge r={r} />
        </span>
      )}
    </button>
    <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-xs shadow-xl group-hover:block group-focus-within:block">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-foreground">{live?.name ?? r.symbol}</span>
        {live && (
          <span className={`font-mono font-bold ${live.changePercent >= 0 ? "text-chart-up" : "text-chart-down"}`}>
            ₹{live.price.toFixed(2)} ({live.changePercent >= 0 ? "+" : ""}{live.changePercent.toFixed(2)}%)
          </span>
        )}
      </div>
      {live ? (
        <div className="space-y-1">
          <LiveStat label="Live price" value={`₹${live.price.toFixed(2)}`} />
          <LiveStat
            label="Change"
            value={`${live.change >= 0 ? "+" : ""}₹${live.change.toFixed(2)} (${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%)`}
            tone={live.change >= 0 ? "text-chart-up" : "text-chart-down"}
          />
          <LiveStat label="Open" value={`₹${live.open.toFixed(2)}`} />
          <LiveStat label="Day high" value={`₹${live.high.toFixed(2)}`} tone="text-chart-up" />
          <LiveStat label="Day low" value={`₹${live.low.toFixed(2)}`} tone="text-chart-down" />
          <LiveStat label="Volume" value={live.volume} />
        </div>
      ) : (
        <p className="text-muted-foreground">No live quote available for this stock right now.</p>
      )}
      <div className="mt-2 border-t border-border pt-2">
        <LiveStat label="Basket open" value={`₹${r.base_price.toFixed(2)}`} />
        <LiveStat label="Predicted close" value={`₹${r.predicted_close.toFixed(2)}`} />
        {r.close_price != null && <LiveStat label="Actual close" value={`₹${r.close_price.toFixed(2)}`} />}
      </div>
    </div>
  </div>
);

const BasketAccuracy = () => {
  const { candidates, budgetMax, stocks } = useDailyBasket();
  const { data, isLoading } = useBasketAccuracy(budgetMax != null ? candidates : []);
  const liveBySymbol = useMemo(() => new Map(stocks.map((s) => [s.symbol, s])), [stocks]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetBasket(candidates);
      await queryClient.invalidateQueries({ queryKey: ["basket-accuracy"] });
      toast.success("Basket re-evaluated with the latest data.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  if (budgetMax == null) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="mb-3 flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Today's Basket Accuracy</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Set a total budget in Portfolio settings. Each morning the app picks up to 10 stocks that
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
        <div className="flex items-center gap-2">
          {data?.tradingToday && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              {resetting ? "Re-evaluating…" : "Reset"}
            </button>
          )}
          <span className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            {data?.basketDate ?? "—"} ·{" "}
            {data && !data.tradingToday
              ? "last trading day"
              : data?.phase === "closed"
                ? "session closed"
                : "session open"}
          </span>
        </div>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
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
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div
                className={`font-mono text-2xl font-bold ${
                  data?.avgRisk != null ? riskTone(data.avgRisk) : "text-foreground"
                }`}
              >
                {data?.avgRisk != null ? data.avgRisk : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Avg risk /100</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <RowLine key={r.symbol} r={r} live={liveBySymbol.get(r.symbol)} />
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
                      {day.avgRisk != null && (
                        <span className={riskTone(day.avgRisk)}> · risk {day.avgRisk}</span>
                      )}
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
                        <RowLine key={r.symbol} r={r} live={liveBySymbol.get(r.symbol)} />
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
        Each trading morning, up to 10 stocks within your budget that regularly close above their
        opening price and are forecast to rise today are locked in, then checked against the actual
        close after 15:30 IST. Every day is stored so you can compare accuracy across days. Not
        financial advice. Each pick also shows a 0-100 risk score built from how widely its
        open-to-close move varies, how far it travels between its high and low, and how often the
        day trade has failed — lower means steadier. Picks are ranked by expected gain per unit of
        risk.
      </p>


    </div>
  );
};

export default BasketAccuracy;
