import { useEffect, useState } from "react";
import { useStockQuotes } from "@/hooks/useAngelOneData";
import type { StockQuote } from "@/lib/stockData";

const TickerBar = () => {
  const { data: quotes } = useStockQuotes();
  const liveStocks = quotes?.data ?? [];

  // Only swap in fresh ticker data when prices actually change. This keeps the
  // scroll animation from restarting on identical background refetches, while
  // still updating prices on every meaningful quote change (the stock count is
  // constant, so a length check alone would freeze prices after first load).
  const [stocks, setStocks] = useState<StockQuote[]>(liveStocks);
  useEffect(() => {
    if (!liveStocks.length) return;
    setStocks((prev) => {
      if (prev.length === 0) return liveStocks;
      const changed =
        liveStocks.length !== prev.length ||
        liveStocks.some((s, i) => s.price !== prev[i]?.price);
      return changed ? liveStocks : prev;
    });
  }, [liveStocks]);

  if (!stocks.length) {
    return (
      <div className="w-full overflow-hidden border-b border-border bg-secondary/50 backdrop-blur-sm">
        <div className="py-2 text-center font-mono text-sm text-muted-foreground">
          Waiting for verified NSE market data...
        </div>
      </div>
    );
  }

  const doubled = [...stocks, ...stocks];

  return (
    <div className="w-full overflow-hidden border-b border-border bg-secondary/50 backdrop-blur-sm">
      <div className="flex animate-ticker-scroll whitespace-nowrap py-2">
        {doubled.map((stock, i) => (
          <div key={`${stock.symbol}-${i < stocks.length ? "a" : "b"}`} className="mx-6 flex items-center gap-2 font-mono text-sm">
            <span className="font-semibold text-foreground">{stock.symbol}</span>
            <span className="text-muted-foreground">₹{stock.price.toFixed(2)}</span>
            <span className={stock.change >= 0 ? "text-chart-up" : "text-chart-down"}>
              {stock.change >= 0 ? "▲" : "▼"} {Math.abs(stock.changePercent).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TickerBar;
