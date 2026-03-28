'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch, API_ENDPOINTS } from '@/config/api';

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

interface CalendarData {
  from: string;
  to: string;
  totalEvents: number;
  events: DividendEvent[];
}

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterSymbol, setFilterSymbol] = useState('');

  const fetchCalendar = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = getDaysInMonth(year, month);
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

      const res = await apiFetch<CalendarData>(`${API_ENDPOINTS.DIVIDEND_CALENDAR}?from=${from}&to=${to}`);
      setData(res);
    } catch (err) {
      console.error('Calendar fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchCalendar]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(y => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(y => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelectedDate(null);
  };

  const goToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(null);
  };

  // Group events by date
  const eventsByDate = useMemo(() => {
    if (!data) return {};
    const map: Record<string, DividendEvent[]> = {};
    for (const ev of data.events) {
      const key = ev.exDividendDate;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [data]);

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate || !eventsByDate[selectedDate]) return [];
    let events = eventsByDate[selectedDate];
    if (filterSymbol.trim()) {
      const q = filterSymbol.toUpperCase().trim();
      events = events.filter(e => e.symbol.includes(q) || e.name.toUpperCase().includes(q));
    }
    return events;
  }, [selectedDate, eventsByDate, filterSymbol]);

  // All events for list view
  const allEvents = useMemo(() => {
    if (!data) return [];
    let events = [...data.events];
    if (filterSymbol.trim()) {
      const q = filterSymbol.toUpperCase().trim();
      events = events.filter(e => e.symbol.includes(q) || e.name.toUpperCase().includes(q));
    }
    return events;
  }, [data, filterSymbol]);

  // Calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
            배당 캘린더
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            미국 주식 배당락일(Ex-Dividend Date) 기준 캘린더 — 날짜를 클릭하면 해당일 배당 종목을 확인할 수 있습니다
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-white min-w-[120px] text-center">
              {currentYear}년 {MONTH_NAMES[currentMonth]}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button onClick={goToday} className="ml-2 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
              오늘
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="종목 검색..."
              value={filterSymbol}
              onChange={e => setFilterSymbol(e.target.value)}
              className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 text-xs transition-colors ${viewMode === 'calendar' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                캘린더
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs transition-colors ${viewMode === 'list' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                리스트
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {data && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/60 p-3 text-center">
              <div className="text-lg font-bold text-white">{data.totalEvents}</div>
              <div className="text-[10px] text-zinc-500">이번 달 배당 이벤트</div>
            </div>
            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/60 p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">{Object.keys(eventsByDate).length}</div>
              <div className="text-[10px] text-zinc-500">배당락일 수</div>
            </div>
            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/60 p-3 text-center">
              <div className="text-lg font-bold text-teal-400">{new Set(data.events.map(e => e.symbol)).size}</div>
              <div className="text-[10px] text-zinc-500">종목 수</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg className="w-6 h-6 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}

        {!loading && viewMode === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar Grid */}
            <div className="lg:col-span-2 rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_NAMES.map(d => (
                  <div key={d} className={`text-center text-xs font-medium py-1 ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before month start */}
                {Array.from({ length: firstDay }, (_, i) => (
                  <div key={`empty-${i}`} className="h-20 rounded-lg" />
                ))}
                {/* Day cells */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const events = eventsByDate[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const dayOfWeek = (firstDay + i) % 7;
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                      className={`h-20 rounded-lg p-1.5 text-left transition-all duration-150 flex flex-col ${
                        isSelected
                          ? 'bg-emerald-500/15 border border-emerald-500/40 ring-1 ring-emerald-500/20'
                          : events.length > 0
                            ? 'bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/30'
                            : 'bg-zinc-900/30 hover:bg-zinc-800/40 border border-transparent'
                      }`}
                    >
                      <span className={`text-xs font-medium ${
                        isToday ? 'bg-emerald-500 text-white rounded-full w-5 h-5 flex items-center justify-center' :
                        isWeekend ? (dayOfWeek === 0 ? 'text-red-400/70' : 'text-blue-400/70') :
                        'text-zinc-400'
                      }`}>
                        {day}
                      </span>
                      {events.length > 0 && (
                        <div className="mt-auto">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-[10px] text-emerald-400 font-medium">{events.length}건</span>
                          </div>
                          <div className="text-[9px] text-zinc-500 truncate">
                            {events.slice(0, 2).map(e => e.symbol).join(', ')}
                            {events.length > 2 && '...'}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Side Panel: Selected Date Detail */}
            <div className="lg:col-span-1">
              <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4 sticky top-20">
                {selectedDate ? (
                  <>
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      {selectedDate} 배당락
                    </h3>
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
                              {ev.price && (
                                <div className="text-zinc-400">주가: <span className="text-zinc-300">${ev.price.toFixed(2)}</span></div>
                              )}
                              {ev.dividendYield != null && (
                                <div className="text-zinc-400">수익률: <span className="text-emerald-400">{ev.dividendYield.toFixed(2)}%</span></div>
                              )}
                              {ev.paymentDate && (
                                <div className="text-zinc-400">지급일: <span className="text-zinc-300">{formatDate(ev.paymentDate)}</span></div>
                              )}
                              {ev.recordDate && (
                                <div className="text-zinc-400">기록일: <span className="text-zinc-300">{formatDate(ev.recordDate)}</span></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 text-[10px] text-zinc-600 text-center">
                      총 {selectedEvents.length}건
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-10 h-10 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                    </svg>
                    <p className="text-sm text-zinc-500">날짜를 클릭하세요</p>
                    <p className="text-[10px] text-zinc-600 mt-1">배당락일 종목 상세 확인</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* List View */}
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
                    <th className="px-3 py-3 text-left">기록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {allEvents.map((ev, idx) => (
                    <tr key={`${ev.symbol}-${ev.exDividendDate}-${idx}`} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-2 text-zinc-300 whitespace-nowrap">{ev.exDividendDate}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-white">{ev.symbol}</div>
                        <div className="text-[10px] text-zinc-500 truncate max-w-[200px]">{ev.name}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400">${ev.dividend.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">
                        {ev.price ? `$${ev.price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400">
                        {ev.dividendYield != null ? `${ev.dividendYield.toFixed(2)}%` : '-'}
                      </td>
                      <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                        {ev.paymentDate || '-'}
                      </td>
                      <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                        {ev.recordDate || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allEvents.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                이번 달 배당 이벤트가 없습니다
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
