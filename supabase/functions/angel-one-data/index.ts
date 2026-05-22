import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGIN_REFRESH_MS = 6 * 60 * 60 * 1000;
const LOGIN_BACKOFF_MS = 90 * 1000;
const FALLBACK_CACHE_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_ERROR = "ANGEL_ONE_LOGIN_RATE_LIMITED";

let cachedJwt: string | null = null;
let cachedJwtExpiry = 0;
let cachedIP: string | null = null;
let cachedFallbackQuotes: any[] | null = null;
let cachedFallbackAt = 0;
let loginInFlight: Promise<string> | null = null;
let loginRateLimitedUntil = 0;

const STOCK_TOKENS: Record<string, { token: string; name: string }> = {
  RELIANCE: { token: "2885", name: "Reliance Industries" },
  TCS: { token: "11536", name: "Tata Consultancy Services" },
  INFY: { token: "1594", name: "Infosys Ltd." },
  HDFCBANK: { token: "1333", name: "HDFC Bank Ltd." },
  ICICIBANK: { token: "4963", name: "ICICI Bank Ltd." },
  WIPRO: { token: "3787", name: "Wipro Ltd." },
  TATAMOTORS: { token: "3456", name: "Tata Motors Ltd." },
  SBIN: { token: "3045", name: "State Bank of India" },
  BAJFINANCE: { token: "317", name: "Bajaj Finance Ltd." },
  ITC: { token: "1660", name: "ITC Ltd." },
  HINDUNILVR: { token: "1394", name: "Hindustan Unilever Ltd." },
  KOTAKBANK: { token: "1922", name: "Kotak Mahindra Bank" },
  LT: { token: "11483", name: "Larsen & Toubro" },
  AXISBANK: { token: "5900", name: "Axis Bank Ltd." },
  MARUTI: { token: "10999", name: "Maruti Suzuki India" },
  ASIANPAINT: { token: "236", name: "Asian Paints Ltd." },
  SUNPHARMA: { token: "3351", name: "Sun Pharmaceutical" },
  TITAN: { token: "3506", name: "Titan Company Ltd." },
  ULTRACEMCO: { token: "11532", name: "UltraTech Cement" },
  NESTLEIND: { token: "17963", name: "Nestle India Ltd." },
  BHARTIARTL: { token: "10604", name: "Bharti Airtel Ltd." },
  HCLTECH: { token: "7229", name: "HCL Technologies" },
  TECHM: { token: "13538", name: "Tech Mahindra Ltd." },
  POWERGRID: { token: "14977", name: "Power Grid Corp." },
  NTPC: { token: "11630", name: "NTPC Ltd." },
  ONGC: { token: "2475", name: "Oil & Natural Gas Corp." },
  COALINDIA: { token: "20374", name: "Coal India Ltd." },
  JSWSTEEL: { token: "11723", name: "JSW Steel Ltd." },
  TATASTEEL: { token: "3499", name: "Tata Steel Ltd." },
  HINDALCO: { token: "1363", name: "Hindalco Industries" },
  ADANIPORTS: { token: "15083", name: "Adani Ports & SEZ" },
  BAJAJFINSV: { token: "16675", name: "Bajaj Finserv Ltd." },
  DRREDDY: { token: "881", name: "Dr. Reddy's Labs" },
  CIPLA: { token: "694", name: "Cipla Ltd." },
  DIVISLAB: { token: "10940", name: "Divi's Laboratories" },
  GRASIM: { token: "1232", name: "Grasim Industries" },
  EICHERMOT: { token: "910", name: "Eicher Motors Ltd." },
  HEROMOTOCO: { token: "1348", name: "Hero MotoCorp Ltd." },
  M_M: { token: "2031", name: "Mahindra & Mahindra" },
  BRITANNIA: { token: "547", name: "Britannia Industries" },
  INDUSINDBK: { token: "5258", name: "IndusInd Bank Ltd." },
  TATACONSUM: { token: "3432", name: "Tata Consumer Products" },
  UPL: { token: "11287", name: "UPL Ltd." },
  APOLLOHOSP: { token: "157", name: "Apollo Hospitals" },
  BPCL: { token: "526", name: "Bharat Petroleum" },
};

function getMarketStatus(): { status: "OPEN" | "CLOSED"; istTime: string } {
  const now = new Date();
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

function isRateLimitErrorMessage(message: string) {
  return message.toLowerCase().includes("exceeding access rate");
}

function isLoginRateLimitError(error: unknown) {
  return error instanceof Error && error.message === LOGIN_RATE_LIMIT_ERROR;
}

function isInvalidTokenResponse(payload: any) {
  const errorCode = String(payload?.errorCode ?? payload?.errorcode ?? "").toUpperCase();
  const message = String(payload?.message ?? "").toLowerCase();
  return errorCode === "AB1010" || message.includes("invalid token");
}

function getTokenToSymbolMap() {
  return Object.entries(STOCK_TOKENS).reduce<Record<string, string>>((acc, [symbol, info]) => {
    acc[info.token] = symbol;
    return acc;
  }, {});
}

function mapQuoteItem(item: any, tokenToSymbol: Record<string, string>) {
  const symbol = tokenToSymbol[item.symbolToken] || item.tradingSymbol;
  const close = Number(item.close ?? item.ltp ?? 0);
  const ltp = Number(item.ltp ?? close);
  const change = Number(item.netChange ?? ltp - close);
  const changePercent = Number(
    item.percentChange ?? (close ? ((ltp - close) / close) * 100 : 0),
  );

  return {
    symbol,
    name: STOCK_TOKENS[symbol]?.name || item.tradingSymbol,
    price: ltp,
    change,
    changePercent,
    volume: item.tradeVolume ? `${(item.tradeVolume / 1e6).toFixed(1)}M` : "N/A",
    high: Number(item.high ?? ltp),
    low: Number(item.low ?? ltp),
    open: Number(item.open ?? close ?? ltp),
    close,
    exchange: "NSE",
  };
}

async function generateTOTP(secret: string): Promise<string> {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits: number[] = [];

  for (const c of secret.toUpperCase().replace(/=+$/, "")) {
    const val = base32Chars.indexOf(c);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) bits.push((val >> i) & 1);
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    bytes[i] = byte;
  }

  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30);
  const timeBytes = new Uint8Array(8);
  let t = timeStep;

  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = t & 0xff;
    t = Math.floor(t / 256);
  }

  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, timeBytes));
  const offset = sig[sig.length - 1] & 0x0f;
  const code = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];

  return String(code % 1000000).padStart(6, "0");
}

async function getPublicIP(): Promise<string> {
  if (cachedIP) return cachedIP;

  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    cachedIP = data.ip || "1.1.1.1";
  } catch {
    cachedIP = "1.1.1.1";
  }

  return cachedIP;
}

async function loginAngelOne(publicIP: string): Promise<string> {
  const apiKey = Deno.env.get("ANGEL_ONE_API_KEY")!;
  const clientId = Deno.env.get("ANGEL_ONE_CLIENT_ID")!;
  const password = Deno.env.get("ANGEL_ONE_PASSWORD")!;
  const totpSecret = Deno.env.get("ANGEL_ONE_TOTP_SECRET")!;
  const totp = await generateTOTP(totpSecret);

  const res = await fetch("https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "192.168.1.1",
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": "aa:bb:cc:dd:ee:ff",
      "User-Agent": "Mozilla/5.0",
      "X-PrivateKey": apiKey,
    },
    body: JSON.stringify({
      clientcode: clientId,
      password,
      totp,
    }),
  });

  const text = await res.text();
  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    if (res.status === 403 && isRateLimitErrorMessage(text)) {
      throw new Error(LOGIN_RATE_LIMIT_ERROR);
    }
    throw new Error(`Login failed (non-JSON, status ${res.status}): ${text.slice(0, 200)}`);
  }

  const message = String(data?.message ?? "");
  if (!data.data?.jwtToken) {
    if (res.status === 403 && isRateLimitErrorMessage(message)) {
      throw new Error(LOGIN_RATE_LIMIT_ERROR);
    }
    throw new Error(`Login failed: ${message || JSON.stringify(data)}`);
  }

  return data.data.jwtToken;
}

async function getJwt(publicIP: string, forceRefresh = false): Promise<string> {
  const now = Date.now();

  if (!forceRefresh && cachedJwt && now < cachedJwtExpiry) {
    return cachedJwt;
  }

  if (now < loginRateLimitedUntil) {
    throw new Error(LOGIN_RATE_LIMIT_ERROR);
  }

  if (loginInFlight) {
    return loginInFlight;
  }

  loginInFlight = (async () => {
    try {
      const jwt = await loginAngelOne(publicIP);
      cachedJwt = jwt;
      cachedJwtExpiry = Date.now() + LOGIN_REFRESH_MS;
      loginRateLimitedUntil = 0;
      return jwt;
    } catch (error) {
      if (isLoginRateLimitError(error)) {
        loginRateLimitedUntil = Date.now() + LOGIN_BACKOFF_MS;
      }
      throw error;
    } finally {
      loginInFlight = null;
    }
  })();

  return loginInFlight;
}

async function getMarketQuotes(jwtToken: string, tokens: string[], publicIP: string): Promise<any> {
  const apiKey = Deno.env.get("ANGEL_ONE_API_KEY")!;

  const res = await fetch("https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "192.168.1.1",
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": "aa:bb:cc:dd:ee:ff",
      "User-Agent": "Mozilla/5.0",
      "X-PrivateKey": apiKey,
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      mode: "FULL",
      exchangeTokens: { NSE: tokens },
    }),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Quotes failed (status ${res.status}): ${text.slice(0, 200)}`);
  }
}

async function getHistoricalData(jwtToken: string, symbolToken: string, interval: string, publicIP: string): Promise<any> {
  const apiKey = Deno.env.get("ANGEL_ONE_API_KEY")!;
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 15);

  const fmt = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  const res = await fetch("https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "192.168.1.1",
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": "aa:bb:cc:dd:ee:ff",
      "User-Agent": "Mozilla/5.0",
      "X-PrivateKey": apiKey,
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      exchange: "NSE",
      symboltoken: symbolToken,
      interval: interval || "ONE_DAY",
      fromdate: fmt(fromDate),
      todate: fmt(toDate),
    }),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Historical failed (status ${res.status}): ${text.slice(0, 200)}`);
  }
}

async function getFallbackQuotes(publicIP: string, jwtToken: string | null) {
  const now = Date.now();
  if (cachedFallbackQuotes && now - cachedFallbackAt < FALLBACK_CACHE_MS) {
    return cachedFallbackQuotes;
  }

  if (!jwtToken) {
    return cachedFallbackQuotes ?? [];
  }

  const results: any[] = [];
  let activeJwt = jwtToken;

  for (const [symbol, info] of Object.entries(STOCK_TOKENS)) {
    try {
      let historical = await getHistoricalData(activeJwt, info.token, "ONE_DAY", publicIP);

      if (isInvalidTokenResponse(historical)) {
        activeJwt = await getJwt(publicIP, true);
        historical = await getHistoricalData(activeJwt, info.token, "ONE_DAY", publicIP);
      }

      const candles: any[] = historical?.data || [];
      if (!candles.length) {
        continue;
      }

      const last = candles[candles.length - 1];
      const prev = candles.length >= 2 ? candles[candles.length - 2] : last;
      const [, openPrice, highPrice, lowPrice, closePrice, volume] = last;
      const prevClose = Number(prev[4] ?? closePrice);

      results.push({
        symbol,
        name: info.name,
        price: Number(closePrice),
        change: Number(closePrice) - prevClose,
        changePercent: prevClose ? ((Number(closePrice) - prevClose) / prevClose) * 100 : 0,
        volume: volume ? `${(Number(volume) / 1e6).toFixed(1)}M` : "N/A",
        high: Number(highPrice ?? closePrice),
        low: Number(lowPrice ?? closePrice),
        open: Number(openPrice ?? closePrice),
        close: prevClose,
        exchange: "NSE",
      });
    } catch (error) {
      if (isLoginRateLimitError(error)) {
        break;
      }
      console.error(`Historical fallback failed for ${symbol}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  if (results.length) {
    cachedFallbackQuotes = results;
    cachedFallbackAt = now;
  }

  return results.length ? results : cachedFallbackQuotes ?? [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "quotes";
    const symbol = url.searchParams.get("symbol");
    const market = getMarketStatus();

    if (action === "quotes") {
      const publicIP = await getPublicIP();
      const tokens = Object.values(STOCK_TOKENS).map((stock) => stock.token);
      const tokenToSymbol = getTokenToSymbolMap();

      let jwtToken: string | null = null;
      let mapped: any[] = [];
      let source: "live" | "last-close" = "live";

      try {
        if (market.status === "OPEN" || !(cachedFallbackQuotes && Date.now() - cachedFallbackAt < FALLBACK_CACHE_MS)) {
          jwtToken = await getJwt(publicIP);
        }
      } catch (error) {
        if (!isLoginRateLimitError(error)) {
          throw error;
        }
      }

      if (jwtToken && market.status === "OPEN") {
        let quotes = await getMarketQuotes(jwtToken, tokens, publicIP);

        if (isInvalidTokenResponse(quotes)) {
          try {
            jwtToken = await getJwt(publicIP, true);
            quotes = await getMarketQuotes(jwtToken, tokens, publicIP);
          } catch (error) {
            if (!isLoginRateLimitError(error)) {
              throw error;
            }
            jwtToken = null;
          }
        }

        mapped = (quotes?.data?.fetched || []).map((item: any) => mapQuoteItem(item, tokenToSymbol));
      }

      if (!mapped.length) {
        source = "last-close";
        mapped = await getFallbackQuotes(publicIP, jwtToken);
      }

      return new Response(JSON.stringify({
        success: true,
        data: mapped,
        marketStatus: market.status,
        istTime: market.istTime,
        source,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "historical" && symbol) {
      const stockInfo = STOCK_TOKENS[symbol.toUpperCase()];
      if (!stockInfo) {
        return new Response(JSON.stringify({ success: false, error: "Unknown symbol" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const publicIP = await getPublicIP();
      let jwtToken: string;

      try {
        jwtToken = await getJwt(publicIP);
      } catch (error) {
        if (isLoginRateLimitError(error)) {
          return new Response(JSON.stringify({ success: true, data: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      const interval = url.searchParams.get("interval") || "ONE_DAY";
      let historical = await getHistoricalData(jwtToken, stockInfo.token, interval, publicIP);

      if (isInvalidTokenResponse(historical)) {
        try {
          jwtToken = await getJwt(publicIP, true);
          historical = await getHistoricalData(jwtToken, stockInfo.token, interval, publicIP);
        } catch (error) {
          if (isLoginRateLimitError(error)) {
            return new Response(JSON.stringify({ success: true, data: [] }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw error;
        }
      }

      if (historical?.errorCode || historical?.errorcode) {
        console.error("Angel One historical error:", historical);
      }

      return new Response(JSON.stringify({ success: true, data: historical.data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "symbols") {
      const symbols = Object.entries(STOCK_TOKENS).map(([stockSymbol, info]) => ({
        symbol: stockSymbol,
        name: info.name,
        token: info.token,
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
    console.error("Angel One API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
