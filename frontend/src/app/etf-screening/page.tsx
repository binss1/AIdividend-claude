'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { apiFetch, API_ENDPOINTS } from '@/config/api';
import { ScreenedETF, ETFScreeningProgress as ETFProgressType } from '@/types';
import ScreeningProgress from '@/components/ScreeningProgress';
import ScoreBar from '@/components/ScoreBar';

type SortField = 'totalScore' | 'dividendYield' | 'expenseRatio' | 'aum' | 'price' | 'symbol' | 'name';
type SortDir = 'asc' | 'desc';

const AUM_OPTIONS = [
  { label: '$100M', value: 100_000_000 },
  { label: '$500M', value: 500_000_000 },
  { label: '$1B', value: 1_000_000_000 },
  { label: '$5B', value: 5_000_000_000 },
];

const CACHE_KEY = 'etf_screening_results';
const CACHE_TIME_KEY = 'etf_screening_results_time';

const RADAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b'];

const QLEAD_COLORS = {
  quality: { bar: 'bg-emerald-500', bg: 'bg-emerald-500/15', text: 'text-emerald-400', shortLabel: 'Q' },
  liquidity: { bar: 'bg-blue-500', bg: 'bg-blue-500/15', text: 'text-blue-400', shortLabel: 'L' },
  exposure: { bar: 'bg-amber-500', bg: 'bg-amber-500/15', text: 'text-amber-400', shortLabel: 'E' },
  dividend: { bar: 'bg-purple-500', bg: 'bg-purple-500/15', text: 'text-purple-400', shortLabel: 'D' },
};

function formatAum(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

// ETF dividendYield and expenseRatio are in decimal (0.035 = 3.5%)
function formatDecimalPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function getOverallGrade(etf: ScreenedETF): string {
  // Determine best grade from the 4 Q-LEAD dimensions
  const grades = [etf.qualityGrade, etf.liquidityGrade, etf.exposureGrade, etf.dividendGrade];
  const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
  let bestIdx = gradeOrder.length - 1;
  for (const g of grades) {
    const idx = gradeOrder.indexOf(g);
    if (idx !== -1 && idx < bestIdx) bestIdx = idx;
  }
  // Average approach: use totalScore to determine
  if (etf.totalScore >= 85) return 'A+';
  if (etf.totalScore >= 75) return 'A';
  if (etf.totalScore >= 65) return 'B+';
  if (etf.totalScore >= 55) return 'B';
  if (etf.totalScore >= 40) return 'C';
  return 'D';
}

export default function ETFScreeningPage() {
  const router = useRouter();

  // Filter state
  const [minYield, setMinYield] = useState(2);
  const [minAum, setMinAum] = useState(500_000_000);
  const [maxExpenseRatio, setMaxExpenseRatio] = useState(0.5);
  const [maxCount, setMaxCount] = useState(200);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Universe info - re-fetch when AUM filter changes (pre-filtering)
  const [universeInfo, setUniverseInfo] = useState<{ stockTotal: number; etfTotal: number; rate: number } | null>(null);
  const [loadingUniverse, setLoadingUniverse] = useState(false);

  useEffect(() => {
    setLoadingUniverse(true);
    const params = new URLSearchParams({ minAUM: String(minAum) });
    apiFetch<{ stockTotal: number; etfTotal: number; rate: number }>(API_ENDPOINTS.UNIVERSE_INFO + '?' + params)
      .then((data) => { setUniverseInfo(data); setLoadingUniverse(false); })
      .catch(() => { setUniverseInfo({ stockTotal: 3500, etfTotal: 500, rate: 1400 }); setLoadingUniverse(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minAum]);

  const krwRate = universeInfo?.rate ?? 1400;

  function formatKRW(usd: number): string {
    const krw = usd * krwRate;
    if (krw >= 1e12) return `약 ${(krw / 1e12).toFixed(1)}조원`;
    if (krw >= 1e8) return `약 ${(krw / 1e8).toFixed(0)}억원`;
    return `약 ${Math.round(krw).toLocaleString()}원`;
  }

  // Screening state
  const [isScreening, setIsScreening] = useState(false);
  const [progress, setProgress] = useState<ETFProgressType>({
    status: 'idle',
    totalETFs: 0,
    processedETFs: 0,
    foundETFs: 0,
    progress: 0,
  });
  const [results, setResults] = useState<ScreenedETF[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Table state
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Radar comparison
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // Q-LEAD breakdown expand
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Load cached results
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime) {
        const age = Date.now() - parseInt(cachedTime);
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
      const data = await apiFetch<ETFProgressType>(API_ENDPOINTS.ETFS_PROGRESS);
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
        setError(data.error || 'ETF 스크리닝 중 오류가 발생했습니다.');
      }
    } catch {
      // Keep polling on transient errors
    }
  }, [stopPolling]);

  const startScreening = async () => {
    setError(null);
    setIsScreening(true);
    setResults([]);
    setSelectedForCompare([]);
    setProgress({
      status: 'running',
      totalETFs: maxCount,
      processedETFs: 0,
      foundETFs: 0,
      progress: 0,
    });

    try {
      // Backend expects: minDividendYield as decimal (0.02 = 2%), maxExpenseRatio as decimal (0.005 = 0.5%)
      await apiFetch(API_ENDPOINTS.ETFS_SCREEN, {
        method: 'POST',
        body: JSON.stringify({
          minDividendYield: minYield / 100,        // UI % -> decimal
          minAUM: minAum,
          maxExpenseRatio: maxExpenseRatio / 100,   // UI % -> decimal
          maxETFsToCheck: maxCount,
          sortBy: 'totalScore',
          limit: 50,
        }),
      });

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

  // Sort & filter
  const filteredResults = useMemo(() => {
    let data = [...results];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (e) =>
          e.symbol.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const aVal = a[sortField as keyof ScreenedETF];
      const bVal = b[sortField as keyof ScreenedETF];

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

  const toggleCompare = (symbol: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(symbol)) {
        return prev.filter((t) => t !== symbol);
      }
      if (prev.length >= 3) return prev;
      return [...prev, symbol];
    });
  };

  // Radar chart data - using actual Q-LEAD individual scores
  const radarData = useMemo(() => {
    const compared = results.filter((e) => selectedForCompare.includes(e.symbol));
    if (compared.length === 0) return [];

    const axes = [
      { key: 'qualityScore', label: 'Quality (Q)' },
      { key: 'liquidityScore', label: 'Liquidity (L)' },
      { key: 'exposureScore', label: 'Exposure (E)' },
      { key: 'dividendScore', label: 'Dividend (D)' },
    ];

    return axes.map((axis) => {
      const point: Record<string, string | number> = { subject: axis.label };
      compared.forEach((etf) => {
        point[etf.symbol] = etf[axis.key as keyof ScreenedETF] as number;
      });
      return point;
    });
  }, [results, selectedForCompare]);

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData = filteredResults.map((e, i) => ({
      '순위': i + 1,
      '티커': e.symbol,
      'ETF명': e.name,
      '가격($)': e.price.toFixed(2),
      'AUM': formatAum(e.aum),
      '배당수익률(%)': (e.dividendYield * 100).toFixed(2),
      '운용보수(%)': (e.expenseRatio * 100).toFixed(3),
      'Q-Quality': e.qualityScore.toFixed(1),
      'L-Liquidity': e.liquidityScore.toFixed(1),
      'E-Exposure': e.exposureScore.toFixed(1),
      'D-Dividend': e.dividendScore.toFixed(1),
      'Q-LEAD 총점': e.totalScore.toFixed(1),
      'Quality 등급': e.qualityGrade,
      'Liquidity 등급': e.liquidityGrade,
      'Exposure 등급': e.exposureGrade,
      'Dividend 등급': e.dividendGrade,
      '보유종목수': e.holdingsCount ?? '-',
      'Top10 비중(%)': e.top10Concentration != null ? (e.top10Concentration * 100).toFixed(1) : '-',
      '5Y 배당성장(%)': e.dividendGrowth5Y != null ? (e.dividendGrowth5Y * 100).toFixed(1) : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length + 2, 12),
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ETF 스크리닝');
    XLSX.writeFile(wb, `ETF_스크리닝_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  // Q-LEAD mini bar component
  const QLeadBars = ({ etf }: { etf: ScreenedETF }) => {
    const items = [
      { score: etf.qualityScore, label: 'Q', ...QLEAD_COLORS.quality },
      { score: etf.liquidityScore, label: 'L', ...QLEAD_COLORS.liquidity },
      { score: etf.exposureScore, label: 'E', ...QLEAD_COLORS.exposure },
      { score: etf.dividendScore, label: 'D', ...QLEAD_COLORS.dividend },
    ];
    return (
      <div className="flex items-center gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="group/bar relative">
            <div className={`w-6 h-3 rounded-sm ${item.bg} overflow-hidden`}>
              <div
                className={`h-full rounded-sm ${item.bar} transition-all duration-500`}
                style={{ width: `${Math.min(item.score, 100)}%` }}
              />
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/bar:block z-10">
              <div className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 whitespace-nowrap shadow-lg">
                <span className={item.text}>{item.label}</span>: {item.score.toFixed(1)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Q-LEAD expanded breakdown
  const QLeadBreakdown = ({ etf }: { etf: ScreenedETF }) => {
    const breakdownItems = [
      { label: 'Quality', score: etf.qualityScore, grade: etf.qualityGrade, bar: QLEAD_COLORS.quality.bar, bg: QLEAD_COLORS.quality.bg, text: QLEAD_COLORS.quality.text },
      { label: 'Liquidity', score: etf.liquidityScore, grade: etf.liquidityGrade, bar: QLEAD_COLORS.liquidity.bar, bg: QLEAD_COLORS.liquidity.bg, text: QLEAD_COLORS.liquidity.text },
      { label: 'Exposure', score: etf.exposureScore, grade: etf.exposureGrade, bar: QLEAD_COLORS.exposure.bar, bg: QLEAD_COLORS.exposure.bg, text: QLEAD_COLORS.exposure.text },
      { label: 'Dividend', score: etf.dividendScore, grade: etf.dividendGrade, bar: QLEAD_COLORS.dividend.bar, bg: QLEAD_COLORS.dividend.bg, text: QLEAD_COLORS.dividend.text },
    ];
    return (
      <div className="grid grid-cols-4 gap-3 px-4 py-3 bg-zinc-900/50">
        {breakdownItems.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${item.text}`}>{item.label}</span>
              <span className="text-[10px] text-zinc-500">{item.grade}</span>
            </div>
            <div className={`w-full h-2 rounded-full ${item.bg} overflow-hidden`}>
              <div
                className={`h-full rounded-full ${item.bar} transition-all duration-700`}
                style={{ width: `${Math.min(item.score, 100)}%` }}
              />
            </div>
            <div className="text-xs text-zinc-400 font-mono text-right">{item.score.toFixed(1)}</div>
          </div>
        ))}
      </div>
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              ETF 스크리닝
            </h1>
          </div>
          <p className="mt-2 text-zinc-400 text-sm">
            Q-LEAD 모델 기반 ETF 평가 - Quality, Liquidity, Exposure, Dividend 4가지 축으로 분석합니다
          </p>
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {Object.entries(QLEAD_COLORS).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${val.bar}`} />
                  <span className={`text-xs ${val.text}`}>{val.shortLabel}</span>
                </div>
              ))}
            </div>
            <span className="text-zinc-700">|</span>
            <span className="text-xs text-zinc-500">
              <span className="text-emerald-400 font-medium">Q-LEAD</span> = Quality + Liquidity + Exposure + Dividend
            </span>
            <span className="text-zinc-700">|</span>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <span className="rounded bg-orange-500/15 px-1 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/20">CC</span>
              = Covered Call (커버드콜)
            </span>
          </div>
        </div>

        {/* Filter Panel */}
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

                {/* Min AUM */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3">
                    최소 AUM
                  </label>
                  <select
                    value={minAum}
                    onChange={(e) => setMinAum(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer"
                  >
                    {AUM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    ≈ <span className="text-amber-400/80">{formatKRW(minAum)}</span>
                  </p>
                </div>

                {/* Max Expense Ratio */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3">
                    최대 운용보수
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0.05}
                      max={2}
                      step={0.05}
                      value={maxExpenseRatio}
                      onChange={(e) => setMaxExpenseRatio(parseFloat(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none bg-zinc-700 accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-sm font-mono text-emerald-400 min-w-[52px] text-right">
                      {maxExpenseRatio.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Max Count */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3">
                    최대 분석 종목수
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={universeInfo?.etfTotal || 5000}
                      step={10}
                      value={maxCount === 0 ? '' : maxCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setMaxCount(0);
                        } else {
                          const num = parseInt(val) || 0;
                          const cap = universeInfo?.etfTotal || 5000;
                          setMaxCount(Math.min(num, cap));
                        }
                      }}
                      onBlur={() => {
                        if (maxCount < 10 && maxCount !== 0) setMaxCount(10);
                        const cap = universeInfo?.etfTotal || 5000;
                        if (maxCount > cap) setMaxCount(cap);
                      }}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-colors"
                    />
                    <label className="inline-flex items-center gap-1.5 cursor-pointer group shrink-0" title="전체 ETF 분석">
                      <input
                        type="checkbox"
                        checked={universeInfo ? maxCount === universeInfo.etfTotal : false}
                        onChange={(e) => {
                          if (e.target.checked && universeInfo) {
                            setMaxCount(universeInfo.etfTotal);
                          } else {
                            setMaxCount(200);
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors whitespace-nowrap">전체</span>
                    </label>
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">
                    {loadingUniverse ? (
                      <span className="text-zinc-600">필터 조건으로 유니버스 조회 중...</span>
                    ) : (
                      <>
                        AUM ≥ ${(minAum / 1e6).toFixed(0)}M + 배당지급 ETF: 최대{' '}
                        <span className="text-emerald-400/80 font-semibold">
                          {universeInfo ? universeInfo.etfTotal.toLocaleString() : '---'}개
                        </span> 종목.<br/>
                        FMP API 사전 필터 적용. 200종목 ≈ 약 5~10분 소요.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>배당률 {minYield}%+</span>
                  <span className="text-zinc-700">|</span>
                  <span>AUM {formatAum(minAum)}+</span>
                  <span className="text-zinc-700">|</span>
                  <span>보수 ~{maxExpenseRatio.toFixed(2)}%</span>
                  <span className="text-zinc-700">|</span>
                  <span>{maxCount}개</span>
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
              processed={progress.processedETFs}
              total={progress.totalETFs}
              found={progress.foundETFs}
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
          <>
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20 mb-6 animate-in fade-in duration-500">
              {/* Toolbar */}
              <div className="flex flex-col gap-3 border-b border-zinc-800/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                  </div>
                  <span className="text-sm text-zinc-400">
                    총 <span className="text-emerald-400 font-semibold">{filteredResults.length}</span>개 ETF
                  </span>
                  {selectedForCompare.length > 0 && (
                    <span className="text-xs text-zinc-500 border border-emerald-500/20 bg-emerald-500/5 rounded-full px-2.5 py-0.5">
                      비교: {selectedForCompare.length}/3
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="ETF 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-800/80 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-48 transition-colors"
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
                      <th className="px-3 py-3 text-center text-xs font-medium text-zinc-500 uppercase w-10">
                        <span title="최대 3개 선택하여 레이더 차트 비교">비교</span>
                      </th>
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
                        ETF명 <SortIcon field="name" />
                      </th>
                      <th
                        className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => handleSort('price')}
                      >
                        가격 <SortIcon field="price" />
                      </th>
                      <th
                        className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => handleSort('aum')}
                      >
                        AUM <SortIcon field="aum" />
                      </th>
                      <th
                        className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => handleSort('dividendYield')}
                      >
                        배당수익률 <SortIcon field="dividendYield" />
                      </th>
                      <th
                        className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => handleSort('expenseRatio')}
                      >
                        운용보수 <SortIcon field="expenseRatio" />
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Q-LEAD
                      </th>
                      <th
                        className="group px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 min-w-[140px] transition-colors"
                        onClick={() => handleSort('totalScore')}
                      >
                        총점 <SortIcon field="totalScore" />
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        등급
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {filteredResults.map((etf, idx) => (
                      <React.Fragment key={etf.symbol}>
                        <tr
                          className="hover:bg-emerald-500/[0.03] transition-colors duration-150"
                        >
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedForCompare.includes(etf.symbol)}
                              onChange={() => toggleCompare(etf.symbol)}
                              disabled={!selectedForCompare.includes(etf.symbol) && selectedForCompare.length >= 3}
                              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="px-4 py-3 text-zinc-600 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-semibold text-zinc-100 font-mono text-xs hover:text-emerald-400 transition-colors cursor-pointer"
                                onClick={() => router.push(`/etf/${etf.symbol}`)}
                              >
                                {etf.symbol}
                              </span>
                              {etf.isCoveredCall && (
                                <span className="shrink-0 rounded bg-orange-500/15 px-1 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/20" title="Covered Call ETF">
                                  CC
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 text-zinc-300 max-w-[200px] truncate text-xs cursor-pointer hover:text-zinc-100 transition-colors"
                            onClick={() => router.push(`/etf/${etf.symbol}`)}
                          >
                            {etf.name}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300 text-xs">
                            {formatPrice(etf.price)}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">
                            {formatAum(etf.aum)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-emerald-400 font-mono text-xs">
                              {formatDecimalPercent(etf.dividendYield)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">
                            {formatDecimalPercent(etf.expenseRatio)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedRow(expandedRow === etf.symbol ? null : etf.symbol)}
                              className="hover:scale-105 transition-transform"
                              title="Q-LEAD 상세 보기"
                            >
                              <QLeadBars etf={etf} />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <ScoreBar score={etf.totalScore} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center font-bold rounded-full border px-2 py-0.5 text-xs transition-all duration-200 hover:scale-110 cursor-default ${
                                etf.totalScore >= 85 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                etf.totalScore >= 75 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                etf.totalScore >= 65 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                etf.totalScore >= 55 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                                etf.totalScore >= 40 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                'bg-red-500/20 text-red-400 border-red-500/30'
                              }`}
                            >
                              {getOverallGrade(etf)}
                            </span>
                          </td>
                        </tr>
                        {/* Expanded Q-LEAD breakdown */}
                        {expandedRow === etf.symbol && (
                          <tr>
                            <td colSpan={11} className="p-0">
                              <QLeadBreakdown etf={etf} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Summary */}
              {filteredResults.length > 0 && (
                <div className="border-t border-zinc-800/60 px-6 py-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    평균 배당수익률: <span className="text-emerald-400 font-mono">{(filteredResults.reduce((sum, e) => sum + e.dividendYield, 0) / filteredResults.length * 100).toFixed(2)}%</span>
                  </span>
                  <span>
                    평균 Q-LEAD: <span className="text-emerald-400 font-mono">{(filteredResults.reduce((sum, e) => sum + e.totalScore, 0) / filteredResults.length).toFixed(1)}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Q-LEAD Radar Chart Comparison */}
            {selectedForCompare.length > 0 && (
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-6 shadow-xl shadow-black/20 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">
                      Q-LEAD 레이더 차트 비교
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      최대 3개 ETF를 선택하여 Q-LEAD 점수를 비교할 수 있습니다
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedForCompare([])}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-700 rounded-lg px-3 py-1.5 hover:border-zinc-600"
                  >
                    선택 초기화
                  </button>
                </div>

                {/* Selected ETF Tags */}
                <div className="flex items-center gap-2 mb-6">
                  {selectedForCompare.map((symbol, i) => {
                    const etf = results.find((e) => e.symbol === symbol);
                    return (
                      <div
                        key={symbol}
                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 backdrop-blur-sm"
                        style={{
                          borderColor: RADAR_COLORS[i],
                          backgroundColor: `${RADAR_COLORS[i]}10`,
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: RADAR_COLORS[i] }}
                        />
                        <span className="text-sm font-medium text-zinc-200 font-mono">
                          {symbol}
                        </span>
                        {etf && (
                          <span className="text-xs text-zinc-500">
                            {etf.totalScore.toFixed(1)}점
                          </span>
                        )}
                        <button
                          onClick={() => toggleCompare(symbol)}
                          className="text-zinc-500 hover:text-zinc-300 ml-1 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Chart */}
                <div className="flex justify-center">
                  <div className="w-full max-w-lg h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                        <PolarGrid stroke="#3f3f46" strokeDasharray="3 3" />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fill: '#a1a1aa', fontSize: 12 }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 100]}
                          tick={{ fill: '#71717a', fontSize: 10 }}
                          axisLine={false}
                        />
                        {selectedForCompare.map((symbol, i) => (
                          <Radar
                            key={symbol}
                            name={symbol}
                            dataKey={symbol}
                            stroke={RADAR_COLORS[i]}
                            fill={RADAR_COLORS[i]}
                            fillOpacity={0.15}
                            strokeWidth={2}
                          />
                        ))}
                        <Legend
                          wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '12px',
                            color: '#e4e4e7',
                            fontSize: 12,
                            padding: '8px 12px',
                          }}
                          formatter={(value) => [(value as number).toFixed(1), '']}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score comparison table below chart */}
                <div className="mt-6 border-t border-zinc-800/60 pt-4">
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    <div className="text-zinc-600 font-medium">ETF</div>
                    <div className="text-center text-emerald-500 font-medium">Quality</div>
                    <div className="text-center text-blue-500 font-medium">Liquidity</div>
                    <div className="text-center text-amber-500 font-medium">Exposure</div>
                    <div className="text-center text-purple-500 font-medium">Dividend</div>
                    {selectedForCompare.map((symbol) => {
                      const etf = results.find((e) => e.symbol === symbol);
                      if (!etf) return null;
                      return (
                        <React.Fragment key={symbol}>
                          <div className="text-zinc-300 font-mono font-medium">{symbol}</div>
                          <div className="text-center text-zinc-400 font-mono">{etf.qualityScore.toFixed(1)}</div>
                          <div className="text-center text-zinc-400 font-mono">{etf.liquidityScore.toFixed(1)}</div>
                          <div className="text-center text-zinc-400 font-mono">{etf.exposureScore.toFixed(1)}</div>
                          <div className="text-center text-zinc-400 font-mono">{etf.dividendScore.toFixed(1)}</div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isScreening && results.length === 0 && progress.status === 'idle' && !error && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-16 text-center shadow-xl shadow-black/20">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <svg className="h-10 w-10 text-emerald-500/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">
              ETF 스크리닝을 시작해 보세요
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
              Q-LEAD 모델이 Quality(품질), Liquidity(유동성), Exposure(분산도),
              Dividend(배당) 4가지 축으로 ETF를 종합 평가합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
