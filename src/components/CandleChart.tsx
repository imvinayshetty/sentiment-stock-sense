import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface CandleRow {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  actual?: number;
  forecast?: number;
}

/**
 * Recharts has no candlestick series, so each candle is drawn as a custom Bar
 * shape: the bar spans low..high (wick) and the body is positioned inside it
 * from open to close using the bar's own pixel scale.
 */
const Candle = (props: any) => {
  const { x, y, width, height, payload } = props;
  const open = payload?.open;
  const close = payload?.actual;
  const high = payload?.high;
  const low = payload?.low;
  if ([open, close, high, low].some((v) => typeof v !== "number" || Number.isNaN(v))) return null;

  const span = high - low || 1;
  const pxPerUnit = height / span;
  const up = close >= open;
  const color = up ? "hsl(var(--chart-up))" : "hsl(var(--chart-down))";
  const bodyTop = y + (high - Math.max(open, close)) * pxPerUnit;
  const bodyHeight = Math.max(Math.abs(close - open) * pxPerUnit, 1);
  const bodyWidth = Math.max(width * 0.6, 1);
  const cx = x + width / 2;

  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyWidth / 2} width={bodyWidth} y={bodyTop} height={bodyHeight} fill={color} />
    </g>
  );
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
  fontSize: "13px",
  fontFamily: "JetBrains Mono, monospace",
};

const CandleTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as CandleRow;
  const rows: [string, number | undefined][] = [
    ["Open", d.open],
    ["High", d.high],
    ["Low", d.low],
    ["Close", d.actual],
    ["Forecast", d.forecast],
  ];
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <div className="mb-1 font-semibold">{d.date}</div>
      {rows.map(([label, value]) =>
        typeof value === "number" ? (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span>₹{value.toFixed(2)}</span>
          </div>
        ) : null,
      )}
    </div>
  );
};

interface CandleChartProps {
  data: CandleRow[];
  height?: number | string;
}

const CandleChart = ({ data, height = 350 }: CandleChartProps) => {
  const values = data
    .flatMap((d) => [d.high, d.low, d.actual, d.forecast])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  const yMin = values.length ? Math.min(...values) * 0.99 : 0;
  const yMax = values.length ? Math.max(...values) * 1.01 : 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          minTickGap={30}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          domain={[yMin, yMax]}
        />
        <Tooltip content={<CandleTooltip />} />
        <Bar dataKey={(d: CandleRow) => [d.low, d.high]} shape={<Candle />} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="hsl(var(--chart-neutral))"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default CandleChart;
