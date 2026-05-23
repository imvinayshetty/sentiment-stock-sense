import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  TATAMOTORS: { name: "Tata Motors Ltd.", yahooSymbol: "TATAMOTORS.NS" },
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

      const data = results.filter(Boolean);
      const mostRecentTime = data.reduce<number | undefined>((latest, item: any) => {
        if (!item?.marketTime) return latest;
        return latest ? Math.max(latest, item.marketTime) : item.marketTime;
      }, undefined);
      const market = getMarketStatus();
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