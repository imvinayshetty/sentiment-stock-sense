# Real market pricing for trading and baskets

## Changes
- Keep Demo Trading as paper trading, but execute and value orders only from verified live Angel One NSE quotes while the market is open; when closed, show the latest official close and pause order execution and automation.
- Feed today’s basket with real Angel One prices during the session, so stock performance, basket return, and profit figures update instead of waiting for the closing snapshot.
- Use real NIFTY 50 market data for the same trading day in Basket vs Market, while retaining official historical closing figures for completed days.
- Clearly label live versus last-close figures and refresh the basket alongside the existing quote refresh cycle.
- Remove the Market News section and stop its page-level data request.

## Technical details
- Extend the market-data function to return an explicit verified source and current basket prices without overwriting stored opening or final closing snapshots.
- Calculate in-session basket and benchmark returns from current market prices; after market close, continue using persisted official close values.
- Prevent paper BUY/SELL and automatic triggers from using last-close or unavailable prices.

## Validation
- Verify live quote source, paper trade safeguards, today’s basket values, Basket vs Market figures, refresh behavior, and removal of Market News on desktop and iPhone-sized screens.
