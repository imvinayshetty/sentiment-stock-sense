import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Scale, TrendingUp, TrendingDown } from "lucide-react";
import { useDailyBasket, useBasketAccuracy, type BasketDaySummary } from "@/hooks/useDailyBasket";

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v > 0 ? "text-chart-up" : v < 0 ? "text-chart-down" : "text-foreground";

const BasketComparison = () => {
  const { candidates, budgetMax } = useDailyBasket();
  const { data } = useBasketAccuracy(budgetMax != null ? candidates : []);

  const days = useMemo<BasketDaySummary[]>(() => {
    if (!data) return [];
    const all = [
      { basketDate: data.basketDate, rows: data.rows, scored: data.scored, correct: data.correct, accuracy: data.accuracy, mae: data.mae, mape: data.mape, avgRisk: data.avgRisk, basketReturnPct: data.basketReturnPct, winners: data.winners, marketReturnPct: data.marketReturnPct, alphaPct: data.alphaPct },
      ...data.history,
    ];
    return all.filter((d) => d.basketReturnPct != null).sort((a, b) => (a.basketDate < b.basketDate ? -1 : 1));
  }, [data]);

  const chartData = useMemo(() => {
    let sum = 0;
    return days.map((d, i) => {
      // "Own history" baseline: the average return of every earlier basket.
      const ownAvg = i === 0 ? null : Number((sum / i).toFixed(2));
      sum += d.basketReturnPct ?? 0;
      return {
        date: d.basketDate.slice(5),
        basket: d.basketReturnPct,
        market: d.marketReturnPct,
        ownAvg,
        alpha: d.alphaPct,
      };
    });
  }, [days]);

  const totals = useMemo(() => {
    if (!days.length) return null;
    const avg = (pick: (d: BasketDaySummary) => number | null) => {
      const vals = days.map(pick).filter((v): v is number => v != null);
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
    };
    const beat = days.filter(
      (d) => d.basketReturnPct != null && d.marketReturnPct != null && d.basketReturnPct > d.marketReturnPct,
    ).length;
    return {
      basket: avg((d) => d.basketReturnPct),
      market: avg((d) => d.marketReturnPct),
      alpha: avg((d) => d.alphaPct),
      beat,
      total: days.length,
    };
  }, [days]);

  if (budgetMax == null) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex items-center gap-2">
        <Scale className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Basket vs Market Comparison</h3>
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Once a day's basket has been checked against the actual closing prices, this view compares
          how it did against its own past days and against the wider market (NIFTY 50).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className={`font-mono text-2xl font-bold ${tone(totals?.basket)}`}>{pct(totals?.basket)}</div>
              <div className="text-xs text-muted-foreground">Avg basket day return</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className={`font-mono text-2xl font-bold ${tone(totals?.market)}`}>{pct(totals?.market)}</div>
              <div className="text-xs text-muted-foreground">Avg market (NIFTY 50)</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className={`flex items-center justify-center gap-1 font-mono text-2xl font-bold ${tone(totals?.alpha)}`}>
                {totals?.alpha != null && (totals.alpha > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />)}
                {pct(totals?.alpha)}
              </div>
              <div className="text-xs text-muted-foreground">Edge over market</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <div className="font-mono text-2xl font-bold text-foreground">
                {totals ? `${totals.beat}/${totals.total}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Days beating market</div>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number | null, name: string) => [v == null ? "—" : `${v.toFixed(2)}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="basket" name="Basket" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="market" name="Market (NIFTY 50)" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ownAvg" name="Own past average" fill="hsl(var(--chart-neutral))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            {[...chartData].reverse().map((d) => (
              <div
                key={d.date}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-secondary/30 p-2 text-xs"
              >
                <span className="font-medium text-foreground">{d.date}</span>
                <span className="font-mono text-muted-foreground">
                  basket <span className={tone(d.basket)}>{pct(d.basket)}</span> · market{" "}
                  <span className={tone(d.market)}>{pct(d.market)}</span>
                  {d.ownAvg != null && (
                    <>
                      {" "}· own avg <span className={tone(d.ownAvg)}>{pct(d.ownAvg)}</span>
                    </>
                  )}
                </span>
                <span className={`font-mono font-semibold ${tone(d.alpha)}`}>{pct(d.alpha)} vs market</span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-muted-foreground/70">
            Each bar is the average open-to-close move of that day's basket, next to the NIFTY 50's
            move on the same day and the average of all earlier baskets. A positive figure in the last
            column means the basket did better than the market that day. Not financial advice.
          </p>
        </>
      )}
    </div>
  );
};

export default BasketComparison;
