import { useStockQuotes } from "@/hooks/useAngelOneData";
import { getStockMeta } from "@/lib/stockData";
import { ArrowUpRight, ArrowDownRight, BarChart3, DollarSign, Activity, TrendingUp, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface StockDetailProps {
  symbol: string;
}

const StockDetail = ({ symbol }: StockDetailProps) => {
  const { data: quotes } = useStockQuotes();
  const liveStock = quotes?.data?.find((s) => s.symbol === symbol);
  const marketOpen = quotes?.marketStatus === "OPEN";
  const stockMeta = getStockMeta(symbol);
  const stock = liveStock;
  if (!stock) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">{symbol}</h2>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">NSE</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{stockMeta?.name ?? "Waiting for verified market data"}</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">No verified price</span>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Live backend data is required before this stock can be shown.
        </p>
      </div>
    );
  }

  const isUp = stock.change >= 0;

  // Recommended intraday levels: sell near the day's high, buy near the day's low.
  const recommendedSell = stock.high;
  const recommendedBuy = stock.low;

  const stats = [
    { label: "Open", value: `₹${stock.open.toFixed(2)}`, icon: DollarSign },
    { label: "High", value: `₹${stock.high.toFixed(2)}`, icon: TrendingUp },
    { label: "Low", value: `₹${stock.low.toFixed(2)}`, icon: Activity },
    { label: "Rec. Sell", value: `₹${recommendedSell.toFixed(2)}`, icon: ArrowUpCircle },
    { label: "Rec. Buy", value: `₹${recommendedBuy.toFixed(2)}`, icon: ArrowDownCircle },
    { label: "Volume", value: stock.volume, icon: BarChart3 },
    { label: "Exchange", value: stock.exchange || "NSE", icon: DollarSign },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">{stock.symbol}</h2>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">NSE</span>
            {liveStock && marketOpen && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                LIVE
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{stock.name}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold text-foreground text-glow">₹{stock.price.toFixed(2)}</div>
          <div className={`mt-1 flex items-center justify-end gap-1 font-mono text-sm ${isUp ? "text-chart-up" : "text-chart-down"}`}>
            {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {isUp ? "+" : ""}{stock.change.toFixed(2)} ({isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3 lg:grid-cols-7">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-secondary/50 p-3 text-center">
            <stat.icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <div className="font-mono text-sm font-semibold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockDetail;
