import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOCK_TOKENS: Record<string, { name: string; yahooSymbol: string }> = {
  RELIANCE: { name: "Reliance Industries", yahooSymbol: "RELIANCE.NS" },
  TCS: { name: "Tata Consultancy Services", yahooSymbol: "TCS.NS" },
  INFY: { name: "Infosys Ltd.", yahooSymbol: "INFY.NS" },
  HDFCBANK: { name: "HDFC Bank Ltd.", yahooSymbol: "HDFCBANK.NS" },
  ICICIBANK: { name: "ICICI Bank Ltd.", yahooSymbol: "ICICIBANK.NS" },
  WIPRO: { name: "Wipro Ltd.", yahooSymbol: "WIPRO.NS" },
  TATAMOTORS: { name: "Tata Motors Ltd.", yahooSymbol: "TATAMOTOR.NS" },
  SBIN: { name: "State Bank of India", yahooSymbol: "SBIN.NS" },
  BAJFINANCE: { name: "Bajaj Finance Ltd.", yahooSymbol: "BAJFINANCE.NS" },
  ITC: { name: "ITC Ltd.", yahooSymbol: "ITC.NS" },
  HINDUNILVR: { name: "Hindustan Unilever Ltd.", yahooSymbol: "HINDUNILVR.NS" },
  KOTAKBANK: { name: "Kotak Mahindra Bank", yahooSymbol: "KOTAKBANK.NS" },
  LT: { name: "Larsen & Toubro", yahooSymbol: "LT.NS" },
  AXISBANK: { name: "Axis Bank Ltd.", yahooSymbol: "AXISBANK.NS" },
  MARUTI: { name: "Maruti Suzuki India", yahooSymbol: "MARUTI.NS" },
  ASIANPAINT: { name: "Asian Paints Ltd.", yahooSymbol: "ASIANPAINT.NS" },
  SUNPHARMA: { name: "Sun Pharmaceutical", yahooSymbol: "SUNPHARMA.NS" },
  TITAN: { name: "Titan Company Ltd.", yahooSymbol: "TITAN.NS" },
  ULTRACEMCO: { name: "UltraTech Cement", yahooSymbol: "ULTRACEMCO.NS" },
  NESTLEIND: { name: "Nestle India Ltd.", yahooSymbol: "NESTLEIND.NS" },
  BHARTIARTL: { name: "Bharti Airtel Ltd.", yahooSymbol: "BHARTIARTL.NS" },
  HCLTECH: { name: "HCL Technologies", yahooSymbol: "HCLTECH.NS" },
  TECHM: { name: "Tech Mahindra Ltd.", yahooSymbol: "TECHM.NS" },
  POWERGRID: { name: "Power Grid Corp.", yahooSymbol: "POWERGRID.NS" },
  NTPC: { name: "NTPC Ltd.", yahooSymbol: "NTPC.NS" },
  ONGC: { name: "Oil & Natural Gas Corp.", yahooSymbol: "ONGC.NS" },
  COALINDIA: { name: "Coal India Ltd.", yahooSymbol: "COALINDIA.NS" },
  JSWSTEEL: { name: "JSW Steel Ltd.", yahooSymbol: "JSWSTEEL.NS" },
  TATASTEEL: { name: "Tata Steel Ltd.", yahooSymbol: "TATASTEEL.NS" },
  HINDALCO: { name: "Hindalco Industries", yahooSymbol: "HINDALCO.NS" },
  ADANIPORTS: { name: "Adani Ports & SEZ", yahooSymbol: "ADANIPORTS.NS" },
  BAJAJFINSV: { name: "Bajaj Finserv Ltd.", yahooSymbol: "BAJAJFINSV.NS" },
  DRREDDY: { name: "Dr. Reddy's Labs", yahooSymbol: "DRREDDY.NS" },
  CIPLA: { name: "Cipla Ltd.", yahooSymbol: "CIPLA.NS" },
  DIVISLAB: { name: "Divi's Laboratories", yahooSymbol: "DIVISLAB.NS" },
  GRASIM: { name: "Grasim Industries", yahooSymbol: "GRASIM.NS" },
  EICHERMOT: { name: "Eicher Motors Ltd.", yahooSymbol: "EICHERMOT.NS" },
  HEROMOTOCO: { name: "Hero MotoCorp Ltd.", yahooSymbol: "HEROMOTOCO.NS" },
  M_M: { name: "Mahindra & Mahindra", yahooSymbol: "M&M.NS" },
  BRITANNIA: { name: "Britannia Industries", yahooSymbol: "BRITANNIA.NS" },
  INDUSINDBK: { name: "IndusInd Bank Ltd.", yahooSymbol: "INDUSINDBK.NS" },
  TATACONSUM: { name: "Tata Consumer Products", yahooSymbol: "TATACONSUM.NS" },
  UPL: { name: "UPL Ltd.", yahooSymbol: "UPL.NS" },
  APOLLOHOSP: { name: "Apollo Hospitals", yahooSymbol: "APOLLOHOSP.NS" },
  BPCL: { name: "Bharat Petroleum", yahooSymbol: "BPCL.NS" },
};

// Angel One SmartAPI NSE equity instrument tokens (used for live quotes during market hours).
const ANGEL_TOKENS: Record<string, string> = {
  RELIANCE: "2885", TCS: "11536", INFY: "1594", HDFCBANK: "1333", ICICIBANK: "4963",
  WIPRO: "3787", TATAMOTORS: "3456", SBIN: "3045", BAJFINANCE: "317", ITC: "1660",
  HINDUNILVR: "1394", KOTAKBANK: "1922", LT: "11483", AXISBANK: "5900", MARUTI: "10999",
  ASIANPAINT: "236", SUNPHARMA: "3351", TITAN: "3506", ULTRACEMCO: "11532", NESTLEIND: "17963",
  BHARTIARTL: "10604", HCLTECH: "7229", TECHM: "13538", POWERGRID: "14977", NTPC: "11630",
  ONGC: "2475", COALINDIA: "20374", JSWSTEEL: "11723", TATASTEEL: "3499", HINDALCO: "1363",
  ADANIPORTS: "15083", BAJAJFINSV: "16675", DRREDDY: "881", CIPLA: "694", DIVISLAB: "10940",
  GRASIM: "1232", EICHERMOT: "910", HEROMOTOCO: "1348", M_M: "2031", BRITANNIA: "547",
  INDUSINDBK: "5258", TATACONSUM: "3432", UPL: "11287", APOLLOHOSP: "157", BPCL: "526",
};
const TOKEN_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(ANGEL_TOKENS).map(([sym, tok]) => [tok, sym]),
);

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ---------- Angel One SmartAPI (live quotes) ----------
function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = "";
  for (const c of clean) {
    const val = alphabet.indexOf(c);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}

async function generateTotp(secret: string): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));
  const offset = sig[sig.length - 1] & 0xf;
  const code = ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

function angelHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json", "Accept": "application/json",
    "X-UserType": "USER", "X-SourceID": "WEB", "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1", "X-MACAddress": "00:00:00:00:00:00", "X-PrivateKey": apiKey,
  };
}

async function angelLogin(): Promise<string> {
  const apiKey = Deno.env.get("ANGEL_ONE_API_KEY");
  const clientId = Deno.env.get("ANGEL_ONE_CLIENT_ID");
  const mpin = Deno.env.get("ANGEL_ONE_PASSWORD");
  const totpSecret = Deno.env.get("ANGEL_ONE_TOTP_SECRET");
  if (!apiKey || !clientId || !mpin || !totpSecret) throw new Error("Angel One credentials missing");

  const otp = await generateTotp(totpSecret);
  const loginRes = await fetch(
    "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
    { method: "POST", headers: angelHeaders(apiKey), body: JSON.stringify({ clientcode: clientId, password: mpin, totp: otp }) },
  );
  const loginData = await loginRes.json().catch(() => null);
  const jwt = loginData?.data?.jwtToken;
  if (!jwt) throw new Error(`Angel One login failed: ${JSON.stringify(loginData?.message ?? loginData)}`);
  return jwt;
}

// Reuse a cached JWT (6h TTL) instead of re-authenticating on every quote refresh.
async function getAngelJwt(supabase: any, forceNew = false): Promise<string> {
  if (!forceNew) {
    try {
      const { data } = await supabase
        .from("angel_session").select("jwt,expires_at").eq("id", "singleton").maybeSingle();
      if (data?.jwt && new Date(data.expires_at).getTime() > Date.now() + 60_000) return data.jwt;
    } catch (_) { /* fall through to fresh login */ }
  }
  const jwt = await angelLogin();
  try {
    await supabase.from("angel_session").upsert({
      id: "singleton",
      jwt,
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("angel_session cache write failed:", e);
  }
  return jwt;
}

async function fetchAngelQuotes(supabase: any) {
  const apiKey = Deno.env.get("ANGEL_ONE_API_KEY");
  if (!apiKey) throw new Error("Angel One credentials missing");

  const body = JSON.stringify({ mode: "FULL", exchangeTokens: { NSE: Object.values(ANGEL_TOKENS) } });
  const doQuote = (jwt: string) => fetch(
    "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/",
    { method: "POST", headers: { ...angelHeaders(apiKey), Authorization: `Bearer ${jwt}` }, body },
  );

  let jwt = await getAngelJwt(supabase);
  let quoteRes = await doQuote(jwt);
  let quoteData = await quoteRes.json().catch(() => null);
  let fetched: any[] = quoteData?.data?.fetched ?? [];

  // If the cached token was rejected, re-login once and retry.
  if (!fetched.length && (quoteRes.status === 401 || /token|invalid|expired|unauthor/i.test(JSON.stringify(quoteData?.message ?? "")))) {
    jwt = await getAngelJwt(supabase, true);
    quoteRes = await doQuote(jwt);
    quoteData = await quoteRes.json().catch(() => null);
    fetched = quoteData?.data?.fetched ?? [];
  }
  if (!fetched.length) throw new Error(`Angel One quote empty: ${JSON.stringify(quoteData?.message ?? quoteData)}`);

  return fetched.map((f) => {
    const symbol = TOKEN_TO_SYMBOL[String(f.symbolToken)];
    const info = STOCK_TOKENS[symbol];
    if (!symbol || !info) return null;
    const price = Number(f.ltp ?? 0);
    const prevClose = Number(f.close ?? price);
    if (!price) return null;
    const change = Number((price - prevClose).toFixed(2));
    const changePercent = Number((prevClose ? (change / prevClose) * 100 : 0).toFixed(2));
    return {
      symbol,
      name: info.name,
      price: Number(price.toFixed(2)),
      change,
      changePercent,
      volume: formatVolume(Number(f.tradeVolume ?? 0)),
      high: Number(Number(f.high ?? price).toFixed(2)),
      low: Number(Number(f.low ?? price).toFixed(2)),
      open: Number(Number(f.open ?? prevClose).toFixed(2)),
      close: Number(prevClose.toFixed(2)),
      exchange: "NSE",
      marketTime: Math.floor(Date.now() / 1000),
    };
  }).filter((q): q is NonNullable<typeof q> => Boolean(q) && q.price > 0);
}

// ---------- Forecast (SES + linear regression) ----------
function linearRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (y[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den ? num / den : 0;
  return { slope, intercept: yMean - slope * xMean };
}

// ---------- Technical indicators (RSI, MACD) ----------
function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let e = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    e = i === 0 ? values[0] : values[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeMACD(closes: number[]): { macd: number; signal: number; hist: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, hist: 0 };
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalSeries = emaSeries(macdLine.slice(25), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { macd, signal, hist: macd - signal };
}

// NSE trading holidays (full-day closures) for 2025–2026. Filtered out of forecast dates.
const NSE_HOLIDAYS = new Set<string>([
  // 2025
  "2025-02-26", "2025-03-14", "2025-03-31", "2025-04-10", "2025-04-14",
  "2025-04-18", "2025-05-01", "2025-08-15", "2025-08-27", "2025-10-02",
  "2025-10-21", "2025-10-22", "2025-11-05", "2025-12-25",
  // 2026
  "2026-01-26", "2026-02-15", "2026-03-04", "2026-03-21", "2026-04-01",
  "2026-04-03", "2026-04-14", "2026-05-01", "2026-08-15", "2026-10-02",
  "2026-10-20", "2026-11-09", "2026-12-25",
]);

function computeForecast(closes: number[]) {
  if (closes.length < 5) return null;
  const window = closes.slice(-30);
  const n = window.length;

  // Simple Exponential Smoothing
  let s = window[0];
  for (const c of window) s = 0.3 * c + 0.7 * s;

  // Linear regression trend
  const { slope, intercept } = linearRegression(window);

  // Daily log-return volatility
  const rets: number[] = [];
  for (let i = 1; i < window.length; i++) if (window[i - 1] > 0) rets.push(Math.log(window[i] / window[i - 1]));
  const rMean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sigma = Math.sqrt(rets.reduce((a, b) => a + (b - rMean) ** 2, 0) / (rets.length || 1)) || 0.015;

  // Technical-indicator directional bias, blended into the forecast drift.
  const rsi = computeRSI(closes, 14);
  const macd = computeMACD(closes);
  const lastPrice = window[n - 1];
  const rsiBias = Math.max(-1, Math.min(1, (rsi - 50) / 50));          // overbought>0, oversold<0
  const macdBias = Math.max(-1, Math.min(1, (macd.hist / (lastPrice || 1)) * 200)); // normalized histogram
  const momentum = Math.max(-1, Math.min(1, 0.5 * rsiBias + 0.5 * macdBias)); // -1..1

  // Build 7 trading days, skipping weekends (NSE closed Sat/Sun).
  const out = [];
  const d = new Date();
  let tradingDay = 0;
  while (out.length < 7) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip Sun/Sat
    if (NSE_HOLIDAYS.has(d.toISOString().slice(0, 10))) continue; // skip NSE holidays
    tradingDay++;
    const linPred = intercept + slope * (n - 1 + tradingDay);
    // Base SES/LR forecast nudged by indicator momentum (max ~0.1%/day).
    const forecast = (0.6 * linPred + 0.4 * s) * (1 + momentum * 0.001 * tradingDay);
    const band = forecast * sigma * Math.sqrt(tradingDay);
    out.push({
      date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      isoDate: d.toISOString().slice(0, 10),
      forecast: Number(forecast.toFixed(2)),
      lower: Number((forecast - band).toFixed(2)),
      upper: Number((forecast + band).toFixed(2)),
    });
  }
  return {
    lastPrice,
    sigma,
    indicators: {
      rsi: Number(rsi.toFixed(1)),
      macd: Number(macd.macd.toFixed(2)),
      macdSignal: Number(macd.signal.toFixed(2)),
      momentum: Number(momentum.toFixed(3)),
    },
    forecast: out,
  };
}

function isoToCloseMap(candles: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of candles) map[String(c[0]).slice(0, 10)] = Number(c[4]);
  return map;
}

async function reconcileBacktest(supabase: any, symbol: string, candles: any[]) {
  const closeByDate = isoToCloseMap(candles);
  const isoDates = Object.keys(closeByDate).sort();
  const { data: pending } = await supabase
    .from("prediction_log").select("*").eq("symbol", symbol).is("actual_price", null);
  if (!pending?.length) return;
  for (const row of pending) {
    // Find the first available close strictly after the horizon date so an
    // in-progress horizon day is never reconciled before its market close.
    const target = isoDates.find((d) => d > row.horizon_date);
    if (!target) continue;
    const actual = closeByDate[target];
    const wentUp = actual > Number(row.base_price);
    const correct = (row.direction === "up") === wentUp;
    await supabase.from("prediction_log")
      .update({ actual_price: actual, correct }).eq("id", row.id);
  }
}

function getMarketStatus(timestampSeconds?: number): { status: "OPEN" | "CLOSED"; istTime: string } {
  const now = timestampSeconds ? new Date(timestampSeconds * 1000) : new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const open = isWeekday && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;

  return {
    status: open ? "OPEN" : "CLOSED",
    istTime: `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")} IST`,
  };
}

function formatVolume(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return "N/A";
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)}Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)}L`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

async function fetchChart(symbol: string, range = "5d", interval = "1d") {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Market data request failed for ${symbol} (${response.status})`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No market data returned for ${symbol}`);
  }

  return result;
}

function mapQuote(symbol: string, info: { name: string; yahooSymbol: string }, result: any) {
  const meta = result.meta ?? {};
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes = (quote.close ?? []).filter((value: number | null) => typeof value === "number");
  const previousClose = Number(meta.chartPreviousClose ?? closes.at(-2) ?? meta.regularMarketPrice ?? 0);
  const price = Number(meta.regularMarketPrice ?? closes.at(-1) ?? previousClose ?? 0);

  if (!price || meta.instrumentType === "MUTUALFUND" || String(meta.shortName ?? "").startsWith("** SEE<")) {
    return null;
  }

  const open = Number(meta.regularMarketOpen ?? quote.open?.at(-1) ?? previousClose ?? price);
  const high = Number(meta.regularMarketDayHigh ?? quote.high?.at(-1) ?? price);
  const low = Number(meta.regularMarketDayLow ?? quote.low?.at(-1) ?? price);
  const volume = Number(meta.regularMarketVolume ?? quote.volume?.at(-1) ?? 0);
  const change = Number((price - previousClose).toFixed(2));
  const changePercent = Number((previousClose ? (change / previousClose) * 100 : 0).toFixed(2));

  return {
    symbol,
    name: meta.longName || meta.shortName || info.name,
    price: Number(price.toFixed(2)),
    change,
    changePercent,
    volume: formatVolume(volume),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    open: Number(open.toFixed(2)),
    close: Number(previousClose.toFixed(2)),
    exchange: "NSE",
    marketTime: meta.regularMarketTime,
  };
}

function mapHistorical(result: any) {
  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  return timestamps
    .map((timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      const volume = quote.volume?.[index];

      if ([open, high, low, close].some((value) => typeof value !== "number" || Number.isNaN(value))) {
        return null;
      }

      return [
        new Date(timestamp * 1000).toISOString(),
        Number(open.toFixed(2)),
        Number(high.toFixed(2)),
        Number(low.toFixed(2)),
        Number(close.toFixed(2)),
        typeof volume === "number" ? volume : 0,
      ];
    })
    .filter(Boolean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "quotes";
    const symbol = url.searchParams.get("symbol")?.toUpperCase();

    if (action === "quotes") {
      const market = getMarketStatus();
      let data: any[] = [];

      // During market hours, prefer Angel One live quotes; fall back to Yahoo on any failure.
      if (market.status === "OPEN") {
        try {
          data = await fetchAngelQuotes(getSupabase());
        } catch (error) {
          console.error("Angel One quotes failed, falling back to Yahoo:", error);
          data = [];
        }
      }

      if (!data.length) {
        const entries = Object.entries(STOCK_TOKENS);
        const results = await Promise.all(
        entries.map(async ([stockSymbol, info]) => {
          try {
            const chart = await fetchChart(info.yahooSymbol, "5d", "1d");
            return mapQuote(stockSymbol, info, chart);
          } catch (error) {
            console.error(`Quote fetch failed for ${stockSymbol}:`, error);
            return null;
          }
        }),
        );
        data = results.filter((item): item is NonNullable<typeof item> => Boolean(item) && item.price > 0);
      }

      const mostRecentTime = data.reduce<number | undefined>((latest, item: any) => {
        if (!item?.marketTime) return latest;
        return latest ? Math.max(latest, item.marketTime) : item.marketTime;
      }, undefined);
      const istTime = mostRecentTime ? getMarketStatus(mostRecentTime).istTime : market.istTime;

      return new Response(JSON.stringify({
        success: true,
        data,
        marketStatus: market.status,
        istTime,
        source: market.status === "OPEN" ? "live" : "last-close",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "historical" && symbol) {
      const stockInfo = STOCK_TOKENS[symbol];
      if (!stockInfo) {
        return new Response(JSON.stringify({ success: false, error: "Unknown symbol" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chart = await fetchChart(stockInfo.yahooSymbol, "1mo", "1d");
      return new Response(JSON.stringify({ success: true, data: mapHistorical(chart) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "forecast" && symbol) {
      const stockInfo = STOCK_TOKENS[symbol];
      if (!stockInfo) {
        return new Response(JSON.stringify({ success: false, error: "Unknown symbol" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const chart = await fetchChart(stockInfo.yahooSymbol, "3mo", "1d");
      const candles = mapHistorical(chart);
      const closes = candles.map((c: any[]) => Number(c[4])).filter((v) => !Number.isNaN(v));
      const result = computeForecast(closes);
      if (!result) {
        return new Response(JSON.stringify({ success: false, error: "Not enough data" }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log this prediction and reconcile past predictions for backtesting.
      try {
        const supabase = getSupabase();
        const day7 = result.forecast[result.forecast.length - 1];
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from("prediction_log").upsert({
          symbol,
          predicted_at: today,
          horizon_date: day7.isoDate,
          base_price: result.lastPrice,
          predicted_price: day7.forecast,
          direction: day7.forecast >= result.lastPrice ? "up" : "down",
          lower_bound: day7.lower,
          upper_bound: day7.upper,
          sigma: result.sigma,
        }, { onConflict: "symbol,predicted_at,horizon_date", ignoreDuplicates: true });
        await reconcileBacktest(supabase, symbol, candles);
      } catch (e) {
        console.error("Prediction logging failed:", e);
      }

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "backtest") {
      const supabase = getSupabase();
      let query = supabase.from("prediction_log").select("*").not("correct", "is", null);
      if (symbol) query = query.eq("symbol", symbol);
      const { data: rows } = await query;
      const evaluated = rows ?? [];
      const correct = evaluated.filter((r: any) => r.correct).length;
      const accuracy = evaluated.length ? Math.round((correct / evaluated.length) * 100) : null;

      // Mean Absolute Error and % of actuals that landed within the ±1σ band.
      let absErrSum = 0, pctErrSum = 0, errCount = 0;
      let withinBand = 0, bandCount = 0;
      for (const r of evaluated) {
        if (r.actual_price != null) {
          const err = Math.abs(Number(r.predicted_price) - Number(r.actual_price));
          absErrSum += err;
          if (Number(r.actual_price) > 0) pctErrSum += (err / Number(r.actual_price)) * 100;
          errCount++;
          if (r.lower_bound != null && r.upper_bound != null) {
            bandCount++;
            if (Number(r.actual_price) >= Number(r.lower_bound) && Number(r.actual_price) <= Number(r.upper_bound)) {
              withinBand++;
            }
          }
        }
      }
      const mae = errCount ? Number((absErrSum / errCount).toFixed(2)) : null;
      const mape = errCount ? Number((pctErrSum / errCount).toFixed(2)) : null;
      const withinBandPct = bandCount ? Math.round((withinBand / bandCount) * 100) : null;

      return new Response(JSON.stringify({
        success: true,
        evaluated: evaluated.length,
        correct,
        directionalAccuracy: accuracy,
        mae,
        mape,
        withinBandPct,
        recent: evaluated.slice(-10).reverse(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "symbols") {
      const symbols = Object.entries(STOCK_TOKENS).map(([stockSymbol, info]) => ({
        symbol: stockSymbol,
        name: info.name,
        token: info.yahooSymbol,
      }));

      return new Response(JSON.stringify({ success: true, data: symbols }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Market data API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});