import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  PlusCircle,
  RotateCcw,
  Loader2,
  ShieldAlert,
  Target,
} from "lucide-react";
import { useStockQuotes, resolveSymbol } from "@/hooks/useAngelOneData";
import { useAutoExitMonitoring, type ExitReason } from "@/hooks/useAutoExitMonitoring";
import { getStockDirectory, type StockQuote } from "@/lib/stockData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Trade {
  id: string;
  symbol: string;
  /** Company name captured at execution time (for holdings display). */
  name?: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  total: number;
  time: string;
  /** Execution timestamp (ISO) used to replay the ledger deterministically. */
  at?: string;
  /** Stop-loss level attached at buy time (BUY rows only). */
  stopLossPrice?: number;
  /** Take-profit level attached at buy time (BUY rows only). */
  targetPrice?: number;
  /** How a SELL row was triggered. Older rows have no value = manual. */
  exitReason?: "manual" | ExitReason;
}

/** Position derived from the trade ledger. Named to avoid colliding with the
 *  user-settings `Holding` type, which has a different shape. */
interface DemoHolding {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  /** Optional protective exit level for the whole position. */
  stopLossPrice?: number;
  /** Optional take-profit exit level for the whole position. */
  targetPrice?: number;
}

const MAX_BALANCE = 100000;
const EMPTY_POSITIONS: DemoHolding[] = [];
/** Keep a generous ledger so derived holdings never lose their cost basis. */
const MAX_TRADES = 500;

/**
 * Single source of truth: replay the trade ledger (oldest → newest) into
 * positions, so holdings can never desync from order history.
 */
function derivePositions(trades: Trade[]): Record<string, DemoHolding> {
  const out: Record<string, DemoHolding> = {};
  for (let i = trades.length - 1; i >= 0; i--) {
    const t = trades[i];
    const pos = out[t.symbol];
    if (t.side === "BUY") {
      const qty = (pos?.quantity ?? 0) + t.quantity;
      const cost = (pos ? pos.avgPrice * pos.quantity : 0) + t.total;
      out[t.symbol] = {
        symbol: t.symbol,
        name: t.name ?? pos?.name ?? t.symbol,
        quantity: qty,
        avgPrice: qty > 0 ? cost / qty : t.price,
        // A newly supplied level replaces the previous one for the (now
        // averaged) position; otherwise the existing level carries over.
        stopLossPrice: t.stopLossPrice ?? pos?.stopLossPrice,
        targetPrice: t.targetPrice ?? pos?.targetPrice,
      };
    } else if (pos) {
      const remaining = pos.quantity - t.quantity;
      if (remaining <= 0) delete out[t.symbol];
      else out[t.symbol] = { ...pos, quantity: remaining };
    }
  }
  return out;
}

/**
 * Legacy states stored `holdings` separately. If a saved position is not
 * reproducible from the ledger, synthesize an opening BUY row so the derived
 * view keeps it (and its exit levels).
 */
function migrateLedger(
  trades: Trade[],
  legacy?: Record<string, DemoHolding>,
): Trade[] {
  if (!legacy) return trades;
  const derived = derivePositions(trades);
  const synthetic: Trade[] = [];
  Object.values(legacy).forEach((h) => {
    if (derived[h.symbol] || !(h.quantity > 0)) return;
    synthetic.push({
      id: crypto.randomUUID(),
      symbol: h.symbol,
      name: h.name,
      side: "BUY",
      price: h.avgPrice,
      quantity: h.quantity,
      total: h.avgPrice * h.quantity,
      stopLossPrice: h.stopLossPrice,
      targetPrice: h.targetPrice,
      time: "—",
    });
  });
  // Synthetic openings are the oldest entries in the ledger.
  return [...trades, ...synthetic];
}
const STORAGE_KEY = "demo-trading-state";
const SESSION_KEY = "demo-session-id";

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

// Stable anonymous session id so the demo portfolio can be persisted in the backend
// (survives storage clears / incognito on the same browser, syncs across reloads).
function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // localStorage blocked (e.g. strict private mode) — fall back to sessionStorage
    // so the id at least stays stable within the tab session instead of changing
    // on every call/remount and orphaning backend rows.
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return crypto.randomUUID(); // truly ephemeral — accepted tradeoff
    }
  }
}

const DemoTrading = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StockQuote | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [resolveState, setResolveState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [trades, setTrades] = useState<Trade[]>(() =>
    migrateLedger(loadState<Trade[]>("trades", []), loadState("holdings", undefined)),
  );
  const [quantity, setQuantity] = useState(1);
  const [stopLossMethod, setStopLossMethod] = useState<"percentage" | "price">("percentage");
  const [targetMethod, setTargetMethod] = useState<"percentage" | "price">("percentage");
  const [stopLossValue, setStopLossValue] = useState<string>("");
  const [targetValue, setTargetValue] = useState<string>("");
  const [balance, setBalance] = useState(() => loadState("balance", 0));
  const [topUp, setTopUp] = useState("");
  const { data: quotes, isLoading } = useStockQuotes();
  const { toast } = useToast();

  const sessionId = useRef(getSessionId());
  const remoteLoaded = useRef(false);
  // Latest ledger for callbacks that must not close over a stale array.
  const tradesRef = useRef(trades);
  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  // Load the saved portfolio from the backend (primary), falling back to the
  // localStorage copy that already seeded the initial state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("demo_state").select("state").eq("session_id", sessionId.current).maybeSingle();
        const s = data?.state as {
          trades?: Trade[];
          balance?: number;
          holdings?: Record<string, DemoHolding>;
        } | null;
        if (!cancelled && s) {
          if (Array.isArray(s.trades)) setTrades(migrateLedger(s.trades, s.holdings));
          if (typeof s.balance === "number") setBalance(s.balance);
        }
      } catch (e) {
        console.error("Demo portfolio load failed, using local cache:", e);
      } finally {
        remoteLoaded.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist to localStorage (fast cache) + backend (debounced, after remote load).
  useEffect(() => {
    const payload = { trades, balance };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch { /* ignore quota / disabled storage */ }
    if (!remoteLoaded.current) return;
    const t = setTimeout(() => {
      supabase
        .from("demo_state")
        .upsert({ session_id: sessionId.current, state: JSON.parse(JSON.stringify(payload)), updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error("Demo portfolio save failed:", error); });
    }, 600);
    return () => clearTimeout(t);
  }, [trades, balance]);

  const handleReset = async () => {
    setTrades([]);
    setBalance(0);
    setSelected(null);
    setQuantity(1);
    setTopUp("");
    localStorage.removeItem(STORAGE_KEY);
    try {
      await supabase.from("demo_state").delete().eq("session_id", sessionId.current);
    } catch (e) {
      console.error("Demo portfolio reset (backend) failed:", e);
    }
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

  // Reconstruct portfolio NAV (net asset value) history client-side by replaying
  // the timestamped trade log. Holdings are marked to the last execution price
  // known up to that point; a final "Now" point uses live prices.
  // Keep the selected stock's price in sync with live quotes
  const liveSelected = selected
    ? stocks.find((s) => s.symbol === selected.symbol) ?? selected
    : null;

  const q = query.trim().toLowerCase();
  // Search the full curated directory (not just symbols with live quotes) so
  // suggestions appear even while quotes are loading or unavailable. Live price
  // is overlaid when known, otherwise 0 until a quote arrives.
  const matches = useMemo<StockQuote[]>(() => {
    if (!q) return [];
    const liveMap = new Map(stocks.map((s) => [s.symbol, s]));
    return directory
      .filter(
        (e) =>
          e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
      )
      .slice(0, 8)
      .map(
        (e) =>
          liveMap.get(e.symbol) ?? {
            symbol: e.symbol,
            name: e.name,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: "-",
            high: 0,
            low: 0,
            open: 0,
          },
      );
  }, [q, stocks, directory]);

  const handleSelect = (stock: StockQuote) => {
    setSelected(stock);
    setQuery("");
    setSearchOpen(false);
  };

  const symbolCandidate = query.trim().toUpperCase();
  const canTryFreeForm =
    !!q && matches.length === 0 && /^[A-Z0-9&_\-]{1,20}$/.test(symbolCandidate);

  const handleResolveFreeForm = async () => {
    setResolveState({ loading: true, error: null });
    try {
      const r = await resolveSymbol(symbolCandidate);
      setSelected({
        symbol: r.symbol,
        name: r.name,
        price: r.price,
        change: 0,
        changePercent: 0,
        volume: "-",
        high: r.price,
        low: r.price,
        open: r.price,
        exchange: r.exchange,
      });
      setQuery("");
      setSearchOpen(false);
      setResolveState({ loading: false, error: null });
    } catch (e) {
      setResolveState({ loading: false, error: (e as Error).message });
    }
  };

  // Clear any resolve error when the query changes.
  useEffect(() => {
    setResolveState((s) => (s.error ? { loading: s.loading, error: null } : s));
    setActiveIdx(0);
  }, [q]);

  // Dropdown is positioned in viewport coordinates so it is never clipped by
  // the table's horizontal-scroll container, and flips up near the viewport
  // bottom.
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const dropdownVisible = searchOpen && !!q;
  const { anchorRef: searchRef, panelRef, pos: dropdownPos } = useAnchoredDropdown(
    dropdownVisible,
    closeSearch,
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownVisible || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[activeIdx] ?? matches[0];
      if (pick) handleSelect(pick);
    }
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

  // Positions are derived from the ledger — never stored separately (no desync).
  const holdings = useMemo(() => derivePositions(trades), [trades]);
  const holdingsList = useMemo(() => Object.values(holdings), [holdings]);

  /** Credit sale proceeds, warning when the demo balance cap truncates them. */
  const creditProceeds = useCallback(
    (proceeds: number) => {
      setBalance((b) => {
        const next = Math.min(MAX_BALANCE, b + proceeds);
        const lost = b + proceeds - next;
        if (lost > 0.005) {
          toast({
            title: "Balance capped",
            description: `₹${lost.toFixed(2)} of the proceeds was not credited — demo balance is capped at ₹${MAX_BALANCE.toLocaleString("en-IN")}.`,
          });
        }
        return next;
      });
    },
    [toast],
  );

  const handleTrade = (side: "BUY" | "SELL") => {
    if (!liveSelected) return;
    const qty = Math.max(1, Math.floor(quantity) || 1);
    const total = liveSelected.price * qty;
    let slPrice: number | undefined;
    let slPercent: number | undefined;
    let tgtPrice: number | undefined;
    let tgtPercent: number | undefined;

    if (side === "BUY" && stopLossValue.trim() !== "") {
      const v = Number(stopLossValue);
      if (!Number.isFinite(v)) {
        toast({ title: "Invalid stop loss", description: "Enter a number.", variant: "destructive" });
        return;
      }
      if (stopLossMethod === "percentage") {
        const pct = -Math.abs(v);
        slPercent = pct;
        slPrice = liveSelected.price * (1 + pct / 100);
      } else {
        slPrice = v;
        slPercent = ((v - liveSelected.price) / liveSelected.price) * 100;
      }
      if (!(slPrice > 0) || slPrice >= liveSelected.price) {
        toast({
          title: "Invalid stop loss",
          description: `Stop loss must be above 0 and below ₹${liveSelected.price.toFixed(2)}.`,
          variant: "destructive",
        });
        return;
      }
    }

    if (side === "BUY" && targetValue.trim() !== "") {
      const v = Number(targetValue);
      if (!Number.isFinite(v)) {
        toast({ title: "Invalid target", description: "Enter a number.", variant: "destructive" });
        return;
      }
      if (targetMethod === "percentage") {
        const pct = Math.abs(v);
        tgtPercent = pct;
        tgtPrice = liveSelected.price * (1 + pct / 100);
      } else {
        tgtPrice = v;
        tgtPercent = ((v - liveSelected.price) / liveSelected.price) * 100;
      }
      if (!(tgtPrice > 0) || tgtPrice <= liveSelected.price) {
        toast({
          title: "Invalid target",
          description: `Target must be above the entry price ₹${liveSelected.price.toFixed(2)}.`,
          variant: "destructive",
        });
        return;
      }
      if (slPrice != null && tgtPrice <= slPrice) {
        toast({
          title: "Invalid limits",
          description: "Target price must be above the stop loss price.",
          variant: "destructive",
        });
        return;
      }
    }

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
      creditProceeds(total);
    }

    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol: liveSelected.symbol,
      name: liveSelected.name,
      side,
      price: liveSelected.price,
      quantity: qty,
      total,
      at: new Date().toISOString(),
      stopLossPrice: side === "BUY" ? slPrice : undefined,
      targetPrice: side === "BUY" ? tgtPrice : undefined,
      exitReason: side === "SELL" ? "manual" : undefined,
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADES));
    if (side === "BUY") {
      setStopLossValue("");
      setTargetValue("");
    }
    toast({
      title: `${side} order placed (demo)`,
      description: `${qty} × ${liveSelected.symbol} @ ₹${liveSelected.price.toFixed(2)} = ₹${total.toFixed(2)}${
        slPrice != null ? ` · SL ₹${slPrice.toFixed(2)}` : ""
      }${tgtPrice != null ? ` · Target ₹${tgtPrice.toFixed(2)}` : ""}`,
    });
  };

  // Auto-exit a position when live price breaches its stop loss or target.
  const handleAutoExit = useCallback(
    (symbol: string, exitPrice: number, reason: ExitReason) => {
      // Read the position from the latest ledger (no stale closure), then close
      // the ENTIRE position in one SELL row.
      const pos = derivePositions(tradesRef.current)[symbol];
      if (!pos) return;
      const proceeds = exitPrice * pos.quantity;
      creditProceeds(proceeds);
      setTrades((t) =>
        [
          {
            id: crypto.randomUUID(),
            symbol,
            name: pos.name,
            side: "SELL" as const,
            price: exitPrice,
            quantity: pos.quantity,
            total: proceeds,
            at: new Date().toISOString(),
            exitReason: reason,
            time: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
          ...t,
        ].slice(0, MAX_TRADES),
      );
      toast({
        title: reason === "target_reached" ? "Target reached" : "Stop loss triggered",
        description: `${pos.symbol}: sold ${pos.quantity} @ ₹${exitPrice.toFixed(2)}`,
        variant: reason === "target_reached" ? "default" : "destructive",
      });
    },
    [toast, creditProceeds],
  );

  // Only auto-exit while the market is open — closed-market last prices should
  // not trigger fills.
  const monitored = quotes?.marketStatus === "OPEN" ? holdingsList : EMPTY_POSITIONS;
  useAutoExitMonitoring(monitored, priceMap, handleAutoExit);

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

      {quotes?.source === "last-close" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-chart-down/40 bg-chart-down/10 p-3 text-xs text-chart-down">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Prices shown are the last closing values, not live quotes
            {quotes?.marketStatus !== "OPEN" ? " (market closed)" : ""}. Orders
            execute at these stale prices and auto-exit rules stay paused.
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Stock</th>
              <th className="py-2 pr-4 font-medium">Current Price</th>
              <th className="py-2 pr-4 font-medium">Quantity</th>
              <th className="py-2 pr-4 font-medium">Auto-Exit Rules</th>
              <th className="py-2 pr-4 font-medium">Buy</th>
              <th className="py-2 font-medium">Sell</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border align-top">
              {/* Search column */}
              <td className="py-3 pr-4">
                <div ref={searchRef} className="relative w-56">
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
                  {q && dropdownPos && (
                    <div
                      className="fixed z-50 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
                      style={{
                        left: dropdownPos.left,
                        top: dropdownPos.top,
                        width: dropdownPos.width,
                      }}
                    >
                      {matches.length === 0 && (
                        <div className="px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            {isLoading ? "Loading..." : `No match for "${query}"`}
                          </p>
                          {!isLoading && canTryFreeForm && (
                            <>
                              <button
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={handleResolveFreeForm}
                                disabled={resolveState.loading}
                                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                              >
                                {resolveState.loading && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                Search live NSE for {symbolCandidate}
                              </button>
                              {resolveState.error && (
                                <p className="mt-1 text-xs text-chart-down">{resolveState.error}</p>
                              )}
                            </>
                          )}
                        </div>
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
                  step={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Math.floor(Number(e.target.value)) || 1))
                  }
                  disabled={!liveSelected}
                  className="w-20 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                />
              </td>

              {/* Auto-exit (stop loss + target) column */}
              <td className="py-3 pr-4">
                <div className="flex w-64 flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-chart-down">
                        Stop loss (lower)
                      </label>
                      <div className="mb-1 flex rounded-lg border border-border p-0.5 text-[11px]">
                        {(["percentage", "price"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setStopLossMethod(m)}
                            className={`flex-1 rounded-md px-1.5 py-0.5 font-medium transition-colors ${
                              stopLossMethod === m
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {m === "percentage" ? "By %" : "By ₹"}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={stopLossValue}
                        onChange={(e) => setStopLossValue(e.target.value)}
                        disabled={!liveSelected}
                        placeholder={stopLossMethod === "percentage" ? "2 (%)" : "Price"}
                        className="w-full rounded-lg border border-chart-down/40 bg-secondary/50 py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                      />
                      {liveSelected && stopLossValue.trim() !== "" && Number.isFinite(Number(stopLossValue)) && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Sell ≤ ₹
                          {(stopLossMethod === "percentage"
                            ? liveSelected.price * (1 - Math.abs(Number(stopLossValue)) / 100)
                            : Number(stopLossValue)
                          ).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-chart-up">
                        Target (upper)
                      </label>
                      <div className="mb-1 flex rounded-lg border border-border p-0.5 text-[11px]">
                        {(["percentage", "price"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setTargetMethod(m)}
                            className={`flex-1 rounded-md px-1.5 py-0.5 font-medium transition-colors ${
                              targetMethod === m
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {m === "percentage" ? "By %" : "By ₹"}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        disabled={!liveSelected}
                        placeholder={targetMethod === "percentage" ? "5 (%)" : "Price"}
                        className="w-full rounded-lg border border-chart-up/40 bg-secondary/50 py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                      />
                      {liveSelected && targetValue.trim() !== "" && Number.isFinite(Number(targetValue)) && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Sell ≥ ₹
                          {(targetMethod === "percentage"
                            ? liveSelected.price * (1 + Math.abs(Number(targetValue)) / 100)
                            : Number(targetValue)
                          ).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
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
                  <th className="py-2 pr-4 font-medium">P/L</th>
                  <th className="py-2 pr-4 font-medium">Stop Loss</th>
                  <th className="py-2 font-medium">Target</th>
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
                  const slDistancePct =
                    h.stopLossPrice != null && livePrice > 0
                      ? ((livePrice - h.stopLossPrice) / livePrice) * 100
                      : null;
                  const slNear = slDistancePct != null && slDistancePct < 1;
                  const tgtDistancePct =
                    h.targetPrice != null && livePrice > 0
                      ? ((h.targetPrice - livePrice) / livePrice) * 100
                      : null;
                  const tgtNear = tgtDistancePct != null && tgtDistancePct < 1;
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
                        className={`py-2 pr-4 font-mono ${
                          up ? "text-chart-up" : "text-chart-down"
                        }`}
                      >
                        {up ? "+" : ""}
                        ₹{pl.toFixed(2)} ({up ? "+" : ""}
                        {plPct.toFixed(2)}%)
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {h.stopLossPrice != null ? (
                          <div className={slNear ? "text-chart-down" : "text-muted-foreground"}>
                            <div className="flex items-center gap-1 font-semibold">
                              {slNear && <ShieldAlert className="h-3.5 w-3.5" />}
                              SL ₹{h.stopLossPrice.toFixed(2)}
                            </div>
                            <div>{slDistancePct!.toFixed(2)}% away</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {h.targetPrice != null ? (
                          <div className={tgtNear ? "text-chart-up" : "text-muted-foreground"}>
                            <div className="flex items-center gap-1 font-semibold">
                              {tgtNear && <Target className="h-3.5 w-3.5" />}
                              ₹{h.targetPrice.toFixed(2)}
                            </div>
                            <div>{tgtDistancePct!.toFixed(2)}% away</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                className="rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                {t.exitReason === "stop_loss" && (
                  <span className="rounded bg-chart-down/15 px-1.5 py-0.5 font-semibold text-chart-down">
                    SL hit
                  </span>
                )}
                {t.exitReason === "target_reached" && (
                  <span className="rounded bg-chart-up/15 px-1.5 py-0.5 font-semibold text-chart-up">
                    Target hit
                  </span>
                )}
                <span className="ml-auto font-mono text-muted-foreground">
                  {t.time}
                </span>
                </div>
                {t.side === "BUY" && (t.stopLossPrice != null || t.targetPrice != null) && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                    {t.stopLossPrice != null && <span>SL ₹{t.stopLossPrice.toFixed(2)}</span>}
                    {t.targetPrice != null && <span>Tgt ₹{t.targetPrice.toFixed(2)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default DemoTrading;