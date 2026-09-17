import { useMemo, useState } from "react";
import { History, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { useDailyBasket, useBasketAccuracy, type BasketDaySummary } from "@/hooks/useDailyBasket";

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const money = (v: number | null | undefined) => (v == null ? "—" : `₹${v.toFixed(2)}`);
const tone = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v > 0 ? "text-chart-up" : v < 0 ? "text-chart-down" : "text-foreground";

const riskTone = (label: string | null) =>
  label === "high"
    ? "bg-chart-down/15 text-chart-down"
    : label === "medium"
      ? "bg-chart-neutral/20 text-foreground"
      : "bg-chart-up/15 text-chart-up";

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

const DayCard = ({ day, isToday }: { day: BasketDaySummary; isToday: boolean }) => {
  const [open, setOpen] = useState(isToday);
  const rows = [...day.rows].sort((a, b) => {
    const ga = a.close_price != null ? a.close_price - a.base_price : -Infinity;
    const gb = b.close_price != null ? b.close_price - b.base_price : -Infinity;
    return gb - ga;
  });

  return (
    <div className="rounded-lg border border-border bg-secondary/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
          {dayLabel(day.basketDate)}
          {isToday && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Today</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
          <span className={tone(day.basketReturnPct)}>
            basket {pct(day.basketReturnPct)}
          </span>
          <span className={tone(day.marketReturnPct)}>market {pct(day.marketReturnPct)}</span>
          <span className={`flex items-center gap-1 font-semibold ${tone(day.alphaPct)}`}>
            {day.alphaPct != null && (day.alphaPct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
            {pct(day.alphaPct)}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${riskTone(rows[0]?.risk_label ?? null)}`}>
            risk {day.avgRisk != null ? Math.round(day.avgRisk) : "—"}/100
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          <div className="mb-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded bg-card p-2">
              <div className="font-mono text-sm font-semibold text-foreground">
                {day.scored ? `${day.correct}/${day.scored}` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Direction calls right</div>
            </div>
            <div className="rounded bg-card p-2">
              <div className="font-mono text-sm font-semibold text-foreground">
                {day.accuracy != null ? `${day.accuracy.toFixed(0)}%` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Accuracy</div>
            </div>
            <div className="rounded bg-card p-2">
              <div className="font-mono text-sm font-semibold text-foreground">
                {day.winners != null ? `${day.winners}/${day.rows.length}` : `${day.rows.length}`}
              </div>
              <div className="text-[10px] text-muted-foreground">Stocks in profit</div>
            </div>
            <div className="rounded bg-card p-2">
              <div className="font-mono text-sm font-semibold text-foreground">
                {day.mape != null ? `${day.mape.toFixed(2)}%` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Avg price error</div>
            </div>
          </div>

          <div className="space-y-1">
            {rows.map((r) => {
              const gain = r.close_price != null ? r.close_price - r.base_price : null;
              return (
                <div
                  key={r.symbol}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded bg-card px-2 py-1.5 text-xs"
                >
                  <span className="font-medium text-foreground">{r.symbol}</span>
                  <span className="font-mono text-muted-foreground">
                    open {money(r.base_price)} → pred {money(r.predicted_close)} → close {money(r.close_price)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${riskTone(r.risk_label)}`}>
                      {r.risk_label ?? "—"} {r.risk_score ?? "—"}
                    </span>
                    <span className={`font-mono font-semibold ${tone(gain)}`}>
                      {gain == null ? "pending" : `${gain > 0 ? "+" : ""}₹${gain.toFixed(2)}/sh`}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const BasketHistory = () => {
  const { candidates, budgetMax } = useDailyBasket();
  const { data, isLoading } = useBasketAccuracy(budgetMax != null ? candidates : []);

  const days = useMemo(() => {
    if (!data) return [] as { day: BasketDaySummary; isToday: boolean }[];
    const today: BasketDaySummary = {
      basketDate: data.basketDate,
      rows: data.rows,
      scored: data.scored,
      correct: data.correct,
      accuracy: data.accuracy,
      mae: data.mae,
      mape: data.mape,
      avgRisk: data.avgRisk,
      basketReturnPct: data.basketReturnPct,
      winners: data.winners,
      marketReturnPct: data.marketReturnPct,
      alphaPct: data.alphaPct,
    };
    return [
      ...(today.rows.length ? [{ day: today, isToday: true }] : []),
      ...data.history.filter((d) => d.rows.length).map((d) => ({ day: d, isToday: false })),
    ];
  }, [data]);

  if (budgetMax == null) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow text-sm text-muted-foreground">
        Set a budget in Portfolio settings to start recording daily baskets.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-1 flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Basket History (this week)</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Every trading day this week with its stocks, profit or loss per share, risk scores and how it
        did against the NIFTY 50. Days before Monday are cleared automatically.
      </p>

      {isLoading && days.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading this week's baskets…</p>
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">No baskets recorded yet this week.</p>
      ) : (
        <div className="space-y-2">
          {days.map(({ day, isToday }) => (
            <DayCard key={day.basketDate} day={day} isToday={isToday} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BasketHistory;
