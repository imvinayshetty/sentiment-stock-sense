import { getSentimentScore } from "@/lib/stockData";

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
    </div>
  );
};

export default SentimentGauge;
