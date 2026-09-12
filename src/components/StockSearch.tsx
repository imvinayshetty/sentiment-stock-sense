import { useEffect, useRef, useState } from "react";
import { Search, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { resolveSymbol } from "@/hooks/useAngelOneData";
import type { StockQuote } from "@/lib/stockData";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useDailyBasket } from "@/hooks/useDailyBasket";
import HoldingsSellPanel from "./HoldingsSellPanel";

interface StockSearchProps {
  onSelect: (symbol: string) => void;
  selectedSymbol: string;
}

const StockSearch = ({ onSelect, selectedSymbol }: StockSearchProps) => {
  const [query, setQuery] = useState("");
  const [resolveState, setResolveState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const { settings } = useUserSettings();
  const holdings = settings.holdings;
  // Remember the last symbol the user explicitly clicked, so that when an
  // auto-selected (typed) query is cleared we can restore their real choice.
  const lastExplicitRef = useRef(selectedSymbol);
  // Ranking + budget allocation are shared with the daily-accuracy panel so both
  // always describe the exact same basket of stocks.
  const { stocks, ranked, topBuy, suggestedQty, budgetMax, isLoading } = useDailyBasket();


  const q = query.trim().toLowerCase();
  const filtered = q
    ? stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      )
    : [];
  const symbolCandidate = query.trim().toUpperCase();
  const canTryFreeForm =
    !!q && filtered.length === 0 && /^[A-Z0-9&_\-]{1,20}$/.test(symbolCandidate);

  const handleResolveFreeForm = async () => {
    setResolveState({ loading: true, error: null });
    try {
      const resolved = await resolveSymbol(symbolCandidate);
      lastExplicitRef.current = resolved.symbol;
      onSelect(resolved.symbol);
      setQuery("");
      setResolveState({ loading: false, error: null });
    } catch (e) {
      setResolveState({ loading: false, error: (e as Error).message });
    }
  };

  // Reset resolve error when the query changes.
  useEffect(() => {
    setResolveState((s) => (s.error ? { loading: s.loading, error: null } : s));
  }, [q]);

  // Auto-select the best match as the user types so StockDetail updates live.
  // Debounced (300ms) and keyed on the query only, so mid-keystroke filtering
  // doesn't trigger a burst of onSelect → quote/forecast refetches.
  useEffect(() => {
    if (!q) return;
    const handle = setTimeout(() => {
      const matches = stocks.filter(
        (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
      );
      if (matches.length === 0) return;
      const exact = matches.find((s) => s.symbol.toLowerCase() === q);
      const startsWith = matches.find((s) => s.symbol.toLowerCase().startsWith(q));
      const best = exact ?? startsWith ?? matches[0];
      if (best && best.symbol !== selectedSymbol) onSelect(best.symbol);
    }, 300);
    return () => clearTimeout(handle);
    // `selectedSymbol` is intentionally omitted: it's read inside the debounced
    // callback only as a stale-closure guard. Including it would re-run the effect
    // on every auto-select (onSelect → selectedSymbol change), doubling evaluations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, stocks, onSelect]);

  // When the query is cleared (deleted or Escape), restore the user's last
  // explicit selection rather than leaving an auto-selected stock active.
  useEffect(() => {
    if (q) return;
    if (lastExplicitRef.current && lastExplicitRef.current !== selectedSymbol) {
      onSelect(lastExplicitRef.current);
    }
  }, [q, selectedSymbol, onSelect]);

  // Keep lastExplicitRef in sync when selectedSymbol changes outside of search
  // (e.g. deep link, external buttons). Only track changes made while the
  // search box is empty so mid-query auto-selections don't overwrite it.
  useEffect(() => {
    if (!q) lastExplicitRef.current = selectedSymbol;
  }, [selectedSymbol, q]);

  // Only compute when there are no holdings; otherwise HoldingsSellPanel replaces this list.
  const topSell = holdings.length === 0 ? ranked.slice(-10).reverse() : [];
  const showNoVerifiedData = !isLoading && stocks.length === 0;

  const renderCard = (stock: StockQuote) => (
    <button
      key={stock.symbol}
      onClick={() => {
        lastExplicitRef.current = stock.symbol;
        onSelect(stock.symbol);
      }}
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
      {suggestedQty.has(stock.symbol) && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Suggested: {suggestedQty.get(stock.symbol)} share{suggestedQty.get(stock.symbol)! > 1 ? "s" : ""}
        </div>
      )}
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
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
          className="w-full rounded-lg border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
            Fetching live data...
          </span>
        )}
      </div>

      {q ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {showNoVerifiedData && (
              <p className="col-span-full text-sm text-muted-foreground">Verified market data is unavailable right now.</p>
            )}
            {filtered.map(renderCard)}
          </div>
          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-3">
              {canTryFreeForm ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-foreground">
                      No curated match. Try{" "}
                      <span className="font-mono font-semibold">{symbolCandidate}</span>{" "}
                      as a live NSE symbol?
                    </p>
                    {resolveState.error && (
                      <p className="mt-1 text-xs text-chart-down">{resolveState.error}</p>
                    )}
                  </div>
                  <button
                    onClick={handleResolveFreeForm}
                    disabled={resolveState.loading}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {resolveState.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Search live NSE
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No stocks match "{query}".</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-chart-up/30 bg-chart-up/5 p-3">
            <header className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-up" />
              <h2 className="text-sm font-semibold text-foreground">Top 10 to Buy</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {budgetMax != null ? `₹${budgetMax.toLocaleString("en-IN")} total mix` : "Strong momentum today"}
              </span>
            </header>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {topBuy.map(renderCard)}
              {showNoVerifiedData && (
                <p className="col-span-full text-sm text-muted-foreground">Waiting for verified buy-side market movers.</p>
              )}
              {!showNoVerifiedData && topBuy.length === 0 && budgetMax != null && (
                <p className="col-span-full text-sm text-muted-foreground">
                  No stocks fit within your ₹{budgetMax.toLocaleString("en-IN")} total budget. Raise it in Portfolio settings.
                </p>
              )}
            </div>
          </section>
          {holdings.length > 0 ? (
            <HoldingsSellPanel
              holdings={holdings}
              onSelect={(sym) => {
                lastExplicitRef.current = sym;
                onSelect(sym);
              }}
              selectedSymbol={selectedSymbol}
            />
          ) : (
            <section className="rounded-lg border border-chart-down/30 bg-chart-down/5 p-3">
              <header className="mb-2 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-chart-down" />
                <h2 className="text-sm font-semibold text-foreground">Top 10 to Sell</h2>
                <span className="ml-auto text-xs text-muted-foreground">Weak / declining today</span>
              </header>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {topSell.map(renderCard)}
                {showNoVerifiedData && (
                  <p className="col-span-full text-sm text-muted-foreground">Waiting for verified sell-side market movers.</p>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/80">
                Add your holdings in Portfolio settings to get personalised sell suggestions with target prices.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default StockSearch;
