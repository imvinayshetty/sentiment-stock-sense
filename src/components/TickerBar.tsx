import { useStockQuotes } from "@/hooks/useAngelOneData";

const TickerBar = () => {
  const { data: quotes } = useStockQuotes();
  const liveStocks = quotes?.data ?? [];
  const stocks = liveStocks;

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
