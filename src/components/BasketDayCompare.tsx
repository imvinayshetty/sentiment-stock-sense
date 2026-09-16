import { useEffect, useMemo, useState } from "react";
import { Columns2 } from "lucide-react";
import {
  useDailyBasket,
  useBasketAccuracy,
  type BasketDaySummary,
  type BasketRow,
} from "@/hooks/useDailyBasket";

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const money = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}₹${Math.abs(v).toFixed(2)}`;
const tone = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v > 0 ? "text-chart-up" : v < 0 ? "text-chart-down" : "text-foreground";
const riskTone = (score: number | null) =>
  score == null ? "text-muted-foreground" : score <= 33 ? "text-chart-up" : score <= 66 ? "text-chart-neutral" : "text-chart-down";

const profitPerShare = (r: BasketRow) => (r.close_price == null ? null : r.close_price - r.base_price);

const DayColumn = ({ day }: { day: BasketDaySummary }) => {
  const rows = [...day.rows].sort((a, b) => (profitPerShare(b) ?? -Infinity) - (profitPerShare(a) ?? -Infinity));
  const totalProfit = rows.reduce((a, r) => a + (profitPerShare(r) ?? 0), 0);
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-foreground">{day.basketDate}</span>
        <span className={`font-mono text-sm font-bold ${tone(day.basketReturnPct)}`}>{pct(day.basketReturnPct)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-secondary/50 p-2">
          <div className={`font-mono text-sm font-bold ${tone(totalProfit)}`}>{money(totalProfit)}</div>
          <div className="text-[10px] text-muted-foreground">Profit / share</div>
        </div>
        <div className="rounded bg-secondary/50 p-2">
          <div className={`font-mono text-sm font-bold ${riskTone(day.avgRisk)}`}>{day.avgRisk ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground">Avg risk /100</div>
        </div>
        <div className="rounded bg-secondary/50 p-2">
          <div className="font-mono text-sm font-bold text-foreground">
            {day.accuracy != null ? `${day.accuracy}%` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {day.winners != null ? `${day.winners}/${day.rows.length} up` : "Accuracy"}
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => {
          const p = profitPerShare(r);
          return (
            <div key={r.symbol} className="rounded border border-border bg-card/60 p-2 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="font-medium text-foreground">{r.symbol}</span>
                <span className={`font-mono font-semibold ${tone(p)}`}>
                  {p == null ? "awaiting close" : `${money(p)} / share`}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 font-mono text-muted-foreground">
                <span>
                  open ₹{r.base_price.toFixed(2)} → pred ₹{r.predicted_close.toFixed(2)}
                  {r.close_price != null && <> · close ₹{r.close_price.toFixed(2)}</>}
                </span>
                <span className={riskTone(r.risk_score)}>
                  risk {r.risk_score ?? "—"}
                  {r.risk_label ? ` · ${r.risk_label}` : ""}
                </span>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[11px] text-muted-foreground">No stocks logged that day.</p>}
      </div>
    </div>
  );
};

const BasketDayCompare = () => {
  const { candidates, budgetMax } = useDailyBasket();
  const { data } = useBasketAccuracy(budgetMax != null ? candidates : []);
  const [left, setLeft] = useState<string>("");
  const [right, setRight] = useState<string>("");

  const days = useMemo<BasketDaySummary[]>(() => {
    if (!data) return [];
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
    return [today, ...data.history].filter((d) => d.rows.length > 0);
  }, [data]);

  // Default to the two most recent days that have picks.
  useEffect(() => {
    if (!days.length) return;
    setLeft((cur) => (days.some((d) => d.basketDate === cur) ? cur : days[0].basketDate));
    setRight((cur) =>
      days.some((d) => d.basketDate === cur) ? cur : (days[1]?.basketDate ?? days[0].basketDate),
    );
  }, [days]);

  if (budgetMax == null) return null;

  const dayA = days.find((d) => d.basketDate === left);
  const dayB = days.find((d) => d.basketDate === right);
  const selectClass =
    "rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Columns2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Compare Two Days Side by Side</h3>
        </div>
        {days.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              aria-label="First day to compare"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              className={selectClass}
            >
              {days.map((d) => (
                <option key={d.basketDate} value={d.basketDate}>
                  {d.basketDate}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">vs</span>
            <select
              aria-label="Second day to compare"
              value={right}
              onChange={(e) => setRight(e.target.value)}
              className={selectClass}
            >
              {days.map((d) => (
                <option key={d.basketDate} value={d.basketDate}>
                  {d.basketDate}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Once at least one day's basket has been logged, you can pick two dates here and see their
          stocks, profits and risk scores next to each other.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {dayA && <DayColumn day={dayA} />}
            {dayB && <DayColumn day={dayB} />}
          </div>
          {dayA && dayB && dayA.basketDate !== dayB.basketDate && (
            <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
              <span className="font-medium text-foreground">Difference</span>{" "}
              <span className="font-mono text-muted-foreground">
                return{" "}
                <span
                  className={tone(
                    dayA.basketReturnPct != null && dayB.basketReturnPct != null
                      ? dayA.basketReturnPct - dayB.basketReturnPct
                      : null,
                  )}
                >
                  {dayA.basketReturnPct != null && dayB.basketReturnPct != null
                    ? pct(dayA.basketReturnPct - dayB.basketReturnPct)
                    : "—"}
                </span>
                {dayA.avgRisk != null && dayB.avgRisk != null && (
                  <> · risk {dayA.avgRisk - dayB.avgRisk > 0 ? "+" : ""}{dayA.avgRisk - dayB.avgRisk}</>
                )}
                {dayA.accuracy != null && dayB.accuracy != null && (
                  <> · accuracy {dayA.accuracy - dayB.accuracy > 0 ? "+" : ""}{dayA.accuracy - dayB.accuracy}%</>
                )}{" "}
                ({dayA.basketDate} vs {dayB.basketDate})
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BasketDayCompare;
