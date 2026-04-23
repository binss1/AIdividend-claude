'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch, API_ENDPOINTS, getApiBaseUrl } from '@/config/api';

// ============================================================
// Types
// ============================================================
interface DividendEvent {
  symbol: string;
  name: string;
  exDividendDate: string;
  recordDate: string | null;
  paymentDate: string | null;
  declarationDate: string | null;
  dividend: number;
  dividendYield: number | null;
  price: number | null;
  exchange: string | null;
}

interface DividendCalendarData {
  from: string;
  to: string;
  totalEvents: number;
  events: DividendEvent[];
}

interface EarningsEvent {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  time: string | null;  // 'bmo' | 'amc' | 'dmh'
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding: string | null;
}

interface EarningsCalendarData {
  from: string;
  to: string;
  totalEvents: number;
  events: EarningsEvent[];
}

interface MyDividendPayment {
  symbol: string;
  company_name: string;
  shares: number;
  ex_dividend_date: string;
  payment_date: string;
  payment_date_estimated: boolean;
  dividend_per_share: number;
  total_dividend: number;
}

interface MyDividendCalendarData {
  year: number;
  month: number;
  total_events: number;
  total_amount: number;
  events: MyDividendPayment[];
  by_date: Record<string, MyDividendPayment[]>;
}

// ============================================================
// Helpers
// ============================================================
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAY_NAMES = ['일','월','화','수','목','금','토'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function fmtDate(d: string | null) {
  if (!d) return '-';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}
function fmtRevenue(n: number | null) {
  if (n == null) return '-';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

type TabType = 'dividend' | 'earnings' | 'myDividend';

// ============================================================
// Shared: month navigation controls
// ============================================================
function MonthNav({
  year, month,
  onPrev, onNext, onToday,
}: {
  year: number; month: number;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onPrev} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <h2 className="text-lg font-bold text-white min-w-[130px] text-center">
        {year}년 {MONTH_NAMES[month]}
      </h2>
      <button onClick={onNext} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      <button onClick={onToday} className="ml-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
        오늘
      </button>
    </div>
  );
}

// ============================================================
// Dividend Calendar Tab
// ============================================================
function DividendCalendarTab({ year, month }: { year: number; month: number }) {
  const [data, setData] = useState<DividendCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterSymbol, setFilterSymbol] = useState('');

  useEffect(() => { setSelectedDate(null); }, [year, month]);

  useEffect(() => {
    setLoading(true);
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = getDaysInMonth(year, month);
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
    apiFetch<DividendCalendarData>(`${API_ENDPOINTS.DIVIDEND_CALENDAR}?from=${from}&to=${to}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    if (!data) return {} as Record<string, DividendEvent[]>;
    const map: Record<string, DividendEvent[]> = {};
    for (const ev of data.events) {
      if (!map[ev.exDividendDate]) map[ev.exDividendDate] = [];
      map[ev.exDividendDate].push(ev);
    }
    return map;
  }, [data]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate || !eventsByDate[selectedDate]) return [];
    let evs = eventsByDate[selectedDate];
    if (filterSymbol.trim()) {
      const q = filterSymbol.toUpperCase().trim();
      evs = evs.filter(e => e.symbol.includes(q) || e.name.toUpperCase().includes(q));
    }
    return evs;
  }, [selectedDate, eventsByDate, filterSymbol]);

  const allEvents = useMemo(() => {
    if (!data) return [];
    let evs = [...data.events];
    if (filterSymbol.trim()) {
      const q = filterSymbol.toUpperCase().trim();
      evs = evs.filter(e => e.symbol.includes(q) || e.name.toUpperCase().includes(q));
    }
    return evs;
  }, [data, filterSymbol]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="종목 검색..."
            value={filterSymbol}
            onChange={e => setFilterSymbol(e.target.value)}
            className="w-36 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['calendar', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs transition-colors ${viewMode === mode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {mode === 'calendar' ? '캘린더' : '리스트'}
              </button>
            ))}
          </div>
        </div>
        {data && (
          <div className="flex gap-3">
            {[
              { label: '이번 달 배당 이벤트', value: data.totalEvents, color: 'text-white' },
              { label: '배당락일 수', value: Object.keys(eventsByDate).length, color: 'text-emerald-400' },
              { label: '종목 수', value: new Set(data.events.map(e => e.symbol)).size, color: 'text-teal-400' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-zinc-900/80 border border-zinc-800/60 px-3 py-2 text-center min-w-[80px]">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-zinc-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <Spinner />}

      {!loading && viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className={`text-center text-xs font-medium py-1 ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-zinc-500'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="h-20 rounded-lg" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = toDateStr(year, month, day);
                const evs = eventsByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dow = (firstDay + i) % 7;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                    className={`h-20 rounded-lg p-1.5 text-left transition-all flex flex-col ${
                      isSelected ? 'bg-emerald-500/15 border border-emerald-500/40' :
                      evs.length > 0 ? 'bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/30' :
                      'bg-zinc-900/30 hover:bg-zinc-800/40 border border-transparent'
                    }`}
                  >
                    <span className={`text-xs font-medium ${
                      isToday ? 'bg-emerald-500 text-white rounded-full w-5 h-5 flex items-center justify-center' :
                      dow === 0 ? 'text-red-400/70' : dow === 6 ? 'text-blue-400/70' : 'text-zinc-400'
                    }`}>{day}</span>
                    {evs.length > 0 && (
                      <div className="mt-auto">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-[10px] text-emerald-400 font-medium">{evs.length}건</span>
                        </div>
                        <div className="text-[9px] text-zinc-500 truncate">
                          {evs.slice(0, 2).map(e => e.symbol).join(', ')}{evs.length > 2 ? '...' : ''}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4 sticky top-20 self-start">
            {selectedDate ? (
              <>
                <h3 className="text-sm font-semibold text-white mb-3">{selectedDate} 배당락</h3>
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-zinc-500">해당 날짜에 배당 이벤트가 없습니다.</p>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {selectedEvents.map((ev, idx) => (
                      <div key={`${ev.symbol}-${idx}`} className="rounded-lg bg-zinc-800/50 border border-zinc-700/30 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white text-sm">{ev.symbol}</span>
                          <span className="text-emerald-400 text-sm font-medium">${ev.dividend.toFixed(4)}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{ev.name}</div>
                        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                          {ev.price && <div className="text-zinc-400">주가: <span className="text-zinc-300">${ev.price.toFixed(2)}</span></div>}
                          {ev.dividendYield != null && <div className="text-zinc-400">수익률: <span className="text-emerald-400">{ev.dividendYield.toFixed(2)}%</span></div>}
                          {ev.paymentDate && <div className="text-zinc-400">지급일: <span className="text-zinc-300">{fmtDate(ev.paymentDate)}</span></div>}
                          {ev.recordDate && <div className="text-zinc-400">기록일: <span className="text-zinc-300">{fmtDate(ev.recordDate)}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-[10px] text-zinc-600 text-center">총 {selectedEvents.length}건</div>
              </>
            ) : (
              <div className="text-center py-8">
                <svg className="w-10 h-10 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <p className="text-sm text-zinc-500">날짜를 클릭하세요</p>
                <p className="text-[10px] text-zinc-600 mt-1">배당락일 종목 확인</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && viewMode === 'list' && (
        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-xs text-zinc-500">
                  <th className="px-4 py-3 text-left">배당락일</th>
                  <th className="px-3 py-3 text-left">종목</th>
                  <th className="px-3 py-3 text-right">배당금</th>
                  <th className="px-3 py-3 text-right">주가</th>
                  <th className="px-3 py-3 text-right">수익률</th>
                  <th className="px-3 py-3 text-left">지급일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {allEvents.map((ev, idx) => (
                  <tr key={`${ev.symbol}-${idx}`} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-2 text-zinc-300 whitespace-nowrap">{ev.exDividendDate}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-white">{ev.symbol}</div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[200px]">{ev.name}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-400">${ev.dividend.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{ev.price ? `$${ev.price.toFixed(2)}` : '-'}</td>
                    <td className="px-3 py-2 text-right text-emerald-400">{ev.dividendYield != null ? `${ev.dividendYield.toFixed(2)}%` : '-'}</td>
                    <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{ev.paymentDate || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allEvents.length === 0 && <div className="text-center py-12 text-zinc-500">이번 달 배당 이벤트가 없습니다</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Earnings Calendar Tab
// ============================================================
type TimeBadge = 'bmo' | 'amc' | 'dmh' | null;

function TimeBadgeEl({ time }: { time: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    bmo: { label: '장 전', cls: 'bg-blue-500/15 text-blue-400' },
    amc: { label: '장 후', cls: 'bg-amber-500/15 text-amber-400' },
    dmh: { label: '장 중', cls: 'bg-emerald-500/15 text-emerald-400' },
  };
  const info = time ? map[time] : null;
  if (!info) return null;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${info.cls}`}>{info.label}</span>;
}

function EpsBadge({ actual, estimated }: { actual: number | null; estimated: number | null }) {
  if (actual == null || estimated == null) return <span className="text-zinc-500">-</span>;
  const beat = actual >= estimated;
  return (
    <div className="text-right">
      <span className={`font-medium ${beat ? 'text-emerald-400' : 'text-red-400'}`}>${actual.toFixed(2)}</span>
      <span className="text-zinc-600 text-[10px] ml-1">(예상 ${estimated.toFixed(2)})</span>
    </div>
  );
}

function EarningsCalendarTab({ year, month }: { year: number; month: number }) {
  const [data, setData] = useState<EarningsCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterSymbol, setFilterSymbol] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeBadge | 'all'>('all');

  useEffect(() => { setSelectedDate(null); }, [year, month]);

  useEffect(() => {
    setLoading(true);
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = getDaysInMonth(year, month);
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
    apiFetch<EarningsCalendarData>(`${API_ENDPOINTS.EARNINGS_CALENDAR}?from=${from}&to=${to}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    if (!data) return {} as Record<string, EarningsEvent[]>;
    const map: Record<string, EarningsEvent[]> = {};
    for (const ev of data.events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [data]);

  const applyFilters = useCallback((evs: EarningsEvent[]) => {
    let result = evs;
    if (filterSymbol.trim()) {
      const q = filterSymbol.toUpperCase().trim();
      result = result.filter(e => e.symbol.toUpperCase().includes(q));
    }
    if (timeFilter !== 'all') {
      result = result.filter(e => e.time === timeFilter);
    }
    return result;
  }, [filterSymbol, timeFilter]);

  const selectedEvents = useMemo(() =>
    selectedDate ? applyFilters(eventsByDate[selectedDate] || []) : [],
  [selectedDate, eventsByDate, applyFilters]);

  const allEvents = useMemo(() =>
    data ? applyFilters(data.events) : [],
  [data, applyFilters]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // EPS Beat/Miss 통계 (실제값 있는 종목만)
  const reported = data?.events.filter(e => e.eps != null && e.epsEstimated != null) ?? [];
  const beats = reported.filter(e => (e.eps ?? 0) >= (e.epsEstimated ?? 0)).length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="종목 검색..."
            value={filterSymbol}
            onChange={e => setFilterSymbol(e.target.value)}
            className="w-36 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
          {/* 시간 필터 */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {([
              { v: 'all', label: '전체' },
              { v: 'bmo', label: '장 전' },
              { v: 'amc', label: '장 후' },
              { v: 'dmh', label: '장 중' },
            ] as const).map(f => (
              <button
                key={f.v}
                onClick={() => setTimeFilter(f.v)}
                className={`px-2.5 py-1.5 text-xs transition-colors ${timeFilter === f.v ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['calendar', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs transition-colors ${viewMode === mode ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {mode === 'calendar' ? '캘린더' : '리스트'}
              </button>
            ))}
          </div>
        </div>
        {data && (
          <div className="flex gap-3">
            {[
              { label: '총 실적 발표', value: data.totalEvents, color: 'text-white' },
              { label: '발표일 수', value: Object.keys(eventsByDate).length, color: 'text-amber-400' },
              ...(reported.length > 0 ? [{ label: `어닝 서프라이즈 (${reported.length}건 중)`, value: `${beats}건`, color: 'text-emerald-400' }] : []),
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-zinc-900/80 border border-zinc-800/60 px-3 py-2 text-center min-w-[80px]">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-zinc-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <Spinner />}

      {!loading && viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className={`text-center text-xs font-medium py-1 ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-zinc-500'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="h-20 rounded-lg" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = toDateStr(year, month, day);
                const evs = eventsByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dow = (firstDay + i) % 7;
                // EPS beat 종목 수
                const beatCount = evs.filter(e => e.eps != null && e.epsEstimated != null && e.eps >= e.epsEstimated).length;
                const missCount = evs.filter(e => e.eps != null && e.epsEstimated != null && e.eps < e.epsEstimated).length;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                    className={`h-20 rounded-lg p-1.5 text-left transition-all flex flex-col ${
                      isSelected ? 'bg-amber-500/15 border border-amber-500/40' :
                      evs.length > 0 ? 'bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/30' :
                      'bg-zinc-900/30 hover:bg-zinc-800/40 border border-transparent'
                    }`}
                  >
                    <span className={`text-xs font-medium ${
                      isToday ? 'bg-amber-500 text-black rounded-full w-5 h-5 flex items-center justify-center' :
                      dow === 0 ? 'text-red-400/70' : dow === 6 ? 'text-blue-400/70' : 'text-zinc-400'
                    }`}>{day}</span>
                    {evs.length > 0 && (
                      <div className="mt-auto space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="text-[10px] text-amber-400 font-medium">{evs.length}건</span>
                        </div>
                        {(beatCount > 0 || missCount > 0) && (
                          <div className="flex gap-1 text-[9px]">
                            {beatCount > 0 && <span className="text-emerald-400">↑{beatCount}</span>}
                            {missCount > 0 && <span className="text-red-400">↓{missCount}</span>}
                          </div>
                        )}
                        <div className="text-[9px] text-zinc-500 truncate">
                          {evs.slice(0, 2).map(e => e.symbol).join(', ')}{evs.length > 2 ? '...' : ''}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side Panel */}
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4 sticky top-20 self-start">
            {selectedDate ? (
              <>
                <h3 className="text-sm font-semibold text-white mb-3">{selectedDate} 실적 발표</h3>
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-zinc-500">해당 날짜에 실적 발표가 없습니다.</p>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {selectedEvents.map((ev, idx) => {
                      const hasBeat = ev.eps != null && ev.epsEstimated != null && ev.eps >= ev.epsEstimated;
                      const hasMiss = ev.eps != null && ev.epsEstimated != null && ev.eps < ev.epsEstimated;
                      return (
                        <div key={`${ev.symbol}-${idx}`} className={`rounded-lg bg-zinc-800/50 border p-2.5 ${
                          hasBeat ? 'border-emerald-500/30' : hasMiss ? 'border-red-500/30' : 'border-zinc-700/30'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white text-sm">{ev.symbol}</span>
                            <TimeBadgeEl time={ev.time} />
                          </div>
                          <div className="mt-1.5 space-y-1 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-500">EPS</span>
                              <EpsBadge actual={ev.eps} estimated={ev.epsEstimated} />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-500">매출</span>
                              <div className="text-right">
                                <span className="text-zinc-300">{fmtRevenue(ev.revenue)}</span>
                                {ev.revenueEstimated && (
                                  <span className="text-zinc-600 text-[10px] ml-1">(예상 {fmtRevenue(ev.revenueEstimated)})</span>
                                )}
                              </div>
                            </div>
                            {ev.fiscalDateEnding && (
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-500">결산 분기</span>
                                <span className="text-zinc-400">{ev.fiscalDateEnding}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 text-[10px] text-zinc-600 text-center">총 {selectedEvents.length}건</div>
              </>
            ) : (
              <div className="text-center py-8">
                <svg className="w-10 h-10 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <p className="text-sm text-zinc-500">날짜를 클릭하세요</p>
                <p className="text-[10px] text-zinc-600 mt-1">실적 발표 종목 확인</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && viewMode === 'list' && (
        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-xs text-zinc-500">
                  <th className="px-4 py-3 text-left">발표일</th>
                  <th className="px-3 py-3 text-left">종목</th>
                  <th className="px-3 py-3 text-center">시간</th>
                  <th className="px-3 py-3 text-right">EPS (실제)</th>
                  <th className="px-3 py-3 text-right">EPS (예상)</th>
                  <th className="px-3 py-3 text-right">매출 (실제)</th>
                  <th className="px-3 py-3 text-right">매출 (예상)</th>
                  <th className="px-3 py-3 text-left">결산</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {allEvents.map((ev, idx) => {
                  const hasBeat = ev.eps != null && ev.epsEstimated != null && ev.eps >= ev.epsEstimated;
                  const hasMiss = ev.eps != null && ev.epsEstimated != null && ev.eps < ev.epsEstimated;
                  return (
                    <tr key={`${ev.symbol}-${idx}`} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 text-zinc-300 whitespace-nowrap">{ev.date}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-white">{ev.symbol}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <TimeBadgeEl time={ev.time} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {ev.eps != null ? (
                          <span className={hasBeat ? 'text-emerald-400' : hasMiss ? 'text-red-400' : 'text-zinc-300'}>
                            ${ev.eps.toFixed(2)}
                          </span>
                        ) : <span className="text-zinc-600">예정</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-400">
                        {ev.epsEstimated != null ? `$${ev.epsEstimated.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300">{fmtRevenue(ev.revenue)}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-500">{fmtRevenue(ev.revenueEstimated)}</td>
                      <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap text-xs">{ev.fiscalDateEnding || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {allEvents.length === 0 && (
            <div className="text-center py-12 text-zinc-500">이번 달 실적 발표 데이터가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// My Dividend Calendar Tab (포트폴리오 연계)
// ============================================================
function MyDividendCalendarTab({ year, month }: { year: number; month: number }) {
  const [data, setData] = useState<MyDividendCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => { setSelectedDate(null); }, [year, month]);

  // 환율 조회 (최초 1회)
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/exchange-rate`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rate) setExchangeRate(d.rate); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<MyDividendCalendarData>(
      `${API_ENDPOINTS.PORTFOLIO_DIVIDEND_CALENDAR}?year=${year}&month=${month + 1}`
    )
      .then(setData)
      .catch((err) => {
        if (err && typeof err === 'object' && 'status' in err) {
          const status = (err as { status: number }).status;
          if (status === 401) { setError('login_required'); return; }
        }
        setError('데이터 조회 중 오류가 발생했습니다.');
      })
      .finally(() => setLoading(false));
  }, [year, month]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const byDate = data?.by_date ?? {};
  const selectedEvents = selectedDate ? (byDate[selectedDate] ?? []) : [];

  // 월 합계
  const monthTotal = data?.total_amount ?? 0;

  // 최대값 (바 차트 비율용)
  const maxDayAmount = Object.values(byDate).reduce((max, evts) => {
    const s = evts.reduce((sum, e) => sum + e.total_dividend, 0);
    return s > max ? s : max;
  }, 0);

  if (error === 'login_required') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">로그인이 필요합니다</h3>
        <p className="text-zinc-400 text-sm mb-5">포트폴리오 배당 수령 일정은 로그인 후 이용할 수 있습니다.</p>
        <a href="/auth/login" className="px-5 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-medium transition-colors">
          로그인하기
        </a>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-zinc-500">{error}</div>;
  }

  if (!loading && data && data.total_events === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">이번 달 예상 배당이 없습니다</h3>
        <p className="text-zinc-400 text-sm mb-5">
          포트폴리오에 배당 종목을 추가하면<br />월별 배당 수령 일정을 확인할 수 있습니다.
        </p>
        <a href="/portfolio" className="px-5 py-2.5 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 rounded-xl text-sm font-medium transition-colors border border-violet-500/30">
          포트폴리오 관리하기
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['calendar', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs transition-colors ${viewMode === mode ? 'bg-violet-500/20 text-violet-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {mode === 'calendar' ? '캘린더' : '리스트'}
              </button>
            ))}
          </div>
          <a href="/portfolio" className="text-xs text-zinc-500 hover:text-violet-400 transition-colors underline underline-offset-2">
            포트폴리오 수정
          </a>
        </div>
        {data && data.total_events > 0 && (
          <div className="flex flex-wrap gap-3">
            {/* 수령 건수 */}
            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/60 px-3 py-2 text-center min-w-[90px]">
              <div className="text-lg font-bold text-violet-400">{data.total_events}</div>
              <div className="text-[10px] text-zinc-500">예상 수령 건수</div>
            </div>
            {/* USD 합계 */}
            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/60 px-3 py-2 text-center min-w-[110px]">
              <div className="text-lg font-bold text-emerald-400">${monthTotal.toFixed(2)}</div>
              <div className="text-[10px] text-zinc-500">이번 달 예상 배당</div>
            </div>
            {/* KRW 환산 합계 */}
            {exchangeRate && (
              <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2 text-center min-w-[120px]">
                <div className="text-lg font-bold text-violet-300">
                  ₩{(monthTotal * exchangeRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-zinc-500">원화 환산 (₩{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}/달러)</div>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && <Spinner />}

      {!loading && viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className={`text-center text-xs font-medium py-1 ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-zinc-500'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="h-20 rounded-lg" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = toDateStr(year, month, day);
                const evts = byDate[dateStr] || [];
                const dayTotal = evts.reduce((s, e) => s + e.total_dividend, 0);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dow = (firstDay + i) % 7;
                const hasEstimated = evts.some(e => e.payment_date_estimated);

                return (
                  <button
                    key={day}
                    onClick={() => evts.length > 0 && setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                    className={`h-20 rounded-lg p-1.5 text-left transition-all flex flex-col ${
                      isSelected ? 'bg-violet-500/15 border border-violet-500/40' :
                      evts.length > 0 ? 'bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/30 cursor-pointer' :
                      'bg-zinc-900/30 border border-transparent cursor-default'
                    }`}
                  >
                    <span className={`text-xs font-medium ${
                      isToday ? 'bg-violet-500 text-white rounded-full w-5 h-5 flex items-center justify-center' :
                      dow === 0 ? 'text-red-400/70' : dow === 6 ? 'text-blue-400/70' : 'text-zinc-400'
                    }`}>{day}</span>
                    {evts.length > 0 && (
                      <div className="mt-auto space-y-0.5">
                        {maxDayAmount > 0 && (
                          <div className="w-full bg-zinc-700/30 rounded-full h-1">
                            <div
                              className="bg-violet-400 h-1 rounded-full"
                              style={{ width: `${Math.min((dayTotal / maxDayAmount) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-violet-400 font-medium">${dayTotal.toFixed(2)}</span>
                          {hasEstimated && <span className="text-[9px] text-zinc-600">*</span>}
                        </div>
                        <div className="text-[9px] text-zinc-500 truncate">
                          {evts.slice(0, 2).map(e => e.symbol).join(', ')}{evts.length > 2 ? '...' : ''}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">* 표시는 추정 지급일 (실제 지급일이 공시되지 않은 경우)</p>
          </div>

          {/* Side Panel */}
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4 sticky top-20 self-start">
            {selectedDate ? (
              <>
                <h3 className="text-sm font-semibold text-white mb-1">{selectedDate} 배당 수령</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  합계: <span className="text-violet-400 font-semibold">${selectedEvents.reduce((s, e) => s + e.total_dividend, 0).toFixed(2)}</span>
                </p>
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-zinc-500">해당 날짜에 수령 예정 배당이 없습니다.</p>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {selectedEvents.map((ev, idx) => (
                      <div key={`${ev.symbol}-${idx}`} className="rounded-lg bg-zinc-800/50 border border-violet-500/20 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white text-sm">{ev.symbol}</span>
                          <span className="text-violet-400 text-sm font-bold">${ev.total_dividend.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate mb-1.5">{ev.company_name}</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                          <div className="text-zinc-400">보유 주수: <span className="text-zinc-300">{ev.shares}주</span></div>
                          <div className="text-zinc-400">주당 배당: <span className="text-zinc-300">${ev.dividend_per_share.toFixed(4)}</span></div>
                          <div className="text-zinc-400">배당락일: <span className="text-zinc-300">{ev.ex_dividend_date}</span></div>
                          <div className="text-zinc-400">
                            지급일:
                            <span className={`ml-1 ${ev.payment_date_estimated ? 'text-amber-400' : 'text-zinc-300'}`}>
                              {ev.payment_date}{ev.payment_date_estimated ? ' (추정)' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-[10px] text-zinc-600 text-center">총 {selectedEvents.length}건</div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-10 h-10 mx-auto rounded-xl bg-violet-500/10 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500">날짜를 클릭하세요</p>
                <p className="text-[10px] text-zinc-600 mt-1">배당 수령 종목 상세보기</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && viewMode === 'list' && data && (
        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-xs text-zinc-500">
                  <th className="px-4 py-3 text-left">지급일</th>
                  <th className="px-3 py-3 text-left">종목</th>
                  <th className="px-3 py-3 text-right">보유 주수</th>
                  <th className="px-3 py-3 text-right">주당 배당</th>
                  <th className="px-3 py-3 text-right">수령 금액 (USD)</th>
                  {exchangeRate && <th className="px-3 py-3 text-right">원화 환산</th>}
                  <th className="px-3 py-3 text-left">배당락일</th>
                  <th className="px-3 py-3 text-center">지급일 유형</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {data.events.map((ev, idx) => (
                  <tr key={`${ev.symbol}-${idx}`} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-2.5 text-zinc-300 whitespace-nowrap">{ev.payment_date}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-white">{ev.symbol}</div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[180px]">{ev.company_name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">{ev.shares}주</td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">${ev.dividend_per_share.toFixed(4)}</td>
                    <td className="px-3 py-2.5 text-right text-violet-400 font-semibold">${ev.total_dividend.toFixed(2)}</td>
                    {exchangeRate && (
                      <td className="px-3 py-2.5 text-right text-violet-300 text-xs">
                        ₩{(ev.total_dividend * exchangeRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap text-xs">{ev.ex_dividend_date}</td>
                    <td className="px-3 py-2.5 text-center">
                      {ev.payment_date_estimated ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">추정</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">확정</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {data.events.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-700/60">
                    <td colSpan={4} className="px-4 py-2.5 text-xs text-zinc-500 font-medium">이번 달 합계</td>
                    <td className="px-3 py-2.5 text-right text-violet-400 font-bold">${monthTotal.toFixed(2)}</td>
                    {exchangeRate && (
                      <td className="px-3 py-2.5 text-right text-violet-300 font-bold text-sm">
                        ₩{(monthTotal * exchangeRate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                      </td>
                    )}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {data.events.length === 0 && (
            <div className="text-center py-12 text-zinc-500">이번 달 예상 배당 수령이 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Spinner
// ============================================================
function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg className="w-6 h-6 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function CalendarPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [activeTab, setActiveTab] = useState<TabType>('dividend');

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
  };
  const goToday = () => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); };

  return (
    <div className="min-h-screen bg-gray-950 pt-20 pb-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            투자 캘린더
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            배당락일 · 실적 발표 · 내 포트폴리오 배당 수령 일정을 한눈에 확인하세요
          </p>
        </div>

        {/* Tab + Month Nav */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-900/60 p-1 gap-1">
            <button
              onClick={() => setActiveTab('dividend')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'dividend'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              배당 캘린더
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'earnings'
                  ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              실적 발표
            </button>
            <button
              onClick={() => setActiveTab('myDividend')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'myDividend'
                  ? 'bg-violet-500/20 text-violet-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              내 배당 수령
            </button>
          </div>

          {/* Month Navigation */}
          <MonthNav
            year={currentYear}
            month={currentMonth}
            onPrev={prevMonth}
            onNext={nextMonth}
            onToday={goToday}
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'dividend' && (
          <DividendCalendarTab year={currentYear} month={currentMonth} />
        )}
        {activeTab === 'earnings' && (
          <EarningsCalendarTab year={currentYear} month={currentMonth} />
        )}
        {activeTab === 'myDividend' && (
          <MyDividendCalendarTab year={currentYear} month={currentMonth} />
        )}
      </div>
    </div>
  );
}
