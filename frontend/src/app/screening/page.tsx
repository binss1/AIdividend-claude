'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_ENDPOINTS } from '@/config/api';
import { ScreenedStock, ScreeningProgress as ScreeningProgressType } from '@/types';
import ScreeningProgress from '@/components/ScreeningProgress';
import GradeBadge from '@/components/GradeBadge';
import ScoreBar from '@/components/ScoreBar';

type SortField = 'overallScore' | 'dividendYield' | 'payoutRatio' | 'marketCap' | 'currentPrice' | 'pe' | 'roe' | 'symbol' | 'name';
type SortDir = 'asc' | 'desc';

const MARKET_CAP_OPTIONS = [
  { label: '$500M', value: 500_000_000 },
  { label: '$1B', value: 1_000_000_000 },
  { label: '$5B', value: 5_000_000_000 },
  { label: '$10B', value: 10_000_000_000 },
];

const CACHE_KEY = 'stock_screening_results';
const CACHE_TIME_KEY = 'stock_screening_results_time';

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

// dividendYield and payoutRatio are already in % (e.g. 3.5 means 3.5%)
function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function StockScreeningPage() {
  const router = useRouter();

  // Filter state
  const [minYield, setMinYield] = useState(2);
  const [minMarketCap, setMinMarketCap] = useState(1_000_000_000);
  const [maxPayoutRatio, setMaxPayoutRatio] = useState(85);
  const [maxStocks, setMaxStocks] = useState(500);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Screening state
  const [isScreening, setIsScreening] = useState(false);
  const [progress, setProgress] = useState<ScreeningProgressType>({
    status: 'idle',
    totalStocks: 0,
    processedStocks: 0,
    foundStocks: 0,
    progress: 0,
  });
  const [results, setResults] = useState<ScreenedStock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Table state
  const [sortField, setSortField] = useState<SortField>('overallScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Load cached results on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime) {
        const age = Date.now() - parseInt(cachedTime);
        // Cache valid for 1 hour
        if (age < 3600000) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setResults(parsed);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async () => {
    try {
      const data = await apiFetch<ScreeningProgressType>(API_ENDPOINTS.STOCKS_PROGRESS);
      setProgress(data);

      if (data.status === 'completed') {
        stopPolling();
        setIsScreening(false);
        // Results come directly from progress endpoint
        if (data.results && data.results.length > 0) {
          setResults(data.results);
          localStorage.setItem(CACHE_KEY, JSON.stringify(data.results));
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        }
      } else if (data.status === 'error') {
        stopPolling();
        setIsScreening(false);
        setError(data.error || '스크리닝 중 오류가 발생했습니다.');
      }
    } catch {
      // Keep polling on transient errors
    }
  }, [stopPolling]);

  const startScreening = async () => {
    setError(null);
    setIsScreening(true);
    setResults([]);
    setProgress({
      status: 'running',
      totalStocks: maxStocks,
      processedStocks: 0,
      foundStocks: 0,
      progress: 0,
    });

    try {
      // Backend expects: minDividendYield in % (2 = 2%), maxPayoutRatio in % (85 = 85%)
      const params = new URLSearchParams({
        minDividendYield: minYield.toString(),
        minMarketCapUSD: minMarketCap.toString(),
        maxPayoutRatio: maxPayoutRatio.toString(),
        maxStocksToCheck: maxStocks.toString(),
        batchSize: '10',
      });

      await apiFetch(`${API_ENDPOINTS.STOCKS_SCREEN}?${params.toString()}`);

      // Start polling progress
      pollingRef.current = setInterval(pollProgress, 2000);
    } catch (err) {
      setIsScreening(false);
      setError('스크리닝을 시작할 수 없습니다. 서버 연결을 확인해 주세요.');
      console.error(err);
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Sort & filter logic
  const filteredResults = useMemo(() => {
    let data = [...results];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const aVal = a[sortField as keyof ScreenedStock];
      const bVal = b[sortField as keyof ScreenedStock];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aLower = aVal.toLowerCase();
        const bLower = bVal.toLowerCase();
        return sortDir === 'asc' ? (aLower < bLower ? -1 : 1) : aLower > bLower ? -1 : 1;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return data;
  }, [results, searchQuery, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData = filteredResults.map((s, i) => ({
      '순위': i + 1,
      '티커': s.symbol,
      '종목명': s.name,
      '거래소': s.exchange,
      '섹터': s.sector,
      '현재가($)': s.currentPrice,
      '배당수익률(%)': s.dividendYield.toFixed(2),
      '연간배당($)': s.annualDividend.toFixed(2),
      '배당성향(%)': s.payoutRatio.toFixed(1),
      '연속배당(년)': s.consecutiveDividendYears,
      '시가총액': formatMarketCap(s.marketCap),
      'P/E': s.pe.toFixed(2),
      'ROE(%)': s.roe.toFixed(2),
      'EPS': s.eps.toFixed(2),
      'Beta': s.beta.toFixed(2),
      '부채비율': s.debtToEquity.toFixed(2),
      '종합점수': s.overallScore.toFixed(1),
      '등급': s.grade,
      'REIT 여부': s.isREIT ? 'Y' : 'N',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Auto-adjust column widths
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length + 2, 12),
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '배당주 스크리닝');
    XLSX.writeFile(wb, `배당주_스크리닝_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-zinc-600 ml-1 inline-block w-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">&#8693;</span>;
    }
    return (
      <span className="text-emerald-400 ml-1 inline-block w-3 text-center">
        {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              배당주 스크리닝
            </h1>
          </div>
          <p className="mt-2 text-zinc-400 text-sm">
            AI 기반 배당주 분석 시스템 - 배당수익률, 배당성향, 재무건전성을 종합 평가합니다
          </p>
        </div>

        {/* Filter Panel - Glass Card */}
        <div className="mb-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-zinc-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              <span className="font-medium">필터 설정</span>
            </div>
            <svg
              className={`h-5 w-5 text-zinc-400 transition-transform duration-300 ${filtersOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <div
            className={`border-t border-zinc-800 transition-all duration-300 ease-in-out ${
              filtersOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden border-t-0'
            }`}
          >
            <div className="px-6 py-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* Min Dividend Yield */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3">
                    최소 배당수익률
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={minYield}
                      onChange={(e) => setMinYield(parseFloat(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none bg-zinc-700 accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 min-w-[72px]">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.1}
                        value={minYield}
                        onChange={(e) => setMinYield(parseFloat(e.target.value) || 0)}
                        className="w-10 bg-transparent text-sm text-right text-emerald-400 font-mono outline-none"
                      />
                      <span className="text-zinc-500 text-sm ml-1">%</span>
                    </div>
                  </div>
                </div>

                {/* Min Market Cap */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3">
                    최소 시가총액
                  </label>
                  <select
                    value={minMarketCap}
                    onChange={(e) => setMinMarketCap(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
                  >
                    {MARKET_CAP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Payout Ratio */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3">
                    최대 배당성향
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={maxPayoutRatio}
                      onChange={(e) => setMaxPayoutRatio(parseFloat(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none bg-zinc-700 accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-sm font-mono text-emerald-400 min-w-[44px] text-right">
                      {maxPayoutRatio}%
                    </span>
                  </div>
                </div>

                {/* Max Stocks */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3">
                    최대 분석 종목수
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    step={10}
                    value={maxStocks}
                    onChange={(e) => setMaxStocks(parseInt(e.target.value) || 500)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-colors"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>배당률 {minYield}%+</span>
                  <span className="text-zinc-700">|</span>
                  <span>시총 {formatMarketCap(minMarketCap)}+</span>
                  <span className="text-zinc-700">|</span>
                  <span>배당성향 ~{maxPayoutRatio}%</span>
                  <span className="text-zinc-700">|</span>
                  <span>{maxStocks}종목</span>
                </div>
                <button
                  onClick={startScreening}
                  disabled={isScreening}
                  className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:from-emerald-500 hover:to-teal-400 hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {isScreening ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      스크리닝 중...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      스크리닝 시작
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        {progress.status !== 'idle' && (
          <div className="mb-6 animate-in fade-in duration-300">
            <ScreeningProgress
              status={progress.status}
              currentSymbol={progress.currentSymbol ?? null}
              processed={progress.processedStocks}
              total={progress.totalStocks}
              found={progress.foundStocks}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-800/50 bg-red-950/30 backdrop-blur-sm p-4 flex items-center justify-between animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <span className="text-sm text-red-300">{error}</span>
            </div>
            <button
              onClick={startScreening}
              className="rounded-lg border border-red-700/50 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/30 transition-colors"
            >
              재시도
            </button>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20 animate-in fade-in duration-500">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-zinc-800/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                </div>
                <span className="text-sm text-zinc-400">
                  총 <span className="text-emerald-400 font-semibold">{filteredResults.length}</span>개 종목
                  {searchQuery && results.length !== filteredResults.length && (
                    <span className="text-zinc-600 ml-1">(전체 {results.length}개)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="종목명, 티커, 섹터 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800/80 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-56 transition-colors"
                  />
                </div>
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 hover:border-zinc-600 transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Excel
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-12">
                      #
                    </th>
                    <th
                      className="group px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('symbol')}
                    >
                      티커 <SortIcon field="symbol" />
                    </th>
                    <th
                      className="group px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      종목명 <SortIcon field="name" />
                    </th>
                    <th
                      className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('currentPrice')}
                    >
                      현재가 <SortIcon field="currentPrice" />
                    </th>
                    <th
                      className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('dividendYield')}
                    >
                      배당수익률 <SortIcon field="dividendYield" />
                    </th>
                    <th
                      className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('payoutRatio')}
                    >
                      배당성향 <SortIcon field="payoutRatio" />
                    </th>
                    <th
                      className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('marketCap')}
                    >
                      시가총액 <SortIcon field="marketCap" />
                    </th>
                    <th
                      className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('pe')}
                    >
                      P/E <SortIcon field="pe" />
                    </th>
                    <th
                      className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('roe')}
                    >
                      ROE <SortIcon field="roe" />
                    </th>
                    <th
                      className="group px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 min-w-[140px] transition-colors"
                      onClick={() => handleSort('overallScore')}
                    >
                      점수 <SortIcon field="overallScore" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      등급
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {filteredResults.map((stock, idx) => (
                    <tr
                      key={stock.symbol}
                      onClick={() => router.push(`/stock/${stock.symbol}`)}
                      className="hover:bg-emerald-500/[0.03] cursor-pointer transition-colors duration-150"
                    >
                      <td className="px-4 py-3 text-zinc-600 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100 font-mono text-xs">
                            {stock.symbol}
                          </span>
                          {stock.isREIT && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 font-medium">
                              REIT
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[180px] truncate text-xs">
                        {stock.name}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-300 text-xs">
                        {formatPrice(stock.currentPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-emerald-400 font-mono text-xs">
                          {formatPercent(stock.dividendYield)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">
                        {formatPercent(stock.payoutRatio)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">
                        {formatMarketCap(stock.marketCap)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">
                        {stock.pe > 0 ? stock.pe.toFixed(1) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span className={stock.roe >= 15 ? 'text-emerald-400' : stock.roe >= 10 ? 'text-zinc-300' : 'text-zinc-500'}>
                          {stock.roe.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar score={stock.overallScore} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <GradeBadge grade={stock.grade} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            {filteredResults.length > 0 && (
              <div className="border-t border-zinc-800/60 px-6 py-3 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  평균 배당수익률: <span className="text-emerald-400 font-mono">{(filteredResults.reduce((sum, s) => sum + s.dividendYield, 0) / filteredResults.length).toFixed(2)}%</span>
                </span>
                <span>
                  평균 점수: <span className="text-emerald-400 font-mono">{(filteredResults.reduce((sum, s) => sum + s.overallScore, 0) / filteredResults.length).toFixed(1)}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isScreening && results.length === 0 && progress.status === 'idle' && !error && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-16 text-center shadow-xl shadow-black/20">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <svg className="h-10 w-10 text-emerald-500/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">
              배당주 스크리닝을 시작해 보세요
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
              필터를 설정하고 스크리닝을 시작하면 AI가 배당수익률, 배당성향, 재무건전성 등을
              종합 분석하여 최적의 배당주를 찾아드립니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
