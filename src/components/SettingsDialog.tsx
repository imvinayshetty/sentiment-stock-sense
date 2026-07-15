import { useEffect, useState } from "react";
import { Plus, Trash2, Settings as SettingsIcon } from "lucide-react";
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
import { getStockDirectory } from "@/lib/stockData";

const DIRECTORY = getStockDirectory();

const SettingsDialog = () => {
  const { settings, save } = useUserSettings();
  const [open, setOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [rows, setRows] = useState<Holding[]>([]);

  useEffect(() => {
    if (!open) return;
    setBudgetInput(settings.budgetMax != null ? String(settings.budgetMax) : "");
    setRows(settings.holdings.length ? settings.holdings : []);
  }, [open, settings]);

  const addRow = () =>
    setRows((r) => [...r, { symbol: DIRECTORY[0]?.symbol ?? "", quantity: 1, buyPrice: 0 }]);

  const updateRow = (idx: number, patch: Partial<Holding>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const onSave = () => {
    const budgetNum = Number(budgetInput);
    const budgetMax =
      budgetInput.trim() && Number.isFinite(budgetNum) && budgetNum >= 1 ? budgetNum : null;
    const cleanHoldings = rows
      .map((h) => ({
        symbol: h.symbol.trim().toUpperCase(),
        quantity: Number(h.quantity),
        buyPrice: Number(h.buyPrice),
      }))
      .filter(
        (h) =>
          h.symbol &&
          Number.isFinite(h.quantity) &&
          h.quantity > 0 &&
          Number.isFinite(h.buyPrice) &&
          h.buyPrice >= 0,
      );
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
                <div className="grid grid-cols-[1fr_5rem_6rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <span>Symbol</span>
                  <span>Qty</span>
                  <span>Buy price</span>
                  <span />
                </div>
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5rem_6rem_2rem] gap-2">
                    <select
                      value={row.symbol}
                      onChange={(e) => updateRow(i, { symbol: e.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {DIRECTORY.map((d) => (
                        <option key={d.symbol} value={d.symbol}>
                          {d.symbol}
                        </option>
                      ))}
                    </select>
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
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;