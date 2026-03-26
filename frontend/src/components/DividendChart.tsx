'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

interface DividendDataPoint {
  date: string;
  amount: number;
}

interface DividendChartProps {
  data: DividendDataPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DividendDataPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="text-xs text-gray-400 mb-1 font-medium">{d.date}</p>
      <p className="text-sm text-white font-bold font-mono">${d.amount.toFixed(4)}</p>
      <p className="text-xs text-gray-500 mt-0.5">주당 배당금</p>
    </div>
  );
}

export default function DividendChart({ data }: DividendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-900/50 rounded-xl border border-gray-800">
        <p className="text-gray-500">배당 히스토리 데이터가 없습니다.</p>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickFormatter={(val: string) => {
            const d = new Date(val);
            return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
          }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickFormatter={(val: number) => `$${val.toFixed(2)}`}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]} animationDuration={800}>
          {data.map((entry, index) => {
            const intensity = 0.4 + (entry.amount / maxAmount) * 0.6;
            return (
              <Cell
                key={`cell-${index}`}
                fill={`rgba(16, 185, 129, ${intensity})`}
                stroke="rgba(16, 185, 129, 0.3)"
                strokeWidth={1}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
