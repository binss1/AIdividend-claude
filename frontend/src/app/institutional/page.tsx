'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, API_ENDPOINTS } from '@/config/api';

// ============================================================
// Types
// ============================================================
interface InstitutionalHolder {
  rank: number;
  holder: string;
  shares: number;
  dateReported: string;
  change: number;
  weightPercent: number;
  ownershipPct: number;
  changeType: 'new' | 'sold_out' | 'increased' | 'decreased' | 'unchanged';
}

interface InstitutionalSummary {
  totalHolders: number;
  displayedHolders: number;
  totalShares: number;
  topHolder: string | null;
  topHolderShares: number;
  latestDate: string | null;
  netShareChange: number;
  newPositions: number;
  exitPositions: number;
  increased: number;
  decreased: number;
}

interface ChartData {
  dates: string[];
  institutions: { name: string; data: (number | null)[] }[];
  quarterly: { date: string; totalHolders: number; totalShares: number }[];
}

interface InstitutionalData {
  symbol: string;
  holders: InstitutionalHolder[];
  summary: InstitutionalSummary;
  chartData?: ChartData;
}

// ============================================================
// Constants
// ============================================================
const POPULAR_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM', 'AVGO', 'BRK.B'];
const RECENT_KEY = 'institutional_recent_symbols';

// ============================================================
// Helpers
// ============================================================
function fmtShares(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function changeTypeLabel(type: string): { label: string; cls: string } {
  switch (type) {
    case 'new':       return { label: '신규',  cls: 'bg-sky-500/15 text-sky-400' };
    case 'sold_out':  return { label: '청산',  cls: 'bg-red-500/15 text-red-400' };
    case 'increased': return { label: '증가',  cls: 'bg-emerald-500/15 text-emerald-400' };
    case 'decreased': return { label: '감소',  cls: 'bg-orange-500/15 text-orange-400' };
    default:          return { label: '변동없음', cls: 'bg-zinc-700/50 text-zinc-400' };
  }
}

function getRecentSymbols(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentSymbol(sym: string) {
  try {
    const list = [sym, ...getRecentSymbols().filter(s => s !== sym)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

// ============================================================
// Sub-components
// ============================================================
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <svg className="w-7 h-7 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function SummaryCards({ summary, symbol }: { summary: InstitutionalSummary; symbol: string }) {
  const netDir = summary.netShareChange > 0 ? 'positive' : summary.netShareChange < 0 ? 'negative' : 'neutral';
  const cards = [
    {
      label: '총 기관 수 (13F 보고)',
      value: summary.totalHolders.toLocaleString(),
      sub: `상위 ${summary.displayedHolders}개 표시`,
      color: 'text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      label: '총 보유 주식수 (상위 25개)',
      value: fmtShares(summary.totalShares),
      sub: `최근 보고일: ${summary.latestDate ?? '-'}`,
      color: 'text-indigo-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      ),
    },
    {
      label: '최대 보유 기관',
      value: summary.topHolder ?? '-',
      sub: summary.topHolder ? fmtShares(summary.topHolderShares) + '주' : '',
      color: 'text-amber-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
      ),
    },
    {
      label: '순 주식수 변동',
      value: (netDir === 'positive' ? '+' : '') + fmtShares(summary.netShareChange),
      sub: `증가 ${summary.increased}  /  감소 ${summary.decreased}`,
      color: netDir === 'positive' ? 'text-emerald-400' : netDir === 'negative' ? 'text-red-400' : 'text-zinc-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4 flex gap-3 items-start">
          <div className="mt-0.5 shrink-0 text-zinc-600">{c.icon}</div>
          <div className="min-w-0">
            <div className={`text-lg font-bold truncate ${c.color}`}>{c.value}</div>
            <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{c.label}</div>
            {c.sub && <div className="text-[10px] text-zinc-600 mt-0.5">{c.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function InstitutionalPage() {
  const [inputValue, setInputValue] = useState('');
  const [symbol, setSymbol] = useState('');
  const [data, setData] = useState<InstitutionalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'bar' | 'trend'>('table');
  const [sortKey, setSortKey] = useState<'rank' | 'shares' | 'change'>('rank');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentSymbols(getRecentSymbols());
  }, []);

  const fetchData = useCallback(async (sym: string) => {
    const s = sym.toUpperCase().trim();
    if (!s) return;
    setSymbol(s);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await apiFetch<InstitutionalData>(
        `${API_ENDPOINTS.INSTITUTIONAL_HOLDERS}?symbol=${encodeURIComponent(s)}`
      );
      setData(result);
      addRecentSymbol(s);
      setRecentSymbols(getRecentSymbols());
    } catch (err) {
      setError(`${s} 데이터를 불러오는 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(inputValue);
  };

  const sortedHolders = data?.holders ? [...data.holders].sort((a, b) => {
    if (sortKey === 'shares')  return b.shares  - a.shares;
    if (sortKey === 'change')  return b.change  - a.change;
    return a.rank - b.rank;
  }) : [];

  // 바 차트용 최대값
  const maxShares = data?.holders?.[0]?.shares ?? 1;

  return (
    <div className="min-h-screen bg-gray-950 pt-20 pb-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </span>
            기관투자자 추적 (13F)
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            기관투자자의 최신 13F 보고 기준 보유현황 · 변동 내역을 확인하세요
          </p>
        </div>

        {/* Search */}
        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-5 mb-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value.toUpperCase())}
              placeholder="종목 티커 입력 (예: AAPL, MSFT, NVDA)"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || loading}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              조회
            </button>
          </form>

          {/* Quick picks */}
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-zinc-600">인기:</span>
            {POPULAR_SYMBOLS.map(s => (
              <button
                key={s}
                onClick={() => { setInputValue(s); fetchData(s); }}
                className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-indigo-500/15 hover:text-indigo-400 text-zinc-400 border border-zinc-700/60 hover:border-indigo-500/40 transition-colors"
              >
                {s}
              </button>
            ))}
            {recentSymbols.length > 0 && (
              <>
                <span className="text-xs text-zinc-600 ml-2">최근:</span>
                {recentSymbols.map(s => (
                  <button
                    key={`r-${s}`}
                    onClick={() => { setInputValue(s); fetchData(s); }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800/50 hover:bg-indigo-500/10 hover:text-indigo-400 text-zinc-500 border border-zinc-800 hover:border-indigo-500/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && <Spinner />}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-5 py-4 text-sm text-red-400">{error}</div>
        )}

        {/* Empty result */}
        {!loading && data && data.holders.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-zinc-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="font-medium">{symbol}에 대한 13F 보고 데이터가 없습니다.</p>
            <p className="text-xs mt-1 text-zinc-600">소형주 또는 FMP 데이터 미지원 종목일 수 있습니다.</p>
          </div>
        )}

        {/* Results */}
        {!loading && data && data.holders.length > 0 && (
          <div className="space-y-5">
            {/* Summary cards */}
            <SummaryCards summary={data.summary} symbol={data.symbol} />

            {/* Position changes summary */}
            <div className="flex flex-wrap gap-3 mb-1">
              {[
                { label: '신규 편입', value: data.summary.newPositions,  cls: 'bg-sky-500/10 border-sky-500/30 text-sky-400' },
                { label: '완전 청산', value: data.summary.exitPositions, cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
                { label: '지분 증가', value: data.summary.increased,     cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
                { label: '지분 감소', value: data.summary.decreased,     cls: 'bg-orange-500/10 border-orange-500/30 text-orange-400' },
              ].map(item => (
                <div key={item.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${item.cls}`}>
                  <span className="text-lg font-bold">{item.value}</span>
                  <span className="text-xs opacity-80">{item.label}</span>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-1 text-xs text-zinc-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                13F 보고 기준 최신 분기 데이터 (SEC 제출 기준)
              </div>
            </div>

            {/* View / Sort controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">
                상위 기관투자자 보유현황
                <span className="ml-2 text-xs text-zinc-500 font-normal">({data.symbol} · {data.summary.latestDate})</span>
              </h2>
              <div className="flex gap-2">
                {/* Sort */}
                <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                  {([
                    { k: 'rank',   label: '보유순' },
                    { k: 'change', label: '변동순' },
                  ] as const).map(s => (
                    <button
                      key={s.k}
                      onClick={() => setSortKey(s.k)}
                      className={`px-3 py-1.5 text-xs transition-colors ${sortKey === s.k ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {/* View */}
                <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                  {([
                    { k: 'table', label: '테이블' },
                    { k: 'bar',   label: '분포 차트' },
                    { k: 'trend', label: '분기 추이' },
                  ] as const).map(v => (
                    <button
                      key={v.k}
                      onClick={() => setViewMode(v.k)}
                      className={`px-3 py-1.5 text-xs transition-colors ${viewMode === v.k ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800/60 text-xs text-zinc-500">
                        <th className="px-4 py-3 text-left w-8">#</th>
                        <th className="px-3 py-3 text-left">기관명</th>
                        <th className="px-3 py-3 text-right">보유 주식수</th>
                        <th className="px-3 py-3 text-right">변동 (주)</th>
                        <th className="px-3 py-3 text-center">유형</th>
                        <th className="px-3 py-3 text-right">포트폴리오 비중</th>
                        <th className="px-3 py-3 text-right">상위 25 비중</th>
                        <th className="px-3 py-3 text-left">보고일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/30">
                      {sortedHolders.map(h => {
                        const ct = changeTypeLabel(h.changeType);
                        return (
                          <tr key={h.holder} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className="text-zinc-500 text-xs">{h.rank}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-medium text-white">{h.holder}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="text-zinc-300 font-medium">{fmtShares(h.shares)}</span>
                              {/* 미니 바 */}
                              <div className="mt-1 w-full bg-zinc-800 rounded-full h-0.5">
                                <div
                                  className="bg-indigo-400 h-0.5 rounded-full"
                                  style={{ width: `${Math.min((h.shares / maxShares) * 100, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={h.change > 0 ? 'text-emerald-400' : h.change < 0 ? 'text-red-400' : 'text-zinc-500'}>
                                {h.change > 0 ? '+' : ''}{fmtShares(h.change)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ct.cls}`}>{ct.label}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-zinc-400 text-xs">
                              {h.weightPercent > 0 ? `${h.weightPercent.toFixed(2)}%` : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-indigo-400 text-xs font-medium">
                              {h.ownershipPct.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">{h.dateReported}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bar Chart View */}
            {viewMode === 'bar' && (
              <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-5 space-y-3">
                {sortedHolders.slice(0, 15).map(h => {
                  const pct = Math.min((h.shares / maxShares) * 100, 100);
                  const ct  = changeTypeLabel(h.changeType);
                  return (
                    <div key={h.holder} className="group">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-zinc-600 w-5 text-right shrink-0">{h.rank}</span>
                          <span className="text-sm text-white font-medium truncate">{h.holder}</span>
                          <span className={`text-[10px] px-1 py-0.5 rounded font-medium shrink-0 ${ct.cls}`}>{ct.label}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="text-indigo-300 font-semibold">{fmtShares(h.shares)}</span>
                          <span className={h.change > 0 ? 'text-emerald-400' : h.change < 0 ? 'text-red-400' : 'text-zinc-600'}>
                            {h.change > 0 ? '▲' : h.change < 0 ? '▼' : '–'}
                            {h.change !== 0 ? fmtShares(Math.abs(h.change)) : ''}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {sortedHolders.length > 15 && (
                  <p className="text-xs text-zinc-600 text-center pt-1">
                    차트에는 상위 15개만 표시 · 전체는 테이블 보기에서 확인
                  </p>
                )}
              </div>
            )}

            {/* Trend Chart View */}
            {viewMode === 'trend' && (() => {
              const cd = data.chartData;
              if (!cd || cd.dates.length < 2) {
                return (
                  <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-8 text-center text-zinc-500">
                    <p className="text-sm">분기별 추이 데이터가 충분하지 않습니다.</p>
                    <p className="text-xs mt-1 text-zinc-600">최소 2개 분기 데이터가 필요합니다.</p>
                  </div>
                );
              }

              const COLORS = ['#818cf8','#34d399','#fb923c','#f472b6','#38bdf8'];
              const fmtDate = (d: string) => {
                const [y, m] = d.split('-');
                return `${y.slice(2)}Q${Math.ceil(parseInt(m) / 3)}`;
              };

              // 상위 기관 추이 차트 (SVG line chart)
              const instData = cd.institutions.filter(inst =>
                inst.data.some(v => v != null)
              );
              const allVals = instData.flatMap(i => i.data.filter((v): v is number => v != null));
              const maxVal = Math.max(...allVals, 1); // 0 방지: 모든 값이 0인 경우 SVG 나눗셈 오류 방지

              const W = 500, H = 200, PL = 60, PR = 20, PT = 20, PB = 30;
              const chartW = W - PL - PR;
              const chartH = H - PT - PB;
              const xStep = cd.dates.length > 1 ? chartW / (cd.dates.length - 1) : chartW;

              const toX = (i: number) => PL + i * xStep;
              const toY = (v: number) => PT + chartH - (v / maxVal) * chartH;

              // 총 기관 수 + 총 보유량 추이 (bar)
              const maxHolders = Math.max(...cd.quarterly.map(q => q.totalHolders));
              const maxTotalShares = Math.max(...cd.quarterly.map(q => q.totalShares));

              return (
                <div className="space-y-4">
                  {/* 상위 5개 기관 보유량 추이 */}
                  <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-5">
                    <h3 className="text-sm font-semibold text-white mb-1">상위 기관 보유량 추이 (분기별)</h3>
                    <p className="text-[10px] text-zinc-600 mb-4">최신 분기 기준 상위 5개 기관 · 최대 8분기</p>
                    <div className="overflow-x-auto">
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
                        {/* 그리드 라인 */}
                        {[0, 0.25, 0.5, 0.75, 1].map(r => {
                          const y = PT + chartH * (1 - r);
                          return (
                            <g key={r}>
                              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#27272a" strokeWidth="1" />
                              <text x={PL - 6} y={y + 4} fill="#71717a" fontSize="9" textAnchor="end">
                                {fmtShares(maxVal * r)}
                              </text>
                            </g>
                          );
                        })}
                        {/* X축 날짜 */}
                        {cd.dates.map((d, i) => (
                          <text key={d} x={toX(i)} y={H - 6} fill="#71717a" fontSize="9" textAnchor="middle">
                            {fmtDate(d)}
                          </text>
                        ))}
                        {/* 라인 + 포인트 */}
                        {instData.map((inst, ci) => {
                          const color = COLORS[ci % COLORS.length];
                          const points: [number, number][] = [];
                          inst.data.forEach((v, i) => {
                            if (v != null) points.push([toX(i), toY(v)]);
                          });
                          if (points.length < 1) return null;
                          const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
                          return (
                            <g key={inst.name}>
                              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              {points.map((p, pi) => (
                                <circle key={pi} cx={p[0]} cy={p[1]} r="3" fill={color} />
                              ))}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    {/* 범례 */}
                    <div className="flex flex-wrap gap-3 mt-3">
                      {instData.map((inst, ci) => (
                        <div key={inst.name} className="flex items-center gap-1.5">
                          <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS[ci % COLORS.length] }} />
                          <span className="text-[10px] text-zinc-400 truncate max-w-[140px]">{inst.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 분기별 전체 기관 수 + 총 보유주식수 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 총 기관 수 */}
                    <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
                      <h3 className="text-xs font-semibold text-white mb-3">분기별 보고 기관 수</h3>
                      <div className="space-y-2">
                        {cd.quarterly.map((q) => {
                          const pct = maxHolders > 0 ? (q.totalHolders / maxHolders) * 100 : 0;
                          const isLatest = q.date === cd.dates[cd.dates.length - 1];
                          return (
                            <div key={q.date}>
                              <div className="flex justify-between text-[10px] mb-0.5">
                                <span className={isLatest ? 'text-indigo-400 font-semibold' : 'text-zinc-500'}>{fmtDate(q.date)}</span>
                                <span className={isLatest ? 'text-white font-bold' : 'text-zinc-400'}>{q.totalHolders.toLocaleString()}개</span>
                              </div>
                              <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${isLatest ? 'bg-indigo-500' : 'bg-indigo-500/40'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* 총 보유주식수 */}
                    <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
                      <h3 className="text-xs font-semibold text-white mb-3">분기별 총 보유 주식수 (13F 보고)</h3>
                      <div className="space-y-2">
                        {cd.quarterly.map((q) => {
                          const pct = maxTotalShares > 0 ? (q.totalShares / maxTotalShares) * 100 : 0;
                          const isLatest = q.date === cd.dates[cd.dates.length - 1];
                          return (
                            <div key={q.date}>
                              <div className="flex justify-between text-[10px] mb-0.5">
                                <span className={isLatest ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>{fmtDate(q.date)}</span>
                                <span className={isLatest ? 'text-white font-bold' : 'text-zinc-400'}>{fmtShares(q.totalShares)}</span>
                              </div>
                              <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${isLatest ? 'bg-emerald-500' : 'bg-emerald-500/40'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 하단 설명 */}
            <p className="text-xs text-zinc-700 text-center pt-1">
              데이터 출처: SEC 13F 공시 기반 FMP API · 분기별 업데이트 (약 45일 지연)
            </p>
          </div>
        )}

        {/* Initial empty state */}
        {!loading && !data && !error && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-indigo-500/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">기관투자자 보유현황 조회</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              SEC에 제출된 13F 보고서를 기반으로 기관투자자의 보유 주식수,
              증감 내역, 포트폴리오 비중을 확인할 수 있습니다.
            </p>
            <p className="text-zinc-600 text-xs mt-3">
              위 검색창에 종목 티커를 입력하거나 인기 종목을 클릭하세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
