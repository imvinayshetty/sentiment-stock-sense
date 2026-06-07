import { useMemo, useState } from "react";
import { Search, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { useStockQuotes } from "@/hooks/useAngelOneData";
import { getStockDirectory, type StockQuote } from "@/lib/stockData";
import { useToast } from "@/hooks/use-toast";

interface Trade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  time: string;
}

const DemoTrading = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StockQuote | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const { data: quotes, isLoading } = useStockQuotes();
  const { toast } = useToast();

  const liveStocks = quotes?.data ?? [];
  const directory = getStockDirectory();

  const stocks = useMemo<StockQuote[]>(() => {
    const liveMap = new Map(liveStocks.map((s) => [s.symbol, s]));
    return directory
      .map((entry) => liveMap.get(entry.symbol))
      .filter((stock): stock is StockQuote => Boolean(stock));
  }, [directory, liveStocks]);

  // Keep the selected stock's price in sync with live quotes
  const liveSelected = selected
    ? stocks.find((s) => s.symbol === selected.symbol) ?? selected
    : null;

  const q = query.trim().toLowerCase();
  const matches = q
    ? stocks
        .filter(
          (s) =>
            s.symbol.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q),
        )
        .slice(0, 8)
    : [];

  const handleSelect = (stock: StockQuote) => {
    setSelected(stock);
    setQuery("");
  };

  const handleTrade = (side: "BUY" | "SELL") => {
    if (!liveSelected) return;
    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol: liveSelected.symbol,
      side,
      price: liveSelected.price,
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    setTrades((prev) => [trade, ...prev].slice(0, 50));
    toast({
      title: `${side} order placed (demo)`,
      description: `${liveSelected.symbol} @ ₹${liveSelected.price.toFixed(2)}`,
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Demo Trading</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          Practice buy/sell with live NSE prices · no real money
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Stock</th>
              <th className="py-2 pr-4 font-medium">Current Price</th>
              <th className="py-2 pr-4 font-medium">Buy</th>
              <th className="py-2 font-medium">Sell</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border align-top">
              {/* Search column */}
              <td className="py-3 pr-4">
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={
                      liveSelected ? liveSelected.symbol : "Search stock..."
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {q && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                      {matches.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {isLoading ? "Loading..." : `No match for "${query}"`}
                        </p>
                      )}
                      {matches.map((s) => (
                        <button
                          key={s.symbol}
                          onClick={() => handleSelect(s)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                        >
                          <span>
                            <span className="font-mono text-sm font-bold text-foreground">
                              {s.symbol}
                            </span>
                            <span className="ml-2 truncate text-xs text-muted-foreground">
                              {s.name}
                            </span>
                          </span>
                          <span className="font-mono text-xs text-foreground">
                            ₹{s.price.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {liveSelected && (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {liveSelected.name}
                  </div>
                )}
              </td>

              {/* Price column */}
              <td className="py-3 pr-4">
                {liveSelected ? (
                  <div>
                    <div className="font-mono text-base font-bold text-foreground">
                      ₹{liveSelected.price.toFixed(2)}
                    </div>
                    <div
                      className={`font-mono text-xs ${
                        liveSelected.change >= 0
                          ? "text-chart-up"
                          : "text-chart-down"
                      }`}
                    >
                      {liveSelected.change >= 0 ? "+" : ""}
                      {liveSelected.changePercent.toFixed(2)}%
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>

              {/* Buy column */}
              <td className="py-3 pr-4">
                <button
                  onClick={() => handleTrade("BUY")}
                  disabled={!liveSelected}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-chart-up/40 bg-chart-up/10 px-4 py-2 text-sm font-semibold text-chart-up transition-colors hover:bg-chart-up/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Buy
                </button>
              </td>

              {/* Sell column */}
              <td className="py-3">
                <button
                  onClick={() => handleTrade("SELL")}
                  disabled={!liveSelected}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-chart-down/40 bg-chart-down/10 px-4 py-2 text-sm font-semibold text-chart-down transition-colors hover:bg-chart-down/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowDownCircle className="h-4 w-4" />
                  Sell
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {trades.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            Order History (demo)
          </h3>
          <div className="space-y-1">
            {trades.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs"
              >
                <span
                  className={`font-semibold ${
                    t.side === "BUY" ? "text-chart-up" : "text-chart-down"
                  }`}
                >
                  {t.side}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {t.symbol}
                </span>
                <span className="font-mono text-foreground">
                  ₹{t.price.toFixed(2)}
                </span>
                <span className="ml-auto font-mono text-muted-foreground">
                  {t.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default DemoTrading;