import { useNewsSentiment } from "@/hooks/useAngelOneData";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";

interface NewsFeedProps {
  symbol: string;
}

const NewsFeed = ({ symbol }: NewsFeedProps) => {
  const { data, isLoading, isError } = useNewsSentiment(symbol);
  const news = data?.articles ?? [];

  const sentimentIcon = (s: string) => {
    if (s === "positive") return <TrendingUp className="h-4 w-4 text-chart-up" />;
    if (s === "negative") return <TrendingDown className="h-4 w-4 text-chart-down" />;
    return <Minus className="h-4 w-4 text-chart-neutral" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Market News · {symbol}</h3>
      {isLoading && <p className="text-sm text-muted-foreground">Loading latest headlines…</p>}
      {isError && <p className="text-sm text-muted-foreground">News is unavailable right now.</p>}
      {!isLoading && !isError && news.length === 0 && (
        <p className="text-sm text-muted-foreground">No recent news found for this stock.</p>
      )}
      <div className="space-y-3">
        {news.map((item) => {
          const hasLink = Boolean(item.link);
          const Wrapper = hasLink ? "a" : "div";
          const wrapperProps = hasLink
            ? { href: item.link, target: "_blank", rel: "noopener noreferrer" }
            : {};
          return (
            <Wrapper
              key={item.link || `${item.title}-${item.source}`}
              {...wrapperProps}
              className={`flex gap-3 rounded-lg border border-border bg-secondary/30 p-3 ${
                hasLink ? "transition-colors hover:bg-secondary/60" : ""
              }`}
            >
              <div className="mt-0.5">{sentimentIcon(item.sentiment)}</div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.source}</span>
                  <span>·</span>
                  <span>{item.time}</span>
                  {hasLink && <ExternalLink className="ml-auto h-3 w-3" />}
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
};

export default NewsFeed;
