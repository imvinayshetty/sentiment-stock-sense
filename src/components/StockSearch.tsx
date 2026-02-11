import { useState } from "react";
import { Search } from "lucide-react";
import { getStocks, type StockQuote } from "@/lib/stockData";

interface StockSearchProps {
  onSelect: (symbol: string) => void;
  selectedSymbol: string;
}

const StockSearch = ({ onSelect, selectedSymbol }: StockSearchProps) => {
  const [query, setQuery] = useState("");
  const stocks = getStocks();
  const filtered = stocks.filter(
    (s) =>
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search stocks (e.g., AAPL, Tesla)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {filtered.map((stock) => (
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
            <div className="mt-1 font-mono text-sm text-foreground">${stock.price.toFixed(2)}</div>
            <div className={`font-mono text-xs ${stock.change >= 0 ? "text-chart-up" : "text-chart-down"}`}>
              {stock.change >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StockSearch;
