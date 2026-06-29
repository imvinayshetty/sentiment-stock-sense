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
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  forecast?: number;
  upper?: number;
  lower?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "positive" | "negative" | "neutral";
  summary: string;
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
