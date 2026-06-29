import { useEffect, useRef, useState } from "react";
import { useStockQuotes } from "@/hooks/useAngelOneData";
import type { StockQuote } from "@/lib/stockData";

const TickerBar = () => {
  const { data: quotes } = useStockQuotes();
  const liveStocks = quotes?.data ?? [];

  // Freeze the ticker data so a background 45s refetch doesn't restart the
  // scroll animation mid-cycle. We only swap in fresh data when the count
  // changes (initial load) — price text otherwise updates on the next mount.
  const [stocks, setStocks] = useState<StockQuote[]>(liveStocks);
  const lenRef = useRef(liveStocks.length);
  useEffect(() => {
    if (liveStocks.length && liveStocks.length !== lenRef.current) {
      lenRef.current = liveStocks.length;
      setStocks(liveStocks);
    } else if (liveStocks.length && stocks.length === 0) {
      setStocks(liveStocks);
    }
  }, [liveStocks, stocks.length]);

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
