import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cached JWT across warm invocations (Angel One rate-limits logins hard)
let cachedJwt: string | null = null;
let cachedJwtExpiry = 0;
let cachedIP: string | null = null;

// Indian stock token mapping (NSE exchange tokens)
const STOCK_TOKENS: Record<string, { token: string; name: string }> = {
  "RELIANCE": { token: "2885", name: "Reliance Industries" },
  "TCS": { token: "11536", name: "Tata Consultancy Services" },
  "INFY": { token: "1594", name: "Infosys Ltd." },
  "HDFCBANK": { token: "1333", name: "HDFC Bank Ltd." },
  "ICICIBANK": { token: "4963", name: "ICICI Bank Ltd." },
  "WIPRO": { token: "3787", name: "Wipro Ltd." },
  "TATAMOTORS": { token: "3456", name: "Tata Motors Ltd." },
  "SBIN": { token: "3045", name: "State Bank of India" },
  "BAJFINANCE": { token: "317", name: "Bajaj Finance Ltd." },
  "ITC": { token: "1660", name: "ITC Ltd." },
};

async function generateTOTP(secret: string): Promise<string> {
  // Base32 decode
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
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    cachedIP = j.ip || "1.1.1.1";
    return cachedIP;
  } catch {
    cachedIP = "1.1.1.1";
    return cachedIP;
  }
}

async function getJwt(publicIP: string, forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedJwt && now < cachedJwtExpiry) {
    return cachedJwt;
  }
  cachedJwt = await loginAngelOne(publicIP);
  // Angel One JWTs last ~24h; refresh every 6h to be safe
  cachedJwtExpiry = now + 6 * 60 * 60 * 1000;
  return cachedJwt;
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
      "Accept": "application/json",
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
      password: password,
      totp: totp,
    }),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Login failed (non-JSON, status ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!data.data?.jwtToken) {
    throw new Error(`Login failed: ${data.message || JSON.stringify(data)}`);
  }
  return data.data.jwtToken;
}

async function getMarketQuotes(jwtToken: string, tokens: string[], publicIP: string): Promise<any> {
  const apiKey = Deno.env.get("ANGEL_ONE_API_KEY")!;

  const res = await fetch("https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "192.168.1.1",
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": "aa:bb:cc:dd:ee:ff",
      "User-Agent": "Mozilla/5.0",
      "X-PrivateKey": apiKey,
      "Authorization": `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      mode: "FULL",
      exchangeTokens: {
        NSE: tokens,
      },
    }),
  });

  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`Quotes failed (status ${res.status}): ${text.slice(0,200)}`); }
}

async function getHistoricalData(jwtToken: string, symbolToken: string, interval: string, publicIP: string): Promise<any> {
  const apiKey = Deno.env.get("ANGEL_ONE_API_KEY")!;
  
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 15);

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

  const res = await fetch("https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "192.168.1.1",
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": "aa:bb:cc:dd:ee:ff",
      "User-Agent": "Mozilla/5.0",
      "X-PrivateKey": apiKey,
      "Authorization": `Bearer ${jwtToken}`,
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
  try { return JSON.parse(text); } catch { throw new Error(`Historical failed (status ${res.status}): ${text.slice(0,200)}`); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "quotes";
    const symbol = url.searchParams.get("symbol");

    const publicIP = await getPublicIP();
    let jwtToken = await getJwt(publicIP);

    if (action === "quotes") {
      const tokens = Object.values(STOCK_TOKENS).map(s => s.token);
      let quotes = await getMarketQuotes(jwtToken, tokens, publicIP);
      if (quotes?.errorcode === "AB1010" || quotes?.message?.toLowerCase?.().includes("invalid token")) {
        jwtToken = await getJwt(publicIP, true);
        quotes = await getMarketQuotes(jwtToken, tokens, publicIP);
      }
      console.log("Angel One quotes raw response:", JSON.stringify(quotes).slice(0, 2000));
      
      // Map tokens back to symbols
      const tokenToSymbol: Record<string, string> = {};
      for (const [sym, info] of Object.entries(STOCK_TOKENS)) {
        tokenToSymbol[info.token] = sym;
      }

      const mapped = (quotes.data?.fetched || []).map((item: any) => ({
        symbol: tokenToSymbol[item.symbolToken] || item.tradingSymbol,
        name: STOCK_TOKENS[tokenToSymbol[item.symbolToken]]?.name || item.tradingSymbol,
        price: item.ltp,
        change: item.netChange || (item.ltp - item.close),
        changePercent: item.percentChange || ((item.ltp - item.close) / item.close * 100),
        volume: item.tradeVolume ? `${(item.tradeVolume / 1e6).toFixed(1)}M` : "N/A",
        high: item.high,
        low: item.low,
        open: item.open,
        close: item.close,
        exchange: "NSE",
      }));

      return new Response(JSON.stringify({ success: true, data: mapped }), {
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
      const interval = url.searchParams.get("interval") || "ONE_DAY";
      const historical = await getHistoricalData(jwtToken, stockInfo.token, interval, publicIP);
      
      return new Response(JSON.stringify({ success: true, data: historical.data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "symbols") {
      const symbols = Object.entries(STOCK_TOKENS).map(([symbol, info]) => ({
        symbol,
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
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
