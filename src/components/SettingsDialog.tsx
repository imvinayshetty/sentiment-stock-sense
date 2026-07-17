import { useEffect, useState } from "react";
import { Plus, Trash2, Settings as SettingsIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserSettings, type Holding } from "@/hooks/useUserSettings";
import { resolveSymbol } from "@/hooks/useAngelOneData";
import { getStockDirectory } from "@/lib/stockData";

const SYMBOL_REGEX = /^[A-Z0-9&_\-]{1,20}$/;

const SettingsDialog = () => {
  const { settings, save } = useUserSettings();
  const [open, setOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [rows, setRows] = useState<Holding[]>([]);
  // Per-row validation state for free-form symbols.
  const [rowStatus, setRowStatus] = useState<Record<number, { loading: boolean; error: string | null; verified: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openSuggestIdx, setOpenSuggestIdx] = useState<number | null>(null);
  const directory = getStockDirectory();
  // Track last-verified symbol per row to skip redundant resolveSymbol calls on blur.
  const [lastVerifiedSymbol, setLastVerifiedSymbol] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    setBudgetInput(settings.budgetMax != null ? String(settings.budgetMax) : "");
    setRows(settings.holdings.length ? settings.holdings : []);
    // Existing holdings were previously verified when added; mark as verified
    // so Save doesn't re-validate them on every open.
    const initial: Record<number, { loading: boolean; error: string | null; verified: boolean }> = {};
    settings.holdings.forEach((_, i) => {
      initial[i] = { loading: false, error: null, verified: true };
    });
    setRowStatus(initial);
    setSaveError(null);
  }, [open, settings]);

  const addRow = () =>
    setRows((r) => [...r, { symbol: "", quantity: 1, buyPrice: 0 }]);

  const updateRow = (idx: number, patch: Partial<Holding>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
    // Any edit to the symbol invalidates prior verification.
    if (patch.symbol !== undefined) {
      setRowStatus((s) => ({ ...s, [idx]: { loading: false, error: null, verified: false } }));
    }
  };

  const getSuggestions = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return directory
      .filter(
        (d) =>
          d.symbol.toLowerCase().includes(q) || d.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  };

  const removeRow = (idx: number) => {
    setRows((r) => r.filter((_, i) => i !== idx));
    setRowStatus((s) => {
      const next: typeof s = {};
      Object.entries(s).forEach(([k, v]) => {
        const n = Number(k);
        if (n < idx) next[n] = v;
        else if (n > idx) next[n - 1] = v;
      });
      return next;
    });
  };

  const verifyRow = async (idx: number, rawSymbol: string) => {
    const sym = rawSymbol.trim().toUpperCase();
    if (!SYMBOL_REGEX.test(sym)) {
      setRowStatus((s) => ({ ...s, [idx]: { loading: false, error: "Invalid symbol", verified: false } }));
      return false;
    }
    // Curated symbols are known-valid — skip the edge function round-trip.
    if (directory.some((d) => d.symbol === sym)) {
      setRowStatus((s) => ({ ...s, [idx]: { loading: false, error: null, verified: true } }));
      setLastVerifiedSymbol((m) => ({ ...m, [idx]: sym }));
      return true;
    }
    setRowStatus((s) => ({ ...s, [idx]: { loading: true, error: null, verified: false } }));
    try {
      const resolved = await resolveSymbol(sym);
      setRows((r) => r.map((row, i) => (i === idx ? { ...row, symbol: resolved.symbol } : row)));
      setRowStatus((s) => ({ ...s, [idx]: { loading: false, error: null, verified: true } }));
      setLastVerifiedSymbol((m) => ({ ...m, [idx]: resolved.symbol }));
      return true;
    } catch (e) {
      setRowStatus((s) => ({ ...s, [idx]: { loading: false, error: (e as Error).message, verified: false } }));
      return false;
    }
  };

  const onSave = async () => {
    const budgetNum = Number(budgetInput);
    const budgetMax =
      budgetInput.trim() && Number.isFinite(budgetNum) && budgetNum >= 1 ? Math.round(budgetNum) : null;
    setSaveError(null);
    setSaving(true);

    // Flag empty rows explicitly so the user knows which row to fix.
    if (rows.some((h) => !h.symbol.trim())) {
      setSaving(false);
      setSaveError("One or more rows have an empty symbol — fill in or remove them.");
      return;
    }

    const upperSyms = rows.map((h) => h.symbol.trim().toUpperCase());
    const duplicates = Array.from(
      new Set(upperSyms.filter((s, i) => s && upperSyms.indexOf(s) !== i)),
    );
    if (duplicates.length) {
      setSaving(false);
      setSaveError(
        `Duplicate symbols: ${duplicates.join(", ")}. Each stock can only appear once.`,
      );
      return;
    }

    // Verify any row that hasn't been confirmed yet.
    const results = await Promise.all(
      rows.map(async (h, i) => {
        const status = rowStatus[i];
        const sym = h.symbol.trim().toUpperCase();
        if (!sym) return { ok: false, idx: i };
        if (status?.verified) return { ok: true, idx: i };
        const ok = await verifyRow(i, sym);
        return { ok, idx: i };
      }),
    );
    setSaving(false);

    if (results.some((r) => !r.ok)) {
      setSaveError("One or more holdings could not be verified. Fix the highlighted rows.");
      return;
    }

    const seen = new Set<string>();
    const cleanHoldings = rows
      .map((h) => ({
        symbol: h.symbol.trim().toUpperCase(),
        quantity: Number(h.quantity),
        buyPrice: Number(h.buyPrice),
      }))
      .filter((h) => {
        if (
          !h.symbol ||
          !Number.isFinite(h.quantity) ||
          h.quantity <= 0 ||
          !Number.isFinite(h.buyPrice) ||
          h.buyPrice <= 0
        )
          return false;
        if (seen.has(h.symbol)) return false;
        seen.add(h.symbol);
        return true;
      });
    save({ budgetMax, holdings: cleanHoldings });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
          <SettingsIcon className="h-3.5 w-3.5" />
          Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Portfolio & Budget</DialogTitle>
          <DialogDescription>
            Set your buying budget and current holdings to personalise the Top 10 to Buy and Sell suggestions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="budget-max">Maximum budget per stock (₹)</Label>
            <Input
              id="budget-max"
              type="number"
              min={1}
              step={1}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="e.g. 5000"
            />
            <p className="text-xs text-muted-foreground">
              Min ₹1. Leave empty to see all buy candidates regardless of price.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Current holdings</Label>
                <p className="text-xs text-muted-foreground">
                  Sell suggestions use forecast + sentiment + RSI/MACD signals.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No holdings yet. Add stocks you currently own to get sell suggestions.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_4rem_5rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_5rem_6rem_2rem]">
                  <span>Symbol</span>
                  <span>Qty</span>
                  <span>Buy price</span>
                  <span />
                </div>
                {rows.map((row, i) => (
                  <div key={`${row.symbol || "empty"}-${i}`} className="space-y-1">
                    <div className="grid grid-cols-[1fr_4rem_5rem_2rem] gap-2 sm:grid-cols-[1fr_5rem_6rem_2rem]">
                      <div className="relative">
                        <Input
                          value={row.symbol}
                          onChange={(e) => updateRow(i, { symbol: e.target.value.toUpperCase() })}
                          onFocus={() => setOpenSuggestIdx(i)}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            // Delay so click on a suggestion registers first.
                            setTimeout(() => setOpenSuggestIdx((cur) => (cur === i ? null : cur)), 150);
                            const upper = v.toUpperCase();
                            if (v && !rowStatus[i]?.verified && lastVerifiedSymbol[i] !== upper) {
                              verifyRow(i, v);
                            }
                          }}
                          placeholder="e.g. RELIANCE"
                          maxLength={20}
                          className={`font-mono uppercase ${rowStatus[i]?.error ? "border-chart-down" : ""}`}
                        />
                        {rowStatus[i]?.loading && (
                          <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                        {openSuggestIdx === i && row.symbol.trim() !== "" && (() => {
                          const suggestions = getSuggestions(row.symbol);
                          return (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                              {suggestions.length > 0 ? (
                                suggestions.map((s) => (
                                  <button
                                    key={s.symbol}
                                    type="button"
                                    onPointerDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      updateRow(i, { symbol: s.symbol });
                                      setOpenSuggestIdx(null);
                                      verifyRow(i, s.symbol);
                                    }}
                                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                                  >
                                    <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                                    <span className="truncate text-muted-foreground">{s.name}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-xs text-muted-foreground">No match</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={row.quantity}
                        onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.buyPrice}
                        onChange={(e) => updateRow(i, { buyPrice: Number(e.target.value) })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(i)}
                        aria-label="Remove holding"
                        className="h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4 text-chart-down" />
                      </Button>
                    </div>
                    {rowStatus[i]?.error && (
                      <p className="px-1 text-[11px] text-chart-down">{rowStatus[i]!.error}</p>
                    )}
                    {rowStatus[i]?.verified && (
                      <p className="px-1 text-[11px] text-chart-up">Verified on NSE</p>
                    )}
                  </div>
                ))}
                <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                  Enter any NSE symbol (e.g. IRCTC, ZOMATO). Symbols are verified live against the market.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {saveError && <p className="mr-auto text-xs text-chart-down">{saveError}</p>}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;