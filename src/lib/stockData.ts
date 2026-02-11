// Mock stock data utilities
export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap: string;
  high: number;
  low: number;
  open: number;
}

export interface PredictionData {
  date: string;
  actual?: number;
  arima: number;
  lstm: number;
  linearReg: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "positive" | "negative" | "neutral";
  summary: string;
}

const STOCKS: StockQuote[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: 227.63, change: 3.42, changePercent: 1.53, volume: "62.3M", marketCap: "3.48T", high: 228.50, low: 223.10, open: 224.20 },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: 191.24, change: -1.87, changePercent: -0.97, volume: "28.1M", marketCap: "2.36T", high: 193.50, low: 190.10, open: 193.00 },
  { symbol: "MSFT", name: "Microsoft Corp.", price: 432.15, change: 5.67, changePercent: 1.33, volume: "22.5M", marketCap: "3.21T", high: 433.90, low: 426.50, open: 427.00 },
  { symbol: "AMZN", name: "Amazon.com Inc.", price: 228.93, change: 2.11, changePercent: 0.93, volume: "45.8M", marketCap: "2.41T", high: 230.00, low: 226.50, open: 227.00 },
  { symbol: "TSLA", name: "Tesla Inc.", price: 394.94, change: -8.32, changePercent: -2.06, volume: "98.2M", marketCap: "1.27T", high: 405.00, low: 392.10, open: 403.00 },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 131.28, change: 4.56, changePercent: 3.60, volume: "312.5M", marketCap: "3.22T", high: 132.50, low: 126.70, open: 127.00 },
  { symbol: "META", name: "Meta Platforms", price: 719.93, change: 12.45, changePercent: 1.76, volume: "18.3M", marketCap: "1.83T", high: 722.00, low: 707.50, open: 708.00 },
  { symbol: "NFLX", name: "Netflix Inc.", price: 1032.79, change: -15.23, changePercent: -1.45, volume: "5.6M", marketCap: "445B", high: 1050.00, low: 1028.00, open: 1048.00 },
];

export function getStocks(): StockQuote[] {
  return STOCKS;
}

export function getStock(symbol: string): StockQuote | undefined {
  return STOCKS.find((s) => s.symbol === symbol.toUpperCase());
}

export function generatePredictions(symbol: string): PredictionData[] {
  const stock = getStock(symbol);
  if (!stock) return [];
  const base = stock.price;
  const data: PredictionData[] = [];
  const today = new Date();

  // Past 7 days with actual data
  for (let i = -7; i <= 0; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const noise = () => (Math.random() - 0.5) * base * 0.03;
    const actual = base + noise() * 2;
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      actual: +actual.toFixed(2),
      arima: +(actual + noise()).toFixed(2),
      lstm: +(actual + noise()).toFixed(2),
      linearReg: +(actual + noise()).toFixed(2),
    });
  }

  // Future 7 days predictions only
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const trend = (Math.random() - 0.45) * base * 0.01 * i;
    const noise = () => (Math.random() - 0.5) * base * 0.02;
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      arima: +(base + trend + noise()).toFixed(2),
      lstm: +(base + trend * 1.1 + noise()).toFixed(2),
      linearReg: +(base + trend * 0.8 + noise()).toFixed(2),
    });
  }

  return data;
}

export function getNews(symbol?: string): NewsItem[] {
  const allNews: NewsItem[] = [
    { id: "1", title: "AI Spending Surge Drives Tech Rally to New Heights", source: "Reuters", time: "2h ago", sentiment: "positive", summary: "Major tech companies report increased AI infrastructure spending, boosting investor confidence." },
    { id: "2", title: "Federal Reserve Signals Potential Rate Cut in March", source: "Bloomberg", time: "4h ago", sentiment: "positive", summary: "Fed officials hint at easing monetary policy amid cooling inflation data." },
    { id: "3", title: "Semiconductor Shortage Concerns Resurface", source: "CNBC", time: "5h ago", sentiment: "negative", summary: "Supply chain disruptions in Asia raise concerns about chip availability for Q2." },
    { id: "4", title: "Electric Vehicle Sales Growth Slows in Europe", source: "Financial Times", time: "6h ago", sentiment: "negative", summary: "EV adoption rates plateau in key European markets as subsidies expire." },
    { id: "5", title: "Crypto Market Shows Signs of Institutional Adoption", source: "CoinDesk", time: "8h ago", sentiment: "neutral", summary: "Major banks announce plans to offer cryptocurrency custody services." },
    { id: "6", title: "Cloud Computing Revenue Exceeds Expectations", source: "TechCrunch", time: "10h ago", sentiment: "positive", summary: "Enterprise cloud spending continues to grow as businesses accelerate digital transformation." },
  ];
  return allNews;
}

export function getSentimentScore(symbol: string): { score: number; label: string; tweets: number } {
  const scores: Record<string, { score: number; label: string; tweets: number }> = {
    AAPL: { score: 72, label: "Bullish", tweets: 14523 },
    GOOGL: { score: 45, label: "Neutral", tweets: 8921 },
    MSFT: { score: 68, label: "Bullish", tweets: 11203 },
    AMZN: { score: 61, label: "Slightly Bullish", tweets: 9872 },
    TSLA: { score: 35, label: "Bearish", tweets: 32451 },
    NVDA: { score: 85, label: "Very Bullish", tweets: 28764 },
    META: { score: 58, label: "Neutral", tweets: 7632 },
    NFLX: { score: 42, label: "Neutral", tweets: 5421 },
  };
  return scores[symbol] || { score: 50, label: "Neutral", tweets: 0 };
}
