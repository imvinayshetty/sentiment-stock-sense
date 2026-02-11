import { getNews } from "@/lib/stockData";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const NewsFeed = () => {
  const news = getNews();

  const sentimentIcon = (s: string) => {
    if (s === "positive") return <TrendingUp className="h-4 w-4 text-chart-up" />;
    if (s === "negative") return <TrendingDown className="h-4 w-4 text-chart-down" />;
    return <Minus className="h-4 w-4 text-chart-neutral" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Market News</h3>
      <div className="space-y-3">
        {news.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-lg border border-border bg-secondary/30 p-3 transition-colors hover:bg-secondary/60">
            <div className="mt-0.5">{sentimentIcon(item.sentiment)}</div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{item.source}</span>
                <span>·</span>
                <span>{item.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;
