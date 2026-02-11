import { useState } from "react";
import { BarChart3 } from "lucide-react";
import TickerBar from "@/components/TickerBar";
import StockSearch from "@/components/StockSearch";
import StockDetail from "@/components/StockDetail";
import PredictionChart from "@/components/PredictionChart";
import SentimentGauge from "@/components/SentimentGauge";
import NewsFeed from "@/components/NewsFeed";

const Index = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("NVDA");

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
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary" />
              Market Open
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

        {/* News */}
        <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <NewsFeed />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Stock Market Prediction App · Powered by ARIMA, LSTM & Linear Regression · Data is simulated for demonstration
      </footer>
    </div>
  );
};

export default Index;
