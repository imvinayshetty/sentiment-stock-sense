import { useState } from "react";
import { useNewsSentiment } from "@/hooks/useAngelOneData";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

interface NewsFeedProps {
  symbol: string;
}

const sentimentMeta: Record<
  string,
  { icon: typeof Minus; label: string; className: string }
> = {
  positive: {
    icon: TrendingUp,
    label: "Positive",
    className: "text-chart-up",
  },
  negative: {
    icon: TrendingDown,
    label: "Negative",
    className: "text-chart-down",
  },
  neutral: {
    icon: Minus,
    label: "Neutral",
    className: "text-chart-neutral",
  },
};

const NewsFeed = ({ symbol }: NewsFeedProps) => {
  const { data, isLoading, isError } = useNewsSentiment(symbol);
  const news = data?.articles ?? [];
  const isDefaultScoring = data?.scoredBy !== "groq";

  const [sectionOpen, setSectionOpen] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (i: number) => setOpenIndex((cur) => (cur === i ? null : i));

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow">
      <button
        type="button"
        onClick={() => setSectionOpen((o) => !o)}
        aria-expanded={sectionOpen}
        className="mb-4 flex w-full items-center justify-between gap-2 text-left"
      >
        <h3 className="text-lg font-semibold text-foreground">
          Market News · {symbol}
        </h3>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            sectionOpen ? "" : "-rotate-90"
          }`}
        />
      </button>

      {sectionOpen && (
        <>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading latest headlines…</p>
          )}
          {isError && (
            <p className="text-sm text-muted-foreground">
              News is unavailable right now.
            </p>
          )}
          {!isLoading && !isError && news.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No recent news found for this stock.
            </p>
          )}
          {!isLoading && !isError && isDefaultScoring && news.length > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              Sentiment icons are unavailable — AI scoring is offline.
            </p>
          )}
          <div className="space-y-3">
            {news.map((item, i) => {
              const isOpen = openIndex === i;
              const meta = sentimentMeta[item.sentiment] ?? sentimentMeta.neutral;
              const Icon = meta.icon;
              const key = item.link || `${item.source}-${item.title}-${i}`;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    {!isDefaultScoring && (
                      <div className="mt-0.5">
                        <Icon className={`h-4 w-4 ${meta.className}`} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-foreground">
                        {item.title}
                      </h4>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.source}</span>
                        <span>·</span>
                        <span>{item.time}</span>
                        <ChevronDown
                          className={`ml-auto h-3 w-3 shrink-0 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
                      {!isDefaultScoring && (
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${meta.className}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label} sentiment
                        </span>
                      )}
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                        >
                          Read full article
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default NewsFeed;
