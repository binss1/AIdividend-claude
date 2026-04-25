'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface PriceDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface EnrichedDataPoint extends PriceDataPoint {
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
}

interface PriceChartProps {
  data: PriceDataPoint[];
}

type Period = '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '4Y' | '5Y';
type Indicator = 'MA20' | 'MA60' | 'MA120' | 'BB';

const PERIOD_LABELS: Record<Period, string> = {
  '1M': '1개월',
  '3M': '3개월',
  '6M': '6개월',
  '1Y': '1년',
  '2Y': '2년',
  '3Y': '3년',
  '4Y': '4년',
  '5Y': '5년',
};

const PERIOD_DAYS: Record<Period, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '2Y': 730,
  '3Y': 1095,
  '4Y': 1460,
  '5Y': 1825,
};

const INDICATOR_CONFIG: { id: Indicator; label: string; color: string }[] = [
  { id: 'MA20',  label: 'MA 20',       color: '#f59e0b' },
  { id: 'MA60',  label: 'MA 60',       color: '#3b82f6' },
  { id: 'MA120', label: 'MA 120',      color: '#a855f7' },
  { id: 'BB',    label: '볼린저 밴드', color: '#06b6d4' },
];

/** Simple Moving Average — returns null for indices where not enough data */
function calcMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((s, v) => s + v, 0) / period;
  });
}

/** Bollinger Bands (period=20, multiplier=2σ) */
function calcBollinger(
  closes: number[],
  period = 20,
  mult = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];

  closes.forEach((_, i) => {
    if (i < period - 1) {
      upper.push(null); middle.push(null); lower.push(null);
      return;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push(avg + mult * std);
    middle.push(avg);
    lower.push(avg - mult * std);
  });

  return { upper, middle, lower };
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<{ payload: EnrichedDataPoint; [key: string]: any }>;
  label?: string;
  activeIndicators: Set<Indicator>;
}

function CustomTooltip({ active, payload, activeIndicators }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm min-w-[180px]">
      <p className="text-xs text-gray-400 mb-2 font-medium">{d.date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-400">시가</span>
        <span className="text-white font-mono text-right">${d.open.toFixed(2)}</span>
        <span className="text-gray-400">고가</span>
        <span className="text-emerald-400 font-mono text-right">${d.high.toFixed(2)}</span>
        <span className="text-gray-400">저가</span>
        <span className="text-red-400 font-mono text-right">${d.low.toFixed(2)}</span>
        <span className="text-gray-400">종가</span>
        <span className="text-white font-bold font-mono text-right">${d.close.toFixed(2)}</span>
        <span className="text-gray-400">거래량</span>
        <span className="text-gray-300 font-mono text-right">{formatVolume(d.volume)}</span>
      </div>

      {/* Indicator values */}
      {(activeIndicators.has('MA20') || activeIndicators.has('MA60') || activeIndicators.has('MA120') || activeIndicators.has('BB')) && (
        <div className="border-t border-gray-700 mt-2 pt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {activeIndicators.has('MA20') && d.ma20 != null && (
            <>
              <span style={{ color: '#f59e0b' }}>MA 20</span>
              <span className="font-mono text-right" style={{ color: '#f59e0b' }}>${d.ma20.toFixed(2)}</span>
            </>
          )}
          {activeIndicators.has('MA60') && d.ma60 != null && (
            <>
              <span style={{ color: '#3b82f6' }}>MA 60</span>
              <span className="font-mono text-right" style={{ color: '#3b82f6' }}>${d.ma60.toFixed(2)}</span>
            </>
          )}
          {activeIndicators.has('MA120') && d.ma120 != null && (
            <>
              <span style={{ color: '#a855f7' }}>MA 120</span>
              <span className="font-mono text-right" style={{ color: '#a855f7' }}>${d.ma120.toFixed(2)}</span>
            </>
          )}
          {activeIndicators.has('BB') && d.bbUpper != null && (
            <>
              <span style={{ color: '#06b6d4' }}>BB 상단</span>
              <span className="font-mono text-right" style={{ color: '#06b6d4' }}>${d.bbUpper.toFixed(2)}</span>
              <span style={{ color: '#06b6d4' }}>BB 중단</span>
              <span className="font-mono text-right" style={{ color: '#06b6d4' }}>${(d.bbMiddle ?? 0).toFixed(2)}</span>
              <span style={{ color: '#06b6d4' }}>BB 하단</span>
              <span className="font-mono text-right" style={{ color: '#06b6d4' }}>${(d.bbLower ?? 0).toFixed(2)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PriceChart({ data }: PriceChartProps) {
  const [period, setPeriod] = useState<Period>('1Y');
  const [activeIndicators, setActiveIndicators] = useState<Set<Indicator>>(new Set());

  const toggleIndicator = (id: Indicator) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Period-filtered data (sorted ascending) — uses full dataset for MA/BB lookback */
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const days = PERIOD_DAYS[period];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const filtered = data.filter((d) => d.date >= cutoffStr);
    const result = filtered.length > 0 ? filtered : data.slice(-30);
    return [...result].sort((a, b) => a.date.localeCompare(b.date));
  }, [data, period]);

  /** Enrich with indicator values computed over the FULL sorted dataset for accuracy */
  const enrichedData = useMemo((): EnrichedDataPoint[] => {
    if (filteredData.length === 0) return [];

    const needMA20  = activeIndicators.has('MA20');
    const needMA60  = activeIndicators.has('MA60');
    const needMA120 = activeIndicators.has('MA120');
    const needBB    = activeIndicators.has('BB');

    const closes = filteredData.map(d => d.close);

    const ma20Vals  = needMA20  ? calcMA(closes, 20)  : null;
    const ma60Vals  = needMA60  ? calcMA(closes, 60)  : null;
    const ma120Vals = needMA120 ? calcMA(closes, 120) : null;
    const bbVals    = needBB    ? calcBollinger(closes) : null;

    return filteredData.map((d, i) => ({
      ...d,
      ma20:     ma20Vals  ? ma20Vals[i]       : null,
      ma60:     ma60Vals  ? ma60Vals[i]       : null,
      ma120:    ma120Vals ? ma120Vals[i]      : null,
      bbUpper:  bbVals    ? bbVals.upper[i]   : null,
      bbMiddle: bbVals    ? bbVals.middle[i]  : null,
      bbLower:  bbVals    ? bbVals.lower[i]   : null,
    }));
  }, [filteredData, activeIndicators]);

  const priceChange = useMemo(() => {
    if (filteredData.length < 2) return { value: 0, percent: 0 };
    const first = filteredData[0].close;
    const last = filteredData[filteredData.length - 1].close;
    return {
      value: last - first,
      percent: ((last - first) / first) * 100,
    };
  }, [filteredData]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900/50 rounded-xl border border-gray-800">
        <p className="text-gray-500">가격 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const isPositive = priceChange.value >= 0;

  return (
    <div>
      {/* Top row: price change + period buttons */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}${priceChange.value.toFixed(2)} ({isPositive ? '+' : ''}{priceChange.percent.toFixed(2)}%)
          </span>
          <span className="text-xs text-gray-500">{PERIOD_LABELS[period]} 변동</span>
        </div>
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                period === p
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator toggle buttons */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500 mr-1">보조지표</span>
        {INDICATOR_CONFIG.map(({ id, label, color }) => {
          const active = activeIndicators.has(id);
          return (
            <button
              key={id}
              onClick={() => toggleIndicator(id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-200 ${
                active
                  ? 'border-opacity-60 bg-opacity-15'
                  : 'border-gray-700 text-gray-500 bg-transparent hover:border-gray-500 hover:text-gray-300'
              }`}
              style={active ? { borderColor: color, color, backgroundColor: `${color}22` } : undefined}
            >
              <span
                className="inline-block w-2.5 h-0.5 rounded-full"
                style={{ backgroundColor: active ? color : '#4b5563' }}
              />
              {label}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={enrichedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickFormatter={(val: string) => {
              const d = new Date(val);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            yAxisId="price"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            domain={['auto', 'auto']}
            tickFormatter={(val: number) => `$${val.toFixed(0)}`}
            width={60}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#4b5563', fontSize: 9 }}
            tickFormatter={(val: number) => formatVolume(val)}
            width={45}
            domain={[0, (max: number) => max * 4]}
          />
          <Tooltip content={<CustomTooltip activeIndicators={activeIndicators} />} />

          {/* Volume bars (behind everything) */}
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="rgba(59, 130, 246, 0.15)"
            radius={[1, 1, 0, 0]}
            animationDuration={600}
          />

          {/* Price area */}
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#priceGradient)"
            animationDuration={800}
            dot={false}
          />

          {/* Bollinger Bands — rendered before MAs so MAs appear on top */}
          {activeIndicators.has('BB') && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="bbUpper"
              stroke="#06b6d4"
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              animationDuration={400}
              name="BB 상단"
            />
          )}
          {activeIndicators.has('BB') && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="bbMiddle"
              stroke="#06b6d4"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              animationDuration={400}
              name="BB 중단"
            />
          )}
          {activeIndicators.has('BB') && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="bbLower"
              stroke="#06b6d4"
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              animationDuration={400}
              name="BB 하단"
            />
          )}

          {/* Moving Averages */}
          {activeIndicators.has('MA20') && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ma20"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              animationDuration={400}
              name="MA 20"
            />
          )}
          {activeIndicators.has('MA60') && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ma60"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              animationDuration={400}
              name="MA 60"
            />
          )}
          {activeIndicators.has('MA120') && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ma120"
              stroke="#a855f7"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              animationDuration={400}
              name="MA 120"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
