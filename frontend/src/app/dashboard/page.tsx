'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/config/api';
import { ScreenedStock, ScreenedETF, StockGrade } from '@/types';
import GradeBadge from '@/components/GradeBadge';
import ScoreBar from '@/components/ScoreBar';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface ExchangeRate {
  rate: number;
  source: string;
  lastUpdated: string;
}

interface CachedScreening {
  results: ScreenedStock[];
  timestamp: string;
}

interface CachedETFScreening {
  results: ScreenedETF[];
  timestamp: string;
}

interface MarketIndex {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changesPercentage: number | null;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

const ECON_EVENT_KR: Record<string, string> = {
  'CPI': '소비자물가지수',
  'Core CPI': '근원 소비자물가',
  'PPI': '생산자물가지수',
  'Core PPI': '근원 생산자물가',
  'GDP': 'GDP 성장률',
  'GDP Growth Rate': 'GDP 성장률',
  'Initial Jobless Claims': '신규 실업수당 청구',
  'Continuing Jobless Claims': '계속 실업수당 청구',
  'Non Farm Payrolls': '비농업 고용',
  'Nonfarm Payrolls': '비농업 고용',
  'Unemployment Rate': '실업률',
  'Interest Rate Decision': '기준금리 결정',
  'Federal Funds Rate': '연방기금금리',
  'FOMC': '연준 통화정책회의',
  'FOMC Minutes': '연준 의사록',
  'Retail Sales': '소매판매',
  'Core Retail Sales': '근원 소매판매',
  'Industrial Production': '산업생산',
  'Manufacturing PMI': '제조업 PMI',
  'Services PMI': '서비스업 PMI',
  'ISM Manufacturing PMI': 'ISM 제조업 PMI',
  'ISM Non-Manufacturing PMI': 'ISM 비제조업 PMI',
  'Consumer Confidence': '소비자신뢰지수',
  'Michigan Consumer Sentiment': '미시간 소비자심리',
  'Housing Starts': '주택착공',
  'Building Permits': '건축허가',
  'Existing Home Sales': '기존주택매매',
  'New Home Sales': '신규주택매매',
  'Durable Goods Orders': '내구재 주문',
  'Trade Balance': '무역수지',
  'Current Account': '경상수지',
  'Personal Income': '개인소득',
  'Personal Spending': '개인소비',
  'PCE Price Index': 'PCE 물가지수',
  'Core PCE Price Index': '근원 PCE 물가',
  'Treasury Budget': '재정수지',
  'Crude Oil Inventories': '원유재고',
  'Baker Hughes US Oil Rig Count': '석유 시추기 수',
  'CFTC': 'CFTC 투기포지션',
};

function translateEconEvent(event: string): string {
  // Exact match
  if (ECON_EVENT_KR[event]) return ECON_EVENT_KR[event];
  // Partial match
  for (const [key, kr] of Object.entries(ECON_EVENT_KR)) {
    if (event.includes(key)) return kr;
  }
  // CFTC pattern
  if (event.startsWith('CFTC ')) {
    const asset = event.replace('CFTC ', '').replace(' speculative net positions', '').replace(' Speculative net positions', '');
    return `CFTC ${asset} 투기포지션`;
  }
  return '';
}

function formatKRW(usd: number, rate: number): string {
  return `${(usd * rate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function gradeColor(grade: StockGrade): string {
  if (grade.startsWith('A')) return 'text-emerald-400';
  if (grade.startsWith('B')) return 'text-blue-400';
  if (grade.startsWith('C')) return 'text-yellow-400';
  return 'text-red-400';
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();

  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [stockCache, setStockCache] = useState<CachedScreening | null>(null);
  const [etfCache, setETFCache] = useState<CachedETFScreening | null>(null);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [sectorPerf, setSectorPerf] = useState<Array<{ sector: string; changesPercentage: string }>>([]);
  const [econEvents, setEconEvents] = useState<Array<{ event: string; date: string; actual: number | null; previous: number | null; estimate: number | null; impact: string }>>([]);
  const [stockNews, setStockNews] = useState<Array<{ symbol: string; publishedDate: string; title: string; site: string; url: string }>>([]);

  // Fetch exchange rate + market overview + market insights
  useEffect(() => {
    const base = getApiBaseUrl();
    fetch(`${base}/exchange-rate`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setExchangeRate(data);
      })
      .catch(() => {})
      .finally(() => setRateLoading(false));

    // Fetch market indices
    fetch(`${base}/screening/market-overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data)) setMarketIndices(data);
      })
      .catch(() => {});

    // Sector performance
    fetch(`${base}/screening/sector-performance`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.sectors) setSectorPerf(data.sectors); })
      .catch(() => {});

    // Economic calendar
    fetch(`${base}/screening/economic-calendar`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.events) setEconEvents(data.events.slice(0, 10)); })
      .catch(() => {});

    // Stock news (top stocks from cached results)
    const cached = typeof window !== 'undefined' ? localStorage.getItem('stock_screening_results') : null;
    const tickers = cached ? (() => {
      try { return JSON.parse(cached).slice(0, 3).map((s: { symbol: string }) => s.symbol).join(','); } catch { return 'AAPL,MSFT,JNJ'; }
    })() : 'AAPL,MSFT,JNJ';
    fetch(`${base}/screening/stock-news?tickers=${tickers}&limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.news) setStockNews(data.news); })
      .catch(() => {});
  }, []);

  // Load cached screening results from localStorage
  useEffect(() => {
    try {
      const stockRaw = localStorage.getItem('stock_screening_results');
      if (stockRaw) {
        const parsed = JSON.parse(stockRaw);
        const results = Array.isArray(parsed) ? parsed : parsed.results ?? parsed.data ?? [];
        const timestamp = parsed.timestamp ?? parsed.lastUpdated ?? new Date().toISOString();
        if (results.length > 0) setStockCache({ results, timestamp });
      }

      const etfRaw = localStorage.getItem('etf_screening_results');
      if (etfRaw) {
        const parsed = JSON.parse(etfRaw);
        const results = Array.isArray(parsed) ? parsed : parsed.results ?? parsed.data ?? [];
        const timestamp = parsed.timestamp ?? parsed.lastUpdated ?? new Date().toISOString();
        if (results.length > 0) setETFCache({ results, timestamp });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Derived stats
  const topStocks = stockCache?.results
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 5) ?? [];

  const topETFs = etfCache?.results
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5) ?? [];

  const avgYield = stockCache?.results.length
    ? stockCache.results.reduce((sum, s) => sum + s.dividendYield, 0) / stockCache.results.length
    : 0;

  const bestGrade = topStocks.length > 0 ? topStocks[0] : null;

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-gray-900/80 to-gray-950 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-white mb-2">
            AI Dividend <span className="text-emerald-400">대시보드</span>
          </h1>
          <p className="text-gray-400">미국 배당주 및 ETF 스크리닝 플랫폼에 오신 것을 환영합니다.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* ============================================================ */}
        {/* TOP CARDS ROW                                                */}
        {/* ============================================================ */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Exchange Rate */}
          <div className="relative overflow-hidden bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="text-sm font-semibold text-gray-300">USD/KRW 환율</h3>
              </div>
              {rateLoading ? (
                <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
              ) : exchangeRate ? (
                <>
                  <p className="text-3xl font-bold text-white mb-1">
                    {exchangeRate.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                    <span className="text-lg text-gray-400 ml-1">원</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {exchangeRate.source} &middot; {timeAgo(exchangeRate.lastUpdated)}
                  </p>
                </>
              ) : (
                <p className="text-gray-500 text-sm">환율 정보를 불러올 수 없습니다.</p>
              )}
            </div>
          </div>

          {/* Quick Action: Stock Screening */}
          <button
            onClick={() => router.push('/screening')}
            className="group relative overflow-hidden bg-gradient-to-br from-emerald-900/30 to-gray-900/40 border border-emerald-800/30 rounded-2xl p-6 text-left hover:border-emerald-600/50 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">배당주 스크리닝 시작</h3>
              <p className="text-sm text-gray-400">AI 기반 미국 배당주 분석 및 스크리닝</p>
              <div className="mt-3 inline-flex items-center gap-1 text-emerald-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                시작하기
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </button>

          {/* Quick Action: ETF Screening */}
          <button
            onClick={() => router.push('/etf-screening')}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-900/30 to-gray-900/40 border border-blue-800/30 rounded-2xl p-6 text-left hover:border-blue-600/50 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">ETF 스크리닝 시작</h3>
              <p className="text-sm text-gray-400">배당 ETF 분석 및 비교</p>
              <div className="mt-3 inline-flex items-center gap-1 text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                시작하기
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </button>
        </div>

        {/* ============================================================ */}
        {/* QUICK STATS                                                  */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">분석된 종목 수</p>
            <p className="text-2xl font-bold text-white">{stockCache?.results.length ?? 0}</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">분석된 ETF 수</p>
            <p className="text-2xl font-bold text-white">{etfCache?.results.length ?? 0}</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">평균 배당수익률</p>
            <p className="text-2xl font-bold text-emerald-400">
              {avgYield > 0 ? `${avgYield.toFixed(2)}%` : '-'}
            </p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">최고 등급 종목</p>
            {bestGrade ? (
              <div className="flex items-center justify-center gap-2">
                <span className={`text-lg font-bold ${gradeColor(bestGrade.grade)}`}>{bestGrade.symbol}</span>
                <GradeBadge grade={bestGrade.grade} size="sm" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-500">-</p>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RECENT SCREENING RESULTS                                     */}
        {/* ============================================================ */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top 5 Stocks */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                상위 배당주 TOP 5
              </h2>
              {stockCache && (
                <span className="text-xs text-gray-500">{timeAgo(stockCache.timestamp)}</span>
              )}
            </div>

            {topStocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg className="w-12 h-12 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <p className="text-gray-500 text-sm">스크리닝 결과가 없습니다.</p>
                <button
                  onClick={() => router.push('/screening')}
                  className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  스크리닝 시작하기 &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {topStocks.map((stock, i) => (
                  <button
                    key={stock.symbol}
                    onClick={() => router.push(`/stock/${stock.symbol}`)}
                    className="w-full flex items-center gap-4 p-3 bg-gray-800/40 hover:bg-gray-800/70 rounded-xl transition-colors text-left group"
                  >
                    <span className="text-xs text-gray-500 font-mono w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">{stock.symbol}</span>
                        <GradeBadge grade={stock.grade} size="sm" />
                        {exchangeRate && (
                          <span className="text-xs text-gray-500 ml-auto">
                            {formatKRW(stock.currentPrice, exchangeRate.rate)}원
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{stock.name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-emerald-400 font-medium">
                          수익률 {stock.dividendYield.toFixed(2)}%
                        </span>
                        <div className="flex-1 max-w-[100px]">
                          <ScoreBar score={stock.overallScore} height={4} showLabel={false} />
                        </div>
                        <span className="text-xs text-gray-400 font-mono">{stock.overallScore.toFixed(1)}</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Top 5 ETFs */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                상위 ETF TOP 5
              </h2>
              {etfCache && (
                <span className="text-xs text-gray-500">{timeAgo(etfCache.timestamp)}</span>
              )}
            </div>

            {topETFs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg className="w-12 h-12 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <p className="text-gray-500 text-sm">ETF 스크리닝 결과가 없습니다.</p>
                <button
                  onClick={() => router.push('/etf-screening')}
                  className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ETF 스크리닝 시작하기 &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {topETFs.map((etf, i) => (
                  <div
                    key={etf.symbol}
                    className="flex items-center gap-4 p-3 bg-gray-800/40 rounded-xl"
                  >
                    <span className="text-xs text-gray-500 font-mono w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">{etf.symbol}</span>
                        <GradeBadge grade={etf.totalScore >= 80 ? 'A+' : etf.totalScore >= 70 ? 'A' : etf.totalScore >= 60 ? 'B+' : etf.totalScore >= 50 ? 'B' : etf.totalScore >= 40 ? 'C' : 'D'} size="sm" />
                        {exchangeRate && (
                          <span className="text-xs text-gray-500 ml-auto">
                            {formatKRW(etf.price, exchangeRate.rate)}원
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{etf.name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-blue-400 font-medium">
                          수익률 {(etf.dividendYield * 100).toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          보수 {(etf.expenseRatio * 100).toFixed(2)}%
                        </span>
                        <div className="flex-1 max-w-[80px]">
                          <ScoreBar score={etf.totalScore} height={4} showLabel={false} />
                        </div>
                        <span className="text-xs text-gray-400 font-mono">{etf.totalScore.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* MARKET OVERVIEW (Placeholder)                                */}
        {/* ============================================================ */}
        <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            시장 개요
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const icons = ['📊', '📈', '💰', '⚡'];
              const defaults = [
                { label: 'S&P 500', sub: '' },
                { label: 'NASDAQ', sub: '' },
                { label: '미국 10년물 금리', sub: '' },
                { label: 'VIX', sub: '공포 지수' },
              ];
              return defaults.map((d, i) => {
                const m = marketIndices[i];
                const price = m?.price;
                const change = m?.changesPercentage;
                const isUp = change != null && change >= 0;
                return (
                  <div
                    key={i}
                    className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 text-center"
                  >
                    <p className="text-lg mb-1">{icons[i]}</p>
                    <p className="text-xs text-gray-400 mb-1">{d.label}</p>
                    <p className={`text-lg font-bold font-mono ${price != null ? 'text-white' : 'text-gray-500'}`}>
                      {price != null
                        ? i === 2
                          ? `${price.toFixed(2)}%`
                          : price.toLocaleString('en-US', { maximumFractionDigits: 2 })
                        : '-'}
                    </p>
                    <p className={`text-xs font-mono ${
                      change != null
                        ? isUp ? 'text-red-400' : 'text-blue-400'
                        : 'text-gray-600'
                    }`}>
                      {change != null
                        ? `${isUp ? '+' : ''}${change.toFixed(2)}%`
                        : d.sub || '데이터 대기'}
                    </p>
                  </div>
                );
              });
            })()}
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTOR PERFORMANCE                                           */}
        {/* ============================================================ */}
        {sectorPerf.length > 0 && (
          <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/10">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
              섹터별 퍼포먼스
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {sectorPerf.map((s) => {
                const pct = parseFloat(s.changesPercentage);
                const isUp = pct >= 0;
                return (
                  <div key={s.sector} className="rounded-lg bg-zinc-800/50 border border-zinc-700/30 p-3 hover:border-zinc-600/50 transition-colors">
                    <p className="text-xs text-zinc-400 truncate">{s.sector}</p>
                    <p className={`text-sm font-bold font-mono mt-1 ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                      {isUp ? '+' : ''}{pct.toFixed(2)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* ECONOMIC CALENDAR + NEWS                                     */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Economic Calendar */}
          {econEvents.length > 0 && (
            <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/10">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                경제 캘린더 (미국)
              </h2>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {econEvents.map((e, i) => {
                  const kr = translateEconEvent(e.event);
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-zinc-800/30 px-3 py-2 text-xs">
                      <span className="text-zinc-500 w-20 shrink-0">{e.date?.split(' ')[0]}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-300 truncate block">{e.event}</span>
                        {kr && <span className="text-emerald-400/70 text-[10px] truncate block">{kr}</span>}
                      </div>
                      <span className="text-zinc-400 w-14 text-right shrink-0">
                        {e.estimate != null ? e.estimate : '-'}
                      </span>
                      <span className="text-zinc-500 w-14 text-right shrink-0">
                        {e.previous != null ? `(${e.previous})` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">예상 | (이전)</p>
            </section>
          )}

          {/* Stock News */}
          {stockNews.length > 0 && (
            <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/10">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
                관련 뉴스
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {stockNews.map((n, i) => (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                    className="block rounded-lg bg-zinc-800/30 px-3 py-2.5 hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[9px] text-emerald-400 font-bold">{n.symbol}</span>
                      <span className="text-[10px] text-zinc-500">{n.site}</span>
                      <span className="text-[10px] text-zinc-600 ml-auto">{n.publishedDate?.split(' ')[0]}</span>
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-2">{n.title}</p>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
