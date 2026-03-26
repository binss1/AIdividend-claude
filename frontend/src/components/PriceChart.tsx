'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
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

interface PriceChartProps {
  data: PriceDataPoint[];
}

type Period = '1M' | '3M' | '6M' | '1Y' | '5Y';

const PERIOD_LABELS: Record<Period, string> = {
  '1M': '1개월',
  '3M': '3개월',
  '6M': '6개월',
  '1Y': '1년',
  '5Y': '5년',
};

const PERIOD_DAYS: Record<Period, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '5Y': 1825,
};

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PriceDataPoint }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm">
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
    </div>
  );
}

export default function PriceChart({ data }: PriceChartProps) {
  const [period, setPeriod] = useState<Period>('1Y');

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const days = PERIOD_DAYS[period];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const filtered = data.filter((d) => d.date >= cutoffStr);
    return filtered.length > 0 ? filtered : data.slice(-30);
  }, [data, period]);

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
      <div className="flex items-center justify-between mb-4">
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
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            domain={['auto', 'auto']}
            tickFormatter={(val: number) => `$${val.toFixed(0)}`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#priceGradient)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
