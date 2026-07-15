## Goal

Let users search and add **any NSE-listed stock symbol** — not just the ~46 curated in `STOCK_TOKENS` / `STOCK_DIRECTORY`. Verification happens live against Yahoo Finance (`SYMBOL.NS`); unverified symbols are rejected with a clear message.

## Behavior

- **Main search bar**: after filtering the curated list, if the user's query has no match, show a "Try `<QUERY>` as a live NSE symbol" row. Clicking it verifies live and selects the symbol on success.
- **Portfolio holdings**: replace the fixed-list `<select>` with a free-form uppercase text input (plus quantity + buy price). Symbol is verified on add; invalid symbols show an inline error and cannot be saved.
- **Curated list stays curated**: Top-10-to-Buy / Sell rankings, ticker bar, and `useStockQuotes` still use the 46-stock universe (they depend on the batched quotes endpoint and Angel One tokens). Only per-symbol detail views (chart, forecast, sentiment, price target, backtest) become open-universe.

## Backend changes — `supabase/functions/angel-one-data/index.ts`

1. Add a helper `resolveSymbolInfo(symbol)` that returns `{ name, yahooSymbol }`:
   - If `STOCK_TOKENS[symbol]` exists, return it.
   - Otherwise return `{ name: symbol, yahooSymbol: \`${symbol}.NS\` }`.
2. `historical` and `forecast` actions: replace `STOCK_TOKENS[symbol]` guard with `resolveSymbolInfo(symbol)`. Keep the existing "no data returned" error path so junk symbols still fail cleanly with a 4xx.
3. New action `resolve`: given `symbol`, run a lightweight `fetchChart(\`${symbol}.NS\`, "5d", "1d")`; on success return `{ success: true, symbol, name: symbol, price: <lastClose>, exchange: "NSE" }`; on failure return `{ success: false, error: "Symbol not found on NSE" }` with status 404.
4. Input validation: uppercase, `^[A-Z0-9&_\-]{1,20}$` regex; reject otherwise.

## Frontend changes

- **`src/lib/stockData.ts`**: make `getStockMeta` return `{ symbol, name: symbol }` fallback for unknown symbols so `StockDetail` renders cleanly.
- **`src/hooks/useAngelOneData.ts`**: add `useResolveSymbol(symbol)` — React Query mutation/lazy query that hits the new `resolve` action; used for validation.
- **`src/components/StockSearch.tsx`**:
  - When `filtered.length === 0` and `q.length >= 1`, render an extra "Search live NSE: `<QUERY>`" row.
  - On click, call `resolve`. On success, call `onSelect(symbol)` and remember the symbol in `lastExplicitRef`. On failure, show inline error under the input.
- **`src/components/SettingsDialog.tsx`**:
  - Swap the holdings `<select>` for an `<Input>` (uppercase, maxLength 20). Add a small "Verify" pass on `addRow` / row change: call `resolve`; block save with a red hint if invalid.
  - Row grid stays the same responsive layout.
- **`src/components/HoldingsSellPanel.tsx`**: already keys off `symbol`; no change needed, but confirm it tolerates missing live-quote entries by degrading to forecast-only (existing null-safety already covers this — verify during implementation).

## Validation & UX

- Client-side: uppercase, trim, regex `^[A-Z0-9&_\-]{1,20}$`.
- Server-side: same regex, plus reject if Yahoo returns empty result.
- Errors surfaced inline; no toasts for common "not found" case.

## Out of scope

- Adding new symbols to the ticker bar / Top 10 lists (would require expanding `ANGEL_TOKENS` and re-batching quotes).
- Angel One live intraday prices for free-form symbols (they'll use Yahoo daily close via existing `fetchChart`, same as after-hours behavior for curated symbols).

## Files touched

- `supabase/functions/angel-one-data/index.ts`
- `src/lib/stockData.ts`
- `src/hooks/useAngelOneData.ts`
- `src/components/StockSearch.tsx`
- `src/components/SettingsDialog.tsx`
