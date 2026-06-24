// Stock data utilities - Indian market (NSE)
export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap?: string;
  high: number;
  low: number;
  open: number;
  close?: number;
  exchange?: string;
}

export interface StockDirectoryEntry {
  symbol: string;
  name: string;
}

export interface PredictionData {
  date: string;
  actual?: number;
  arima?: number;
  lstm?: number;
  linearReg?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "positive" | "negative" | "neutral";
  summary: string;
}

// Fallback mock data for Indian stocks
const STOCKS: StockQuote[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", price: 1285.40, change: 12.35, changePercent: 0.97, volume: "18.2M", high: 1292.00, low: 1270.50, open: 1273.00 },
  { symbol: "TCS", name: "Tata Consultancy Services", price: 3842.15, change: -28.60, changePercent: -0.74, volume: "4.1M", high: 3875.00, low: 3830.00, open: 3870.00 },
  { symbol: "INFY", name: "Infosys Ltd.", price: 1578.90, change: 15.45, changePercent: 0.99, volume: "12.5M", high: 1585.00, low: 1560.00, open: 1563.00 },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", price: 1642.30, change: -8.20, changePercent: -0.50, volume: "8.7M", high: 1655.00, low: 1635.00, open: 1650.00 },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", price: 1245.75, change: 18.90, changePercent: 1.54, volume: "14.3M", high: 1250.00, low: 1225.00, open: 1227.00 },
  { symbol: "WIPRO", name: "Wipro Ltd.", price: 295.60, change: 3.15, changePercent: 1.08, volume: "22.8M", high: 298.00, low: 291.00, open: 292.50 },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.", price: 742.80, change: -15.40, changePercent: -2.03, volume: "32.1M", high: 760.00, low: 738.00, open: 758.00 },
  { symbol: "SBIN", name: "State Bank of India", price: 812.45, change: 6.30, changePercent: 0.78, volume: "28.5M", high: 818.00, low: 805.00, open: 806.00 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd.", price: 7245.00, change: 85.50, changePercent: 1.19, volume: "3.2M", high: 7280.00, low: 7150.00, open: 7160.00 },
  { symbol: "ITC", name: "ITC Ltd.", price: 438.20, change: -2.80, changePercent: -0.63, volume: "16.4M", high: 442.00, low: 435.00, open: 441.00 },
];

export function getStocks(): StockQuote[] {
  return STOCKS;
}

// Full NSE universe known to the backend (kept in sync with edge function STOCK_TOKENS).
// Used so search works even when live quotes haven't populated yet.
const STOCK_DIRECTORY: { symbol: string; name: string }[] = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "INFY", name: "Infosys Ltd." },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd." },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd." },
  { symbol: "WIPRO", name: "Wipro Ltd." },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd." },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd." },
  { symbol: "ITC", name: "ITC Ltd." },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd." },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" },
  { symbol: "LT", name: "Larsen & Toubro" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd." },
  { symbol: "MARUTI", name: "Maruti Suzuki India" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd." },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical" },
  { symbol: "TITAN", name: "Titan Company Ltd." },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement" },
  { symbol: "NESTLEIND", name: "Nestle India Ltd." },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd." },
  { symbol: "HCLTECH", name: "HCL Technologies" },
  { symbol: "TECHM", name: "Tech Mahindra Ltd." },
  { symbol: "POWERGRID", name: "Power Grid Corp." },
  { symbol: "NTPC", name: "NTPC Ltd." },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp." },
  { symbol: "COALINDIA", name: "Coal India Ltd." },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd." },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd." },
  { symbol: "HINDALCO", name: "Hindalco Industries" },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd." },
  { symbol: "DRREDDY", name: "Dr. Reddy's Labs" },
  { symbol: "CIPLA", name: "Cipla Ltd." },
  { symbol: "DIVISLAB", name: "Divi's Laboratories" },
  { symbol: "GRASIM", name: "Grasim Industries" },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd." },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd." },
  { symbol: "M_M", name: "Mahindra & Mahindra" },
  { symbol: "BRITANNIA", name: "Britannia Industries" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd." },
  { symbol: "TATACONSUM", name: "Tata Consumer Products" },
  { symbol: "UPL", name: "UPL Ltd." },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals" },
  { symbol: "BPCL", name: "Bharat Petroleum" },
];

export function getStockDirectory(): StockDirectoryEntry[] {
  return STOCK_DIRECTORY;
}

export function getStockMeta(symbol: string): StockDirectoryEntry | undefined {
  const sym = symbol.toUpperCase();
  return STOCK_DIRECTORY.find((stock) => stock.symbol === sym);
}

export function getStock(symbol: string): StockQuote | undefined {
  const sym = symbol.toUpperCase();
  const real = STOCKS.find((s) => s.symbol === sym);
  if (real) return real;
  const entry = STOCK_DIRECTORY.find((s) => s.symbol === sym);
  if (entry) return synthesizeQuote(entry.symbol, entry.name);
  return undefined;
}

// Simple deterministic hash → seeded pseudo-random in [0, 1)
function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}
function seededRand(seed: number, salt: number): number {
  const x = Math.sin(seed * 1000 + salt * 7919) * 10000;
  return x - Math.floor(x);
}

function synthesizeQuote(symbol: string, name: string): StockQuote {
  const h = hashSymbol(symbol);
  const price = +(150 + h * 4850).toFixed(2); // ₹150 – ₹5000
  const changePercent = +(((seededRand(h, 1) - 0.5) * 4)).toFixed(2); // -2% .. +2%
  const change = +((price * changePercent) / 100).toFixed(2);
  const open = +(price - change * seededRand(h, 2)).toFixed(2);
  const high = +Math.max(price, open, price * (1 + seededRand(h, 3) * 0.015)).toFixed(2);
  const low = +Math.min(price, open, price * (1 - seededRand(h, 4) * 0.015)).toFixed(2);
  const volM = +(1 + seededRand(h, 5) * 30).toFixed(1);
  return {
    symbol,
    name,
    price,
    change,
    changePercent,
    volume: `${volM}M`,
    high,
    low,
    open,
  };
}
