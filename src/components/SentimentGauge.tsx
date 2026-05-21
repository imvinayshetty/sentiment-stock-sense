import { getSentimentScore } from "@/lib/stockData";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface SentimentGaugeProps {
  symbol: string;
}

const SentimentGauge = ({ symbol }: SentimentGaugeProps) => {
  const { score, label, tweets } = getSentimentScore(symbol);

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
            Based on <span className="font-mono text-foreground">{tweets.toLocaleString()}</span> social mentions
          </p>
          <p className="text-xs text-muted-foreground">Powered by NLP sentiment analysis</p>
        </div>
      </div>
      <div className={`mt-5 flex items-start gap-3 rounded-lg border p-3 ${recommendation.bg}`}>
        <recommendation.Icon className={`mt-0.5 h-5 w-5 ${recommendation.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-sm font-bold ${recommendation.color}`}>{recommendation.action}</span>
            <span className="text-xs text-muted-foreground">· Sentiment-based signal</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{recommendation.reason}</p>
          <p className="mt-1 text-[10px] text-muted-foreground/70">Not financial advice. For informational purposes only.</p>
        </div>
      </div>
    </div>
  );
};

export default SentimentGauge;
