import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  // Lock to ALLOWED_ORIGIN in production; defaults to "*" when unset.
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MINUTES = 60;
// Zero-article results are cached only briefly so a transient RSS/network blip
// doesn't lock users out of news + sentiment for the full hour.
const ZERO_ARTICLE_TTL_MINUTES = 5;

// Company names used to build a focused Google News query per symbol.
const COMPANY_NAMES: Record<string, string> = {
  RELIANCE: "Reliance Industries", TCS: "Tata Consultancy Services", INFY: "Infosys",
  HDFCBANK: "HDFC Bank", ICICIBANK: "ICICI Bank", WIPRO: "Wipro", TATAMOTORS: "Tata Motors",
  SBIN: "State Bank of India", BAJFINANCE: "Bajaj Finance", ITC: "ITC Limited",
  HINDUNILVR: "Hindustan Unilever", KOTAKBANK: "Kotak Mahindra Bank", LT: "Larsen & Toubro",
  AXISBANK: "Axis Bank", MARUTI: "Maruti Suzuki", ASIANPAINT: "Asian Paints",
  SUNPHARMA: "Sun Pharmaceutical", TITAN: "Titan Company", ULTRACEMCO: "UltraTech Cement",
  NESTLEIND: "Nestle India", BHARTIARTL: "Bharti Airtel", HCLTECH: "HCL Technologies",
  TECHM: "Tech Mahindra", POWERGRID: "Power Grid Corporation", NTPC: "NTPC",
  ONGC: "Oil and Natural Gas Corporation", COALINDIA: "Coal India", JSWSTEEL: "JSW Steel",
  TATASTEEL: "Tata Steel", HINDALCO: "Hindalco", ADANIPORTS: "Adani Ports",
  BAJAJFINSV: "Bajaj Finserv", DRREDDY: "Dr Reddy's Laboratories", CIPLA: "Cipla",
  DIVISLAB: "Divi's Laboratories", GRASIM: "Grasim Industries", EICHERMOT: "Eicher Motors",
  HEROMOTOCO: "Hero MotoCorp", M_M: "Mahindra & Mahindra", BRITANNIA: "Britannia Industries",
  INDUSINDBK: "IndusInd Bank", TATACONSUM: "Tata Consumer Products", UPL: "UPL Limited",
  APOLLOHOSP: "Apollo Hospitals", BPCL: "Bharat Petroleum",
};

interface Article {
  title: string;
  source: string;
  time: string;
  link: string;
  sentiment: "positive" | "negative" | "neutral";
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/<[^>]+>/g, "").trim();
}

function timeAgo(pubDate: string): string {
  const t = new Date(pubDate).getTime();
  if (Number.isNaN(t)) return "recently";
  const diff = Date.now() - t;
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type RawArticle = { title: string; source: string; time: string; link: string };

function parseRss(xml: string, defaultSource: string): RawArticle[] {
  const items = xml.split(/<item>/i).slice(1, 13);
  return items.map((item) => {
    const title = decodeEntities((item.match(/<title>(.*?)<\/title>/s)?.[1]) ?? "");
    const link = decodeEntities((item.match(/<link>(.*?)<\/link>/s)?.[1]) ?? "");
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1]) ?? "";
    const source = decodeEntities((item.match(/<source[^>]*>(.*?)<\/source>/s)?.[1]) ?? defaultSource);
    return { title, source, time: timeAgo(pubDate), link };
  }).filter((a) => a.title);
}

async function tryFetch(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      if (res.ok) return await res.text();
    } catch (_) { /* retry */ }
    finally { clearTimeout(timer); }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

// Tries Google News RSS, then Yahoo Finance RSS, then Bing News RSS.
async function fetchNews(query: string, symbol: string): Promise<RawArticle[]> {
  // Run all three RSS sources in parallel. Worst case is bounded by tryFetch's
  // own retry/timeout (~20.8s) rather than the sum of all three (~62s).
  const sources = [
    tryFetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query + " stock NSE")}&hl=en-IN&gl=IN&ceid=IN:en`)
      .then((xml) => (xml ? parseRss(xml, "Google News") : [])),
    tryFetch(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol + ".NS")}&region=IN&lang=en-IN`)
      .then((xml) => (xml ? parseRss(xml, "Yahoo Finance") : [])),
    tryFetch(`https://www.bing.com/news/search?q=${encodeURIComponent(query + " stock NSE")}&format=RSS`)
      .then((xml) => (xml ? parseRss(xml, "Bing News") : [])),
  ];
  const results = await Promise.allSettled(sources);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.length > 0) return r.value;
  }
  return [];
}

async function scoreWithLovableAi(apiKey: string, company: string, headlines: string[]): Promise<{ scores: number[]; overall: number }> {
  const capped = headlines.map((h) => h.slice(0, 120));
  const prompt = `You are a financial sentiment analyst. For the stock "${company}", classify each headline's likely effect on the stock price from -1 (very bearish) to 1 (very bullish). Return only JSON in this exact shape: {"scores":[number,...]}. Include one score per headline in the same order.\n\nHeadlines:\n${capped.map((h, i) => `${i + 1}. ${h}`).join("\n")}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: prompt,
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: "sentiment_scores",
          strict: true,
          schema: {
            type: "object",
            properties: {
              scores: { type: "array", items: { type: "number", minimum: -1, maximum: 1 } },
            },
            required: ["scores"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Lovable AI error (${res.status}): ${await res.text()}`);

  const stream = await res.text();
  let content = "";
  for (const line of stream.split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        content += event.delta;
      }
    } catch (_) { /* ignore non-JSON stream lines */ }
  }
  const parsed = JSON.parse(content || "{}");
  const scores: number[] = Array.isArray(parsed.scores)
    ? parsed.scores.slice(0, headlines.length).map((n: unknown) => Math.max(-1, Math.min(1, Number(n) || 0)))
    : [];
  if (scores.length !== headlines.length) throw new Error("Lovable AI returned an incomplete score set");
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  // Map [-1,1] -> [0,100]
  const overall = Math.round((avg + 1) * 50);
  return { scores, overall };
}

function labelFor(score: number): string {
  if (score >= 75) return "Very Bullish";
  if (score >= 60) return "Bullish";
  if (score >= 55) return "Slightly Bullish";
  if (score >= 45) return "Neutral";
  if (score >= 35) return "Slightly Bearish";
  return "Bearish";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    if (!symbol) {
      return new Response(JSON.stringify({ success: false, error: "Missing symbol" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Serve from cache if fresh
    const { data: cached } = await supabase
      .from("sentiment_cache").select("*").eq("symbol", symbol).maybeSingle();
    if (cached) {
      const ageMin = (Date.now() - new Date(cached.updated_at).getTime()) / 60000;
      const isEmpty = !Array.isArray(cached.articles) || cached.articles.length === 0;
      const ttl = isEmpty ? ZERO_ARTICLE_TTL_MINUTES : CACHE_TTL_MINUTES;
      if (ageMin < ttl && cached.scored_by !== "default") {
        return new Response(JSON.stringify({ success: true, cached: true, ...cached }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const company = COMPANY_NAMES[symbol] || symbol;
    const raw = await fetchNews(company, symbol);

    if (raw.length === 0) {
      const fallback = { symbol, score: 50, label: "Neutral", buzz: 0, articles: [], scored_by: "default" };
      await supabase.from("sentiment_cache").upsert({ ...fallback, updated_at: new Date().toISOString() });
      return new Response(JSON.stringify({ success: true, cached: false, ...fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    let scores: number[] = [];
    let overall = 50;
    let scoredBy: "lovable-ai" | "default" = "default";
    if (lovableApiKey) {
      try {
        const result = await scoreWithLovableAi(lovableApiKey, company, raw.map((a) => a.title));
        scores = result.scores;
        overall = result.overall;
        scoredBy = "lovable-ai";
      } catch (e) {
        console.error("Lovable AI scoring failed:", e);
      }
    }

    const articles: Article[] = raw.map((a, i) => {
      const s = scores[i] ?? 0;
      return { ...a, sentiment: s > 0.15 ? "positive" : s < -0.15 ? "negative" : "neutral" };
    });

    const payload = {
      symbol,
      score: overall,
      label: labelFor(overall),
      buzz: raw.length,
      articles,
      scored_by: scoredBy,
    };
    await supabase.from("sentiment_cache").upsert({ ...payload, updated_at: new Date().toISOString() });

    return new Response(JSON.stringify({ success: true, cached: false, ...payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("news-sentiment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});