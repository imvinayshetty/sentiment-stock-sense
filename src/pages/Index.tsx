import { useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import TickerBar from "@/components/TickerBar";
import StockSearch from "@/components/StockSearch";
import SettingsDialog from "@/components/SettingsDialog";
import StockDetail from "@/components/StockDetail";
import PredictionChart from "@/components/PredictionChart";
import SentimentGauge from "@/components/SentimentGauge";
import FullCandleView from "@/components/FullCandleView";
import PriceTarget from "@/components/PriceTarget";
import BasketAccuracy from "@/components/BasketAccuracy";
import BasketComparison from "@/components/BasketComparison";
import BasketHistory from "@/components/BasketHistory";
import BasketDayCompare from "@/components/BasketDayCompare";
import DemoTrading from "@/components/DemoTrading";
import IntradayBreakeven from "@/components/IntradayBreakeven";
import CollapsibleSection from "@/components/CollapsibleSection";
import { Scale, Columns2, Wallet, History, Calculator } from "lucide-react";

import { useStockQuotes, useForecast } from "@/hooks/useAngelOneData";

const Index = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("RELIANCE");
  const [candleFlipped, setCandleFlipped] = useState(false);
  const { data: quotes, isFetching: quotesFetching, refetch } = useStockQuotes();
  const { isFetching: forecastFetching } = useForecast(selectedSymbol);
  const isRefreshing = quotesFetching || forecastFetching;
  const queryClient = useQueryClient();
  const marketOpen = quotes?.marketStatus === "OPEN";
  const istTime = quotes?.istTime;

  const handleRefresh = () => {
    refetch();
    // Force active chart and basket requests to refresh with the quote feed.
    queryClient.invalidateQueries({ queryKey: ["historical", selectedSymbol], refetchType: "active" });
    // Prefix-match so HoldingsSellPanel rows (each keyed by their own symbol) also refresh.
    queryClient.invalidateQueries({ queryKey: ["forecast"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["basket-accuracy"], refetchType: "active" });
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-foreground sm:text-lg">Stock Market Prediction</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">ML-Powered Forecasting & Sentiment Analysis</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SettingsDialog />
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh quotes</span>
              <span className="sm:hidden">Refresh</span>
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
              <span className="hidden sm:inline">{marketOpen ? "Market Open" : "Market Closed"}</span>
              <span className="sm:hidden">{marketOpen ? "Open" : "Closed"}</span>
              {istTime && (
                <span className="ml-1 hidden font-mono opacity-70 sm:inline">· {istTime}</span>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <TickerBar />

      {/* Main Content */}
      <main className="container space-y-6 py-4 sm:py-6">
        {/* Search */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <StockSearch onSelect={setSelectedSymbol} selectedSymbol={selectedSymbol} />
        </div>

        {/* Stock Detail */}
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <StockDetail symbol={selectedSymbol} />
        </div>

        {/* Chart + Sentiment — flips to a full-width candle view */}
        <div style={{ perspective: "1600px" }}>
          <div
            className="grid transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: candleFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front: forecast chart + sentiment */}
            <div
              className="col-start-1 row-start-1 grid gap-6 lg:grid-cols-3"
              style={{ backfaceVisibility: "hidden", pointerEvents: candleFlipped ? "none" : "auto" }}
            >
              <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                <PredictionChart symbol={selectedSymbol} onCandleView={() => setCandleFlipped(true)} />
              </div>
              <div className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
                <SentimentGauge symbol={selectedSymbol} />
              </div>
            </div>
            {/* Back: full-width candle chart */}
            <div
              className="col-start-1 row-start-1"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", pointerEvents: candleFlipped ? "auto" : "none" }}
            >
              <FullCandleView symbol={selectedSymbol} onBack={() => setCandleFlipped(false)} />
            </div>
          </div>
        </div>

        {/* Price Target */}
        <div className="animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <PriceTarget symbol={selectedSymbol} />
        </div>

        {/* Basket Accuracy */}
        <div className="animate-fade-in-up" style={{ animationDelay: "375ms" }}>
          <BasketAccuracy />
        </div>

        {/* Intraday breakeven & suggestions (collapsed by default) */}
        <div className="animate-fade-in-up" style={{ animationDelay: "378ms" }}>
          <CollapsibleSection title="Intraday Breakeven & Suggestions" icon={<Calculator className="h-5 w-5 text-primary" />}>
            <IntradayBreakeven />
          </CollapsibleSection>
        </div>



        {/* Basket history (collapsed by default) */}
        <div className="animate-fade-in-up" style={{ animationDelay: "380ms" }}>
          <CollapsibleSection title="Basket History" icon={<History className="h-5 w-5 text-primary" />}>
            <BasketHistory />
          </CollapsibleSection>
        </div>

        {/* Basket vs Market Comparison (collapsed by default) */}
        <div className="animate-fade-in-up" style={{ animationDelay: "385ms" }}>
          <CollapsibleSection title="Basket vs Market Comparison" icon={<Scale className="h-5 w-5 text-primary" />}>
            <BasketComparison />
          </CollapsibleSection>
        </div>

        {/* Two-day side-by-side comparison (collapsed by default) */}
        <div className="animate-fade-in-up" style={{ animationDelay: "390ms" }}>
          <CollapsibleSection title="Compare Two Days Side by Side" icon={<Columns2 className="h-5 w-5 text-primary" />}>
            <BasketDayCompare />
          </CollapsibleSection>
        </div>




        {/* Demo Trading (collapsed by default) */}
        <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <CollapsibleSection title="Demo Trading" icon={<Wallet className="h-5 w-5 text-primary" />}>
            <DemoTrading />
          </CollapsibleSection>
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
