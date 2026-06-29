import { useNewsSentiment } from "@/hooks/useAngelOneData";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface SentimentGaugeProps {
  symbol: string;
}

const SentimentGauge = ({ symbol }: SentimentGaugeProps) => {
  const { data, isLoading, isError } = useNewsSentiment(symbol);
  const score = data?.score ?? 50;
  const label = data?.label ?? "Neutral";
  const tweets = data?.buzz ?? 0;
  const isDefault = data?.scoredBy !== "groq";

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Sentiment Analysis</h3>
        <p className="text-sm text-muted-foreground">Analyzing latest news…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-glow">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Sentiment Analysis</h3>
        <p className="text-sm text-muted-foreground">Live sentiment is unavailable right now.</p>
      </div>
    );
  }

  const getColor = () => {
    if (score >= 65) return "text-chart-up";
    if (score <= 40) return "text-chart-down";
    return "text-chart-neutral";
  };

  const getBgColor = () => {
    if (score >= 65) return "bg-chart-up";
    if (score <= 40) return "bg-chart-down";
    return "bg-chart-neutral";
  };

  // Confidence: combines distance from neutral (50) with sample-size weight (log scale)
  const extremity = Math.min(1, Math.abs(score - 50) / 40); // 0..1
  // Calibrated to ~50 articles/week as "high coverage" (news volume, not tweet volume).
  const volumeWeight = Math.min(1, Math.log10(Math.max(tweets, 1) + 1) / Math.log10(51));
  const confidence = Math.round((extremity * 0.6 + volumeWeight * 0.4) * 100);
  const confidenceLabel = confidence >= 75 ? "High" : confidence >= 50 ? "Moderate" : confidence >= 30 ? "Low" : "Very Low";
  const confidenceColor =
    confidence >= 75 ? "text-chart-up" : confidence >= 50 ? "text-chart-neutral" : "text-chart-down";
  const confidenceBar =
    confidence >= 75 ? "bg-chart-up" : confidence >= 50 ? "bg-chart-neutral" : "bg-chart-down";

  const recommendation =
    score >= 70
      ? { action: "STRONG BUY", reason: "Highly positive sentiment suggests upward momentum.", Icon: ArrowUpRight, color: "text-chart-up", bg: "bg-chart-up/15 border-chart-up/30" }
      : score >= 55
      ? { action: "BUY", reason: "Positive sentiment leans bullish.", Icon: ArrowUpRight, color: "text-chart-up", bg: "bg-chart-up/10 border-chart-up/20" }
      : score >= 45
      ? { action: "HOLD", reason: "Mixed sentiment — wait for a clearer signal.", Icon: Minus, color: "text-chart-neutral", bg: "bg-chart-neutral/10 border-chart-neutral/20" }
      : score >= 30
      ? { action: "SELL", reason: "Negative sentiment leans bearish.", Icon: ArrowDownRight, color: "text-chart-down", bg: "bg-chart-down/10 border-chart-down/20" }
      : { action: "STRONG SELL", reason: "Highly negative sentiment suggests downside risk.", Icon: ArrowDownRight, color: "text-chart-down", bg: "bg-chart-down/15 border-chart-down/30" };

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Sentiment Analysis</h3>
      <div className="flex items-center gap-6">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(220 18% 18%)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="50" fill="none"
              stroke={score >= 65 ? "hsl(160 100% 45%)" : score <= 40 ? "hsl(0 72% 55%)" : "hsl(45 90% 55%)"}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 314} 314`}
            />
          </svg>
          <div className="absolute text-center">
            <span className={`font-mono text-2xl font-bold ${getColor()}`}>{score}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${getBgColor()} bg-opacity-15 ${getColor()}`}>
            {label}
          </div>
          <p className="text-sm text-muted-foreground">
            Based on <span className="font-mono text-foreground">{tweets.toLocaleString()}</span> recent news articles
          </p>
          <p className="text-xs text-muted-foreground">
            {isDefault ? "AI sentiment scoring unavailable — showing neutral default" : "Powered by Google News + AI sentiment scoring"}
          </p>
        </div>
      </div>
      {isDefault && (
        <div className="mt-4 rounded-lg border border-chart-neutral/30 bg-chart-neutral/10 p-3 text-xs text-muted-foreground">
          Sentiment scoring is unavailable right now, so this score is a neutral default rather than an
          analysis of the {tweets} headline{tweets === 1 ? "" : "s"} above. No buy/sell signal is shown.
        </div>
      )}
      {!isDefault && confidence < 30 && (
        <div className="mt-4 rounded-lg border border-chart-neutral/30 bg-chart-neutral/10 p-3 text-xs text-muted-foreground">
          Signal unclear — insufficient data. Confidence is too low ({confidence}%) to show a reliable
          buy/sell recommendation.
        </div>
      )}
      {!isDefault && confidence >= 30 && (
      <div className={`mt-5 flex items-start gap-3 rounded-lg border p-3 ${recommendation.bg}`}>
        <recommendation.Icon className={`mt-0.5 h-5 w-5 ${recommendation.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono text-sm font-bold ${recommendation.color}`}>{recommendation.action}</span>
            <span className="text-xs text-muted-foreground">· Sentiment-based signal</span>
            <span className={`ml-auto rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-[10px] ${confidenceColor}`}>
              {confidenceLabel} confidence · {confidence}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full ${confidenceBar} transition-all`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{recommendation.reason}</p>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            Confidence reflects sentiment strength and social-mention volume. Not financial advice.
          </p>
        </div>
      </div>
      )}
    </div>
  );
};

export default SentimentGauge;
