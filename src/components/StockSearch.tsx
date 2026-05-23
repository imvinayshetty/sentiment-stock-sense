import { useEffect, useMemo, useState } from "react";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { useStockQuotes } from "@/hooks/useAngelOneData";
import { getStockDirectory, type StockQuote } from "@/lib/stockData";

interface StockSearchProps {
  onSelect: (symbol: string) => void;
  selectedSymbol: string;
}

function scoreStock(s: StockQuote): number {
  // Today's movement (history-relative via prev close baked into changePercent)
  const move = s.changePercent ?? 0;
  // Intraday momentum: where price sits in the day's range (0 = at low, 1 = at high)
  const range = (s.high ?? s.price) - (s.low ?? s.price);
  const pos = range > 0 ? ((s.price - (s.low ?? s.price)) / range) : 0.5;
  // Gap from open: extends/contradicts trend
  const gap = s.open ? ((s.price - s.open) / s.open) * 100 : 0;
  return move * 1.0 + (pos - 0.5) * 2 + gap * 0.3;
}

const StockSearch = ({ onSelect, selectedSymbol }: StockSearchProps) => {
  const [query, setQuery] = useState("");
  const { data: quotes, isLoading } = useStockQuotes();
  const liveStocks = quotes?.data ?? [];
  const directory = getStockDirectory();
  const stocks = useMemo<StockQuote[]>(() => {
    const liveMap = new Map(liveStocks.map((s) => [s.symbol, s]));
    return directory
      .map((entry) => liveMap.get(entry.symbol))
      .filter((stock): stock is StockQuote => Boolean(stock));
  }, [directory, liveStocks]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      )
    : [];

  // Auto-select the best match as the user types so StockDetail updates live
  useEffect(() => {
    if (!q || filtered.length === 0) return;
    const exact = filtered.find((s) => s.symbol.toLowerCase() === q);
    const startsWith = filtered.find((s) => s.symbol.toLowerCase().startsWith(q));
    const best = exact ?? startsWith ?? filtered[0];
    if (best && best.symbol !== selectedSymbol) {
      onSelect(best.symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filtered.length]);

  const ranked = [...stocks].sort((a, b) => scoreStock(b) - scoreStock(a));
  const topBuy = ranked.slice(0, 10);
  const topSell = ranked.slice(-10).reverse();

  const renderCard = (stock: StockQuote) => (
    <button
      key={stock.symbol}
      onClick={() => onSelect(stock.symbol)}
      className={`rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:card-glow ${
        selectedSymbol === stock.symbol
          ? "border-primary bg-primary/10 card-glow"
          : "border-border bg-card"
      }`}
    >
      <div className="font-mono text-sm font-bold text-foreground">{stock.symbol}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{stock.name}</div>
      <div className="mt-1 font-mono text-sm text-foreground">₹{stock.price.toFixed(2)}</div>
      <div className={`font-mono text-xs ${stock.change >= 0 ? "text-chart-up" : "text-chart-down"}`}>
        {stock.change >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
      </div>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search stocks (e.g., RELIANCE, TCS)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
            Fetching live data...
          </span>
        )}
      </div>

      {q ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {filtered.map(renderCard)}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">No stocks match "{query}".</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-chart-up/30 bg-chart-up/5 p-3">
            <header className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-up" />
              <h2 className="text-sm font-semibold text-foreground">Top 10 to Buy</h2>
              <span className="ml-auto text-xs text-muted-foreground">Strong momentum today</span>
            </header>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {topBuy.map(renderCard)}
            </div>
          </section>
          <section className="rounded-lg border border-chart-down/30 bg-chart-down/5 p-3">
            <header className="mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-chart-down" />
              <h2 className="text-sm font-semibold text-foreground">Top 10 to Sell</h2>
              <span className="ml-auto text-xs text-muted-foreground">Weak / declining today</span>
            </header>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {topSell.map(renderCard)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default StockSearch;
