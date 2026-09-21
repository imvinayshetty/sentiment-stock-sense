import { useMemo } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDailyBasket, useBasketAccuracy } from "@/hooks/useDailyBasket";
import { useIntradayBreakeven, type BreakevenRow } from "@/hooks/useIntradayBreakeven";

const inr = (v: number) =>
  `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono font-medium ${tone ?? "text-foreground"}`}>{value}</span>
  </div>
);

const RowCard = ({ r }: { r: BreakevenRow }) => (
  <div
    className={`rounded-lg border p-3 ${
      r.profitable ? "border-chart-up/40 bg-chart-up/5" : "border-chart-down/30 bg-chart-down/5"
    }`}
  >
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm font-semibold text-foreground">{r.symbol}</span>
      <span className="truncate text-xs text-muted-foreground">{r.name}</span>
      <span
        className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          r.profitable ? "bg-chart-up/15 text-chart-up" : "bg-chart-down/15 text-chart-down"
        }`}
      >
        {r.profitable && r.shares > 0 ? <CheckCircle2 className="h-3 w-3" /> : r.profitable ? <AlertTriangle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {r.profitable ? (r.shares > 0 ? "Profitable" : "Too expensive") : "Skip this trade"}
      </span>
    </div>

    <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
      <Stat label={r.priceSource === "live" ? "Live price" : "Latest close"} value={inr(r.price)} />
      <Stat
        label="Expected gain"
        value={`${inr(r.expectedGain)} (${r.expectedGainPct.toFixed(2)}%)`}
        tone={r.expectedGain >= 0 ? "text-chart-up" : "text-chart-down"}
      />
      <Stat
        label="Breakeven cost"
        value={`${inr(r.breakevenPerShare)} (${r.breakevenPct.toFixed(2)}%)`}
      />
      <Stat
        label="Net after charges"
        value={inr(r.netPerShare)}
        tone={r.netPerShare >= 0 ? "text-chart-up" : "text-chart-down"}
      />
    </div>

    {r.profitable && r.shares > 0 && (
      <p className="mt-2 rounded-md bg-secondary/50 p-2 text-xs text-foreground">
        Buy <span className="font-mono font-semibold">{r.shares}</span> shares · projected profit{" "}
        <span className="font-mono font-semibold text-chart-up">{inr(r.projectedProfit)}</span> · charges{" "}
        <span className="font-mono">{inr(r.totalCharges)}</span> · margin needed{" "}
        <span className="font-mono">{inr(r.marginRequired)}</span>
        {r.marginSource === "estimate" && <span className="text-muted-foreground"> (approx.)</span>}
      </p>
    )}
    {!r.profitable && (
      <p className="mt-2 text-xs text-muted-foreground">
        Today's forecast move doesn't cover the round-trip charges.
      </p>
    )}
  </div>
);

/**
 * Intraday breakeven view: for each basket stock, compares the day's forecast
 * gain against Angel One's real round-trip intraday charges and suggests a
 * margin-sized position within the configured budget.
 */
const IntradayBreakeven = () => {
  const { topBuy, budgetMax, isLoading: basketLoading } = useDailyBasket();
  const symbols = topBuy.map((s) => s.symbol);
  const { data, isLoading, isFetching, error, refetch } = useIntradayBreakeven(symbols, budgetMax);

  if (budgetMax == null) {
    return (
      <div className="rounded-xl rounded-t-none border border-border bg-card p-5 text-sm text-muted-foreground card-glow">
        Set a budget in Portfolio settings to see intraday breakeven and share suggestions.
      </div>
    );
  }

  return (
    <div className="rounded-xl rounded-t-none border border-border bg-card p-5 card-glow">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">
          Budget <span className="font-mono text-foreground">{inr(budgetMax)}</span>
          {data && (
            <>
              {" · "}
              {data.profitableCount} clear breakeven · {data.skippedCount} skipped
              {data.profitableCount > 0 && (
                <>
                  {" · projected "}
                  <span className={`font-mono ${data.totalProjectedProfit >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                    {inr(data.totalProjectedProfit)}
                  </span>
                  {" · margin "}
                  <span className="font-mono text-foreground">{inr(data.totalMargin)}</span>
                </>
              )}
            </>
          )}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1.5 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Recalculate
        </Button>
      </div>

      {(basketLoading || isLoading) && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Fetching Angel One charges and margins…
        </p>
      )}
      {error && !isLoading && (
        <p className="text-sm text-chart-down">{(error as Error).message}</p>
      )}
      {data && data.rows.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No stocks available to analyse right now.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {data?.rows.map((r) => <RowCard key={r.symbol} r={r} />)}
      </div>
    </div>
  );
};

export default IntradayBreakeven;
