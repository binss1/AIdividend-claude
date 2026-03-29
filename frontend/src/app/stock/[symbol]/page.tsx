'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/config/api';
import { StockGrade, DividendCycle } from '@/types';
import GradeBadge from '@/components/GradeBadge';
import ScoreBar from '@/components/ScoreBar';
import PriceChart from '@/components/PriceChart';
import DividendChart from '@/components/DividendChart';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface StockDetailData {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  marketCap: number;
  marketCapKRW: number;
  currentPrice: number;
  dividendYield: number;
  annualDividend: number;
  payoutRatio: number;
  consecutiveDividendYears: number;
  dividendConsistencyScore: number;
  dividendCycle: DividendCycle;
  exDividendDate?: string;
  paymentDate?: string;
  eps: number;
  pe: number;
  pb?: number;
  ps?: number;
  beta: number;
  roe: number;
  debtToEquity: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  fcfPayoutRatio?: number;
  revenueGrowth?: number;
  netIncomeGrowth?: number;
  overallScore: number;
  grade: StockGrade;
  scoreBreakdown: {
    stability: number;
    profitability: number;
    growth: number;
    valuation: number;
    dividend: number;
  };
  isREIT: boolean;
  lastUpdated: string;
  // Valuation data (1단계)
  dcf?: { dcf: number; stockPrice: number; date: string } | null;
  rating?: {
    rating: string; ratingScore: number; ratingRecommendation: string;
    ratingDetailsDCFScore: number; ratingDetailsROEScore: number;
    ratingDetailsDEScore: number; ratingDetailsPEScore: number; ratingDetailsPBScore: number;
  } | null;
  priceTarget?: {
    lastMonth: number; lastMonthAvgPriceTarget: number;
    lastQuarter: number; lastQuarterAvgPriceTarget: number;
    lastYear: number; lastYearAvgPriceTarget: number;
  } | null;
  peers?: string[];
  // Advanced data (4순위)
  insiderTrading?: Array<{
    transactionDate: string; transactionType: string; securitiesTransacted: number;
    price: number; reportingName: string; typeOfOwner: string;
  }>;
  institutionalHolders?: Array<{
    holder: string; shares: number; dateReported: string; change: number; weightPercent: number;
  }>;
  socialSentiment?: Array<{
    date: string; stocktwitsPosts: number; twitterPosts: number;
    stocktwitsSentiment: number; twitterSentiment: number;
  }>;
  analystEstimates?: Array<{
    date: string; estimatedRevenueAvg: number; estimatedEpsAvg: number;
    estimatedEpsHigh: number; estimatedEpsLow: number;
    numberAnalystsEstimatedEps: number;
  }>;
}

interface PriceDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DividendDataPoint {
  date: string;
  amount: number;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function dividendCycleKorean(cycle: DividendCycle): string {
  const map: Record<DividendCycle, string> = {
    monthly: '월배당',
    quarterly: '분기배당',
    'semi-annual': '반기배당',
    annual: '연배당',
    unknown: '미확인',
  };
  return map[cycle] || cycle;
}

function metricColor(value: number | undefined | null, goodMax: number, cautionMax: number): string {
  if (value == null) return 'text-gray-400';
  if (value <= goodMax) return 'text-emerald-400';
  if (value <= cautionMax) return 'text-yellow-400';
  return 'text-red-400';
}

function metricColorInverse(value: number | undefined | null, goodMin: number, cautionMin: number): string {
  if (value == null) return 'text-gray-400';
  if (value >= goodMin) return 'text-emerald-400';
  if (value >= cautionMin) return 'text-yellow-400';
  return 'text-red-400';
}

// -------------------------------------------------------------------
// Score category labels
// -------------------------------------------------------------------

const SCORE_CATEGORIES = [
  { key: 'stability' as const, label: '안정성' },
  { key: 'profitability' as const, label: '수익성' },
  { key: 'growth' as const, label: '성장성' },
  { key: 'valuation' as const, label: '가치' },
  { key: 'dividend' as const, label: '배당' },
];

const GRADE_DESCRIPTIONS: Partial<Record<StockGrade, string>> = {
  'A+': '최우수 배당주 - 모든 지표에서 탁월한 성과를 보여주는 최상위 종목입니다.',
  'A': '우수 배당주 - 안정적이고 매력적인 배당을 제공하는 우량 종목입니다.',
  'B+': '양호한 배당주 - 적절한 배당과 성장성을 갖춘 종목입니다.',
  'B': '보통 배당주 - 기본적인 배당 요건을 충족하는 종목입니다.',
  'C': '주의 필요 - 배당 지속성에 대한 면밀한 검토가 필요합니다.',
  'D': '위험 - 투자에 주의가 필요합니다.',
};

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = params.symbol?.toUpperCase() ?? '';

  const [stock, setStock] = useState<StockDetailData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([]);
  const [dividendHistory, setDividendHistory] = useState<DividendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStockData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    const base = getApiBaseUrl();

    try {
      const [stockRes, priceRes, divRes] = await Promise.allSettled([
        fetch(`${base}/screening/stock/${symbol}`),
        fetch(
          `${base}/screening/stock/${symbol}/historical?from=${
            new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10)
          }&to=${new Date().toISOString().slice(0, 10)}`
        ),
        fetch(`${base}/screening/stock/${symbol}/dividend-history`),
      ]);

      if (stockRes.status === 'fulfilled' && stockRes.value.ok) {
        const data = await stockRes.value.json();
        setStock(data);
      } else {
        setError('종목 데이터를 불러올 수 없습니다.');
      }

      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        const data = await priceRes.value.json();
        setPriceHistory(Array.isArray(data) ? data : data.prices ?? data.data ?? []);
      }

      if (divRes.status === 'fulfilled' && divRes.value.ok) {
        const data = await divRes.value.json();
        setDividendHistory(Array.isArray(data) ? data : data.dividends ?? data.data ?? []);
      }
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // ------------------------------------------------------------------
  // Loading / Error states
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">{symbol} 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">데이터 로드 실패</h2>
          <p className="text-gray-400 mb-6">{error || '알 수 없는 오류가 발생했습니다.'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/screening')} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm">
              스크리닝으로 돌아가기
            </button>
            <button onClick={fetchStockData} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors text-sm">
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------

  const priceUp = stock.dividendYield > 0;

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* ============================================================ */}
      {/* HEADER                                                       */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-b from-gray-900/80 to-gray-950 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back nav */}
          <button
            onClick={() => router.push('/screening')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            스크리닝 목록
          </button>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Left: identity */}
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="px-4 py-2 bg-emerald-500/15 text-emerald-400 text-2xl font-bold rounded-xl border border-emerald-500/20 tracking-wider">
                  {stock.symbol}
                </span>
                <GradeBadge grade={stock.grade} size="lg" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">{stock.name}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                {stock.exchange && <span>{stock.exchange}</span>}
                {stock.exchange && stock.sector && <span className="text-gray-600">|</span>}
                {stock.sector && <span>{stock.sector}</span>}
                {stock.industry && <span className="text-gray-600">|</span>}
                {stock.industry && <span>{stock.industry}</span>}
              </div>
            </div>

            {/* Right: price */}
            <div className="text-right lg:text-right">
              <p className="text-4xl font-bold text-white tracking-tight mb-1">
                ${stock.currentPrice.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                배당수익률 <span className="text-emerald-400 font-semibold">{stock.dividendYield.toFixed(2)}%</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                총점 <span className="text-white font-bold">{stock.overallScore.toFixed(1)}</span> / 100
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* ============================================================ */}
        {/* PRICE CHART                                                  */}
        {/* ============================================================ */}
        <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            주가 차트
          </h2>
          <PriceChart data={priceHistory} />
        </section>

        {/* ============================================================ */}
        {/* DIVIDEND ANALYSIS (2-col)                                    */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            배당 분석
          </h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: key metrics */}
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: '최근 배당금',
                  value: stock.annualDividend != null ? `$${stock.annualDividend.toFixed(4)}` : '-',
                  sub: '주당',
                },
                {
                  label: '연간 배당금 (추정)',
                  value: `$${stock.annualDividend.toFixed(2)}`,
                  sub: '주당',
                },
                {
                  label: '배당수익률',
                  value: `${stock.dividendYield.toFixed(2)}%`,
                  sub: null,
                  highlight: true,
                },
                {
                  label: '배당주기',
                  value: dividendCycleKorean(stock.dividendCycle),
                  sub: null,
                },
                {
                  label: '배당성향',
                  value: `${stock.payoutRatio.toFixed(1)}%`,
                  sub: stock.payoutRatio > 80 ? '높음 - 주의' : stock.payoutRatio > 60 ? '적정' : '양호',
                  color: stock.payoutRatio > 80 ? 'text-red-400' : stock.payoutRatio > 60 ? 'text-yellow-400' : 'text-emerald-400',
                },
                {
                  label: '연속 배당 증가',
                  value: `${stock.consecutiveDividendYears}년`,
                  sub: stock.consecutiveDividendYears >= 25 ? '배당 귀족' : stock.consecutiveDividendYears >= 10 ? '우수' : null,
                  color: stock.consecutiveDividendYears >= 25 ? 'text-emerald-400' : stock.consecutiveDividendYears >= 10 ? 'text-green-400' : 'text-gray-400',
                },
              ].map((m, i) => (
                <div
                  key={i}
                  className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-4 hover:border-gray-700 transition-colors"
                >
                  <p className="text-xs text-gray-400 mb-2">{m.label}</p>
                  <p className={`text-xl font-bold ${m.highlight ? 'text-emerald-400' : 'text-white'}`}>{m.value}</p>
                  {m.sub && <p className={`text-xs mt-1 ${m.color ?? 'text-gray-500'}`}>{m.sub}</p>}
                </div>
              ))}
            </div>

            {/* Right: dividend chart */}
            <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">배당금 히스토리</h3>
              <DividendChart data={dividendHistory} />
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* FINANCIAL HEALTH                                             */}
        {/* ============================================================ */}
        <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            재무 건전성
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                label: 'P/E',
                value: stock.pe != null ? stock.pe.toFixed(1) : '-',
                color: metricColor(stock.pe, 20, 35),
              },
              {
                label: 'P/B',
                value: stock.pb != null ? stock.pb.toFixed(2) : '-',
                color: metricColor(stock.pb, 3, 5),
              },
              {
                label: 'Beta',
                value: stock.beta != null ? stock.beta.toFixed(2) : '-',
                color: metricColor(stock.beta, 1, 1.5),
              },
              {
                label: 'ROE',
                value: stock.roe != null && stock.roe !== 0 ? `${stock.roe.toFixed(1)}%` : '-',
                color: metricColorInverse(stock.roe, 15, 8),
              },
              {
                label: '부채비율',
                value: stock.debtToEquity != null ? stock.debtToEquity.toFixed(2) : '-',
                color: metricColor(stock.debtToEquity, 1, 2),
              },
              {
                label: '시가총액',
                value: formatMarketCap(stock.marketCap),
                color: 'text-white',
              },
            ].map((m, i) => (
              <div
                key={i}
                className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 text-center hover:border-gray-600 transition-colors"
              >
                <p className="text-xs text-gray-400 mb-2">{m.label}</p>
                <p className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* VALUATION & ANALYST (1단계)                                  */}
        {/* ============================================================ */}
        {(stock.dcf || stock.rating || stock.priceTarget) && (
          <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              밸류에이션 & 애널리스트
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* DCF 적정가 분석 */}
              {stock.dcf && (
                <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-300">DCF 적정가 분석</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-zinc-500">적정가 (DCF)</p>
                      <p className="text-xl font-bold text-white">${stock.dcf.dcf?.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500">현재가</p>
                      <p className="text-xl font-bold text-zinc-300">${stock.currentPrice?.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const gap = stock.dcf.dcf && stock.currentPrice
                          ? ((stock.dcf.dcf - stock.currentPrice) / stock.currentPrice * 100)
                          : 0;
                        const isUnder = gap > 0;
                        return (
                          <div>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isUnder ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {isUnder ? '저평가' : '고평가'}
                            </span>
                            <p className={`text-sm font-mono mt-1 ${isUnder ? 'text-emerald-400' : 'text-red-400'}`}>
                              {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* 투자 등급 */}
              {stock.rating && (
                <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-300">FMP 투자 등급</h3>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${
                        stock.rating.ratingRecommendation === 'Strong Buy' ? 'text-emerald-400' :
                        stock.rating.ratingRecommendation === 'Buy' ? 'text-green-400' :
                        stock.rating.ratingRecommendation === 'Neutral' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>{stock.rating.rating}</p>
                      <p className="text-[10px] text-zinc-500">{stock.rating.ratingRecommendation}</p>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {[
                        { label: 'DCF', score: stock.rating.ratingDetailsDCFScore },
                        { label: 'ROE', score: stock.rating.ratingDetailsROEScore },
                        { label: 'D/E', score: stock.rating.ratingDetailsDEScore },
                        { label: 'P/E', score: stock.rating.ratingDetailsPEScore },
                        { label: 'P/B', score: stock.rating.ratingDetailsPBScore },
                      ].map(r => (
                        <div key={r.label} className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 w-7">{r.label}</span>
                          <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${
                              r.score >= 4 ? 'bg-emerald-500' : r.score >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} style={{ width: `${(r.score / 5) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-zinc-400 w-4 text-right">{r.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 애널리스트 목표가 */}
              {stock.priceTarget && (
                <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-300">애널리스트 목표가</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">최근 1개월 평균</span>
                      <span className="text-white font-mono">${stock.priceTarget.lastMonthAvgPriceTarget?.toFixed(2)} ({stock.priceTarget.lastMonth}명)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">최근 분기 평균</span>
                      <span className="text-white font-mono">${stock.priceTarget.lastQuarterAvgPriceTarget?.toFixed(2)} ({stock.priceTarget.lastQuarter}명)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">최근 1년 평균</span>
                      <span className="text-white font-mono">${stock.priceTarget.lastYearAvgPriceTarget?.toFixed(2)} ({stock.priceTarget.lastYear}명)</span>
                    </div>
                    {stock.priceTarget.lastQuarterAvgPriceTarget && stock.currentPrice && (
                      <div className="mt-2 pt-2 border-t border-zinc-700/40">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">상승여력</span>
                          {(() => {
                            const upside = ((stock.priceTarget.lastQuarterAvgPriceTarget - stock.currentPrice) / stock.currentPrice * 100);
                            return (
                              <span className={`font-mono font-bold ${upside > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {upside > 0 ? '+' : ''}{upside.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 유사 종목 */}
              {stock.peers && stock.peers.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-300">유사 종목</h3>
                  <div className="flex flex-wrap gap-2">
                    {stock.peers.slice(0, 10).map((peer: string) => (
                      <a key={peer} href={`/stock/${peer}`}
                        className="px-3 py-1.5 rounded-lg bg-zinc-700/50 text-xs text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors font-mono">
                        {peer}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* SCORE BREAKDOWN                                              */}
        {/* ============================================================ */}
        <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            점수 분석
          </h2>
          <div className="space-y-4">
            {SCORE_CATEGORIES.map(({ key, label }) => {
              const score = stock.scoreBreakdown[key] ?? 0;
              return (
                <div key={key} className="flex items-center gap-4">
                  <span className="text-sm text-gray-300 w-16 shrink-0">{label}</span>
                  <div className="flex-1">
                    <ScoreBar score={score} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall grade explanation */}
          <div className="mt-6 p-4 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <div className="flex items-center gap-3 mb-2">
              <GradeBadge grade={stock.grade} size="lg" />
              <span className="text-sm text-gray-300 font-medium">종합 등급</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {GRADE_DESCRIPTIONS[stock.grade] ?? '등급 설명을 불러올 수 없습니다.'}
            </p>
          </div>
        </section>

        {/* ============================================================ */}
        {/* ADVANCED: INSIDER TRADING + INSTITUTIONAL + SENTIMENT + EST  */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Insider Trading */}
          {stock.insiderTrading && stock.insiderTrading.length > 0 && (
            <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 backdrop-blur-sm">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                내부자 거래
              </h2>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {stock.insiderTrading.slice(0, 8).map((t, i) => {
                  const isBuy = t.transactionType?.toLowerCase().includes('purchase') || t.transactionType?.toLowerCase().includes('buy');
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-gray-800/30 px-3 py-1.5">
                      <span className={`w-8 font-bold ${isBuy ? 'text-red-400' : 'text-blue-400'}`}>{isBuy ? '매수' : '매도'}</span>
                      <span className="text-zinc-400 w-20 shrink-0">{t.transactionDate?.split(' ')[0]}</span>
                      <span className="text-zinc-300 flex-1 truncate">{t.reportingName}</span>
                      <span className="text-zinc-400 w-16 text-right">{t.securitiesTransacted?.toLocaleString()}주</span>
                      <span className="text-zinc-500 w-14 text-right">${t.price?.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Institutional Holders */}
          {stock.institutionalHolders && stock.institutionalHolders.length > 0 && (
            <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 backdrop-blur-sm">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
                기관투자자 보유
              </h2>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {stock.institutionalHolders.slice(0, 8).map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-gray-800/30 px-3 py-1.5">
                    <span className="text-zinc-300 flex-1 truncate">{h.holder}</span>
                    <span className="text-zinc-400 w-20 text-right">{(h.shares / 1e6).toFixed(2)}M주</span>
                    <span className={`w-16 text-right font-mono ${h.change > 0 ? 'text-red-400' : h.change < 0 ? 'text-blue-400' : 'text-zinc-500'}`}>
                      {h.change > 0 ? '+' : ''}{(h.change / 1e3).toFixed(0)}K
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Social Sentiment */}
          {stock.socialSentiment && stock.socialSentiment.length > 0 && (
            <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 backdrop-blur-sm">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                소셜 감성 분석
              </h2>
              {(() => {
                const recent = stock.socialSentiment.slice(0, 7);
                const avgSentiment = recent.reduce((s, d) => s + (d.stocktwitsSentiment || 0), 0) / recent.length;
                const totalPosts = recent.reduce((s, d) => s + (d.stocktwitsPosts || 0) + (d.twitterPosts || 0), 0);
                return (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg bg-gray-800/30 p-3 text-center">
                        <p className="text-[10px] text-zinc-500">7일 평균 감성</p>
                        <p className={`text-lg font-bold ${avgSentiment > 0.6 ? 'text-emerald-400' : avgSentiment > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {avgSentiment > 0.6 ? '긍정적' : avgSentiment > 0.4 ? '중립' : '부정적'}
                        </p>
                        <p className="text-xs text-zinc-500">{(avgSentiment * 100).toFixed(0)}%</p>
                      </div>
                      <div className="flex-1 rounded-lg bg-gray-800/30 p-3 text-center">
                        <p className="text-[10px] text-zinc-500">7일 총 게시물</p>
                        <p className="text-lg font-bold text-white">{totalPosts.toLocaleString()}</p>
                        <p className="text-xs text-zinc-500">Stocktwits + X</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {recent.reverse().map((d, i) => {
                        const s = d.stocktwitsSentiment || 0.5;
                        return (
                          <div key={i} className="flex-1 text-center">
                            <div className="h-8 rounded-sm" style={{
                              backgroundColor: s > 0.6 ? 'rgba(16,185,129,0.3)' : s > 0.4 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)',
                            }} />
                            <p className="text-[8px] text-zinc-600 mt-0.5">{d.date?.slice(5, 10)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {/* Analyst Estimates */}
          {stock.analystEstimates && stock.analystEstimates.length > 0 && (
            <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 backdrop-blur-sm">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>
                애널리스트 추정치
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-700/30">
                      <th className="px-2 py-1.5 text-left">분기</th>
                      <th className="px-2 py-1.5 text-right">EPS 추정</th>
                      <th className="px-2 py-1.5 text-right">범위</th>
                      <th className="px-2 py-1.5 text-right">매출 추정</th>
                      <th className="px-2 py-1.5 text-right">애널리스트</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/20">
                    {stock.analystEstimates.slice(0, 4).map((e, i) => (
                      <tr key={i} className="hover:bg-gray-800/20">
                        <td className="px-2 py-1.5 text-zinc-400">{e.date?.slice(0, 7)}</td>
                        <td className="px-2 py-1.5 text-right text-white font-mono">${e.estimatedEpsAvg?.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-500 font-mono">${e.estimatedEpsLow?.toFixed(2)}~${e.estimatedEpsHigh?.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400 font-mono">{e.estimatedRevenueAvg ? `$${(e.estimatedRevenueAvg / 1e9).toFixed(2)}B` : '-'}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-500">{e.numberAnalystsEstimatedEps}명</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* ============================================================ */}
        {/* INVESTMENT SUMMARY                                           */}
        {/* ============================================================ */}
        <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            투자 요약
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-3">강점</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                {stock.dividendYield >= 3 && <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1 shrink-0">&#8226;</span>높은 배당수익률 ({stock.dividendYield.toFixed(2)}%)</li>}
                {stock.consecutiveDividendYears >= 10 && <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1 shrink-0">&#8226;</span>{stock.consecutiveDividendYears}년 연속 배당 증가</li>}
                {stock.payoutRatio > 0 && stock.payoutRatio <= 60 && <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1 shrink-0">&#8226;</span>안정적인 배당성향 ({stock.payoutRatio.toFixed(1)}%)</li>}
                {stock.roe >= 15 && <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1 shrink-0">&#8226;</span>우수한 자기자본이익률 ({stock.roe.toFixed(1)}%)</li>}
                {stock.debtToEquity < 1 && <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1 shrink-0">&#8226;</span>낮은 부채비율 ({stock.debtToEquity.toFixed(2)})</li>}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-400 mb-3">주의사항</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                {stock.payoutRatio > 80 && <li className="flex items-start gap-2"><span className="text-amber-500 mt-1 shrink-0">&#8226;</span>높은 배당성향 ({stock.payoutRatio.toFixed(1)}%) - 지속성 검토 필요</li>}
                {stock.pe > 25 && <li className="flex items-start gap-2"><span className="text-amber-500 mt-1 shrink-0">&#8226;</span>높은 P/E ({stock.pe.toFixed(1)}) - 고평가 가능성</li>}
                {stock.debtToEquity > 2 && <li className="flex items-start gap-2"><span className="text-amber-500 mt-1 shrink-0">&#8226;</span>높은 부채비율 ({stock.debtToEquity.toFixed(2)})</li>}
                {stock.beta > 1.5 && <li className="flex items-start gap-2"><span className="text-amber-500 mt-1 shrink-0">&#8226;</span>높은 변동성 (Beta: {stock.beta.toFixed(2)})</li>}
                {stock.isREIT && <li className="flex items-start gap-2"><span className="text-blue-400 mt-1 shrink-0">&#8226;</span>REIT - 금리 변동에 민감</li>}
              </ul>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* BOTTOM NAVIGATION                                            */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => router.push('/screening')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium border border-gray-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            스크리닝 목록
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-colors text-sm border border-gray-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            맨 위로
          </button>
        </div>
      </div>
    </div>
  );
}
