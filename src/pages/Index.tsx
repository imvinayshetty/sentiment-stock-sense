import { useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import TickerBar from "@/components/TickerBar";
import StockSearch from "@/components/StockSearch";
import StockDetail from "@/components/StockDetail";
import PredictionChart from "@/components/PredictionChart";
import SentimentGauge from "@/components/SentimentGauge";
import PriceTarget from "@/components/PriceTarget";
import NewsFeed from "@/components/NewsFeed";
import DemoTrading from "@/components/DemoTrading";
import { useStockQuotes } from "@/hooks/useAngelOneData";

const Index = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("RELIANCE");
  const { data: quotes, isFetching, refetch } = useStockQuotes();
  const queryClient = useQueryClient();
  const marketOpen = quotes?.marketStatus === "OPEN";
  const istTime = quotes?.istTime;

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["historical", selectedSymbol] });
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Stock Market Prediction</h1>
              <p className="text-xs text-muted-foreground">ML-Powered Forecasting & Sentiment Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isFetching}
              className="h-7 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh quotes
            </Button>
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                marketOpen
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  marketOpen ? "animate-pulse-glow bg-primary" : "bg-muted-foreground"
                }`}
              />
              {marketOpen ? "Market Open" : "Market Closed"}
              {istTime && (
                <span className="ml-1 font-mono opacity-70">· {istTime}</span>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <TickerBar />

      {/* Main Content */}
      <main className="container py-6 space-y-6">
        {/* Search */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <StockSearch onSelect={setSelectedSymbol} selectedSymbol={selectedSymbol} />
        </div>

        {/* Stock Detail */}
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <StockDetail symbol={selectedSymbol} />
        </div>

        {/* Chart + Sentiment */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <PredictionChart symbol={selectedSymbol} />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <SentimentGauge symbol={selectedSymbol} />
          </div>
        </div>

        {/* Price Target */}
        <div className="animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <PriceTarget symbol={selectedSymbol} />
        </div>

        {/* News */}
        <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <NewsFeed />
        </div>

        {/* Demo Trading */}
        <div className="animate-fade-in-up" style={{ animationDelay: "450ms" }}>
          <DemoTrading />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Stock Market Prediction App · Live NSE pricing and chart data shown when verified by the backend
      </footer>
    </div>
  );
};

export default Index;
