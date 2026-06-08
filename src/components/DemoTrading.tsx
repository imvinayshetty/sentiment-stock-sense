import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  PlusCircle,
  RotateCcw,
} from "lucide-react";
import { useStockQuotes } from "@/hooks/useAngelOneData";
import { getStockDirectory, type StockQuote } from "@/lib/stockData";
import { useToast } from "@/hooks/use-toast";

interface Trade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  total: number;
  time: string;
}

interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
}

const MAX_BALANCE = 100000;
const STORAGE_KEY = "demo-trading-state";

function loadState<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return key in parsed ? (parsed[key] as T) : fallback;
  } catch {
    return fallback;
  }
}

const DemoTrading = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StockQuote | null>(null);
  const [trades, setTrades] = useState<Trade[]>(() => loadState("trades", []));
  const [quantity, setQuantity] = useState(1);
  const [balance, setBalance] = useState(() => loadState("balance", 0));
  const [topUp, setTopUp] = useState("");
  const [holdings, setHoldings] = useState<Record<string, Holding>>(() =>
    loadState("holdings", {}),
  );
  const { data: quotes, isLoading } = useStockQuotes();
  const { toast } = useToast();

  // Persist demo trading data so it survives refreshes
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ trades, balance, holdings }),
    );
  }, [trades, balance, holdings]);

  const handleReset = () => {
    setTrades([]);
    setBalance(0);
    setHoldings({});
    setSelected(null);
    setQuantity(1);
    setTopUp("");
    localStorage.removeItem(STORAGE_KEY);
    toast({
      title: "Demo trading reset",
      description: "Balance, holdings and order history cleared.",
    });
  };

  const liveStocks = quotes?.data ?? [];
  const directory = getStockDirectory();

  const stocks = useMemo<StockQuote[]>(() => {
    const liveMap = new Map(liveStocks.map((s) => [s.symbol, s]));
    return directory
      .map((entry) => liveMap.get(entry.symbol))
      .filter((stock): stock is StockQuote => Boolean(stock));
  }, [directory, liveStocks]);

  const priceMap = useMemo(
    () => new Map(stocks.map((s) => [s.symbol, s.price])),
    [stocks],
  );

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

  const handleTopUp = () => {
    const amount = Number(topUp);
    if (!amount || amount <= 0) return;
    const next = Math.min(MAX_BALANCE, balance + amount);
    setBalance(next);
    setTopUp("");
    toast({
      title: "Balance topped up (demo)",
      description: `Added ₹${(next - balance).toFixed(2)} · Balance ₹${next.toFixed(2)}`,
    });
  };

  const handleTrade = (side: "BUY" | "SELL") => {
    if (!liveSelected) return;
    const qty = Math.max(1, Math.floor(quantity) || 1);
    const total = liveSelected.price * qty;

    if (side === "BUY") {
      if (total > balance) {
        toast({
          title: "Insufficient balance",
          description: `Need ₹${total.toFixed(2)}, available ₹${balance.toFixed(2)}. Top up first.`,
          variant: "destructive",
        });
        return;
      }
      setBalance((b) => b - total);
      setHoldings((prev) => {
        const existing = prev[liveSelected.symbol];
        const newQty = (existing?.quantity ?? 0) + qty;
        const newAvg = existing
          ? (existing.avgPrice * existing.quantity + total) / newQty
          : liveSelected.price;
        return {
          ...prev,
          [liveSelected.symbol]: {
            symbol: liveSelected.symbol,
            name: liveSelected.name,
            quantity: newQty,
            avgPrice: newAvg,
          },
        };
      });
    } else {
      const existing = holdings[liveSelected.symbol];
      if (!existing || existing.quantity < qty) {
        toast({
          title: "Not enough holdings",
          description: `You hold ${existing?.quantity ?? 0} ${liveSelected.symbol}.`,
          variant: "destructive",
        });
        return;
      }
      setBalance((b) => Math.min(MAX_BALANCE, b + total));
      setHoldings((prev) => {
        const remaining = existing.quantity - qty;
        const next = { ...prev };
        if (remaining <= 0) {
          delete next[liveSelected.symbol];
        } else {
          next[liveSelected.symbol] = { ...existing, quantity: remaining };
        }
        return next;
      });
    }

    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol: liveSelected.symbol,
      side,
      price: liveSelected.price,
      quantity: qty,
      total,
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    setTrades((prev) => [trade, ...prev].slice(0, 50));
    toast({
      title: `${side} order placed (demo)`,
      description: `${qty} × ${liveSelected.symbol} @ ₹${liveSelected.price.toFixed(2)} = ₹${total.toFixed(2)}`,
    });
  };

  const holdingsList = Object.values(holdings);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Demo Trading</h2>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          Practice buy/sell with live NSE prices · no real money
        </span>
        <button
          onClick={handleReset}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:ml-3"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </header>

      {/* Balance + Top up */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div>
          <div className="text-xs text-muted-foreground">Available balance</div>
          <div className="font-mono text-lg font-bold text-foreground">
            ₹{balance.toFixed(2)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={MAX_BALANCE}
            placeholder="Amount"
            value={topUp}
            onChange={(e) => setTopUp(e.target.value)}
            className="w-28 rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleTopUp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <PlusCircle className="h-4 w-4" />
            Top up
          </button>
        </div>
        <p className="w-full text-[11px] text-muted-foreground">
          Max balance ₹{MAX_BALANCE.toLocaleString("en-IN")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Stock</th>
              <th className="py-2 pr-4 font-medium">Current Price</th>
              <th className="py-2 pr-4 font-medium">Quantity</th>
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

              {/* Quantity column */}
              <td className="py-3 pr-4">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  disabled={!liveSelected}
                  className="w-20 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                />
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

      {holdingsList.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            Your Holdings (demo)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Stock</th>
                  <th className="py-2 pr-4 font-medium">Qty</th>
                  <th className="py-2 pr-4 font-medium">Purchased Value</th>
                  <th className="py-2 pr-4 font-medium">Current Value</th>
                  <th className="py-2 font-medium">P/L</th>
                </tr>
              </thead>
              <tbody>
                {holdingsList.map((h) => {
                  const livePrice = priceMap.get(h.symbol) ?? h.avgPrice;
                  const purchased = h.avgPrice * h.quantity;
                  const current = livePrice * h.quantity;
                  const pl = current - purchased;
                  const plPct = purchased > 0 ? (pl / purchased) * 100 : 0;
                  const up = pl >= 0;
                  return (
                    <tr key={h.symbol} className="border-b border-border">
                      <td className="py-2 pr-4">
                        <span className="font-mono font-bold text-foreground">
                          {h.symbol}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-foreground">
                        {h.quantity}
                      </td>
                      <td className="py-2 pr-4 font-mono text-foreground">
                        ₹{purchased.toFixed(2)}
                      </td>
                      <td
                        className={`py-2 pr-4 font-mono font-semibold ${
                          up ? "text-chart-up" : "text-chart-down"
                        }`}
                      >
                        ₹{current.toFixed(2)}
                      </td>
                      <td
                        className={`py-2 font-mono ${
                          up ? "text-chart-up" : "text-chart-down"
                        }`}
                      >
                        {up ? "+" : ""}
                        ₹{pl.toFixed(2)} ({up ? "+" : ""}
                        {plPct.toFixed(2)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  {t.quantity} × ₹{t.price.toFixed(2)}
                </span>
                <span className="font-mono font-semibold text-foreground">
                  = ₹{t.total.toFixed(2)}
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