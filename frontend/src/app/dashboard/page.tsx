'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiBaseUrl } from '@/config/api';
import { useAuth } from '@/components/AuthProvider';
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

interface CryptoQuote {
  symbol: string;
  shortName: string;
  name: string;
  icon: string;
  price: number | null;
  change: number | null;
  changesPercentage: number | null;
  marketCap: number | null;
  volume: number | null;
  dayLow: number | null;
  dayHigh: number | null;
}

interface DividendAlert {
  symbol: string;
  company_name: string;
  alert_type: 'cut' | 'suspension' | 'increase';
  current_dividend: number;
  previous_dividend: number;
  change_pct: number;
  latest_ex_date: string;
  frequency: string;
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
  'Baker Hughes Oil Rig Count': '석유 시추기 수',
  'ISM Services New Orders': 'ISM 서비스업 신규주문',
  'ISM Services Employment': 'ISM 서비스업 고용',
  'ISM Services Prices': 'ISM 서비스업 물가',
  'ISM Services PMI': 'ISM 서비스업 PMI',
  'ISM Services Business Activity': 'ISM 서비스업 경기활동',
  'S&P Global Composite PMI': 'S&P 종합 PMI',
  'S&P Global Services PMI': 'S&P 서비스업 PMI',
  'S&P Global Manufacturing PMI': 'S&P 제조업 PMI',
  'Manufacturing Payrolls': '제조업 고용',
  'Nonfarm Payrolls Private': '민간 비농업 고용',
  'Average Hourly Earnings YoY': '평균시급 (전년비)',
  'Average Hourly Earnings MoM': '평균시급 (전월비)',
  'Average Weekly Hours': '주당 평균근로시간',
  'Participation Rate': '경제활동참가율',
  'U-6 Unemployment Rate': 'U-6 실업률 (광의)',
  'Government Payrolls': '정부부문 고용',
  'Fed Balance Sheet': '연준 대차대조표',
  'Fed Logan Speech': '연준 로건 연설',
  '30-Year Mortgage Rate': '30년 모기지 금리',
  '15-Year Mortgage Rate': '15년 모기지 금리',
  '8-Week Bill Auction': '8주 국채 입찰',
  '4-Week Bill Auction': '4주 국채 입찰',
  'Bill Auction': '국채 입찰',
  'EIA Natural Gas Stocks Change': 'EIA 천연가스 재고변동',
  'EIA Crude Oil Stocks Change': 'EIA 원유 재고변동',
  'Goods Trade Balance Adv': '상품 무역수지 (속보)',
  'Goods Trade Balance': '상품 무역수지',
  'Imports': '수입액',
  'Exports': '수출액',
  'Jobless Claims 4-Week Average': '실업수당청구 4주평균',
  'Chicago PMI': '시카고 PMI',
  'Dallas Fed Manufacturing Index': '댈러스 연준 제조업지수',
  'Richmond Fed Manufacturing Index': '리치몬드 연준 제조업지수',
  'Philadelphia Fed Manufacturing Index': '필라델피아 연준 제조업지수',
  'NY Empire State Manufacturing Index': 'NY 제조업지수',
  'CB Consumer Confidence': 'CB 소비자신뢰지수',
  'ADP Employment Change': 'ADP 민간고용 변화',
  'JOLTs Job Openings': 'JOLTs 구인건수',
  'Factory Orders': '공장주문',
  'Factory Orders MoM': '공장주문 (전월비)',
  'Pending Home Sales': '잠정주택매매',
  'Budget Balance': '재정수지',
  'Michigan Current Conditions': '미시간 현재경기',
  'Michigan Consumer Expectations': '미시간 소비자기대',
  'Inflation Expectations': '기대인플레이션',
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

interface UserCreditInfo {
  balance: number;
  plan_id: string;
  plan_name: string;
  total_used: number;
  monthly_credits: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, session } = useAuth();

  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [stockCache, setStockCache] = useState<CachedScreening | null>(null);
  const [etfCache, setETFCache] = useState<CachedETFScreening | null>(null);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [cryptoData, setCryptoData] = useState<CryptoQuote[]>([]);
  const [sectorPerf, setSectorPerf] = useState<Array<{ sector: string; changesPercentage: string }>>([]);
  const [econEvents, setEconEvents] = useState<Array<{ event: string; date: string; actual: number | null; previous: number | null; estimate: number | null; impact: string }>>([]);
  const [stockNews, setStockNews] = useState<Array<{ symbol: string; publishedDate: string; title: string; site: string; url: string }>>([]);
  const [creditInfo, setCreditInfo] = useState<UserCreditInfo | null>(null);
  const [dividendAlerts, setDividendAlerts] = useState<DividendAlert[]>([]);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [portfolioESG, setPortfolioESG] = useState<{
    compositeScore: number | null;
    compositeRating: string | null;
    environmental: number;
    social: number;
    governance: number;
    coverage: number;
    breakdown: Array<{ symbol: string; name: string; environmental: number | null; social: number | null; governance: number | null; total: number | null; weight: number }>;
    totalHoldings: number;
  } | null>(null);

  // Fetch credit/profile info + dividend alerts (auth required)
  useEffect(() => {
    if (!session?.access_token) return;
    const base = getApiBaseUrl();
    const headers = { Authorization: `Bearer ${session.access_token}` };

    fetch(`${base}/credits/profile`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.profile) {
          setCreditInfo({
            balance: data.profile.credit_balance,
            plan_id: data.profile.plan_id,
            plan_name: data.plan?.name || data.profile.plan_id,
            total_used: data.profile.total_credits_used,
            monthly_credits: data.plan?.monthly_credits || 0,
          });
        }
      })
      .catch(() => {});

    // 배당 삭감/중단/증가 알림
    fetch(`${base}/portfolio/dividend-alerts`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.alerts) setDividendAlerts(data.alerts); })
      .catch(() => {});

    // 포트폴리오 ESG 종합점수
    fetch(`${base}/portfolio/esg-score`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.compositeScore !== undefined) setPortfolioESG(data); })
      .catch(() => {});
  }, [session?.access_token]);

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

    // Fetch market indices + crypto (+ auto refresh every 5 min)
    const fetchMarket = () => {
      fetch(`${base}/screening/market-overview`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data)) setMarketIndices(data);
        })
        .catch(() => {});

      fetch(`${base}/screening/crypto-overview`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data)) setCryptoData(data);
        })
        .catch(() => {});
    };
    fetchMarket();
    const marketInterval = setInterval(fetchMarket, 5 * 60 * 1000);

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

    return () => clearInterval(marketInterval);
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

  // Sector filter state
  const [selectedSector, setSelectedSector] = useState<string>('전체');

  // Derived stats
  const availableSectors = stockCache
    ? ['전체', ...Array.from(new Set(stockCache.results.map(s => s.sector).filter(Boolean))).sort()]
    : ['전체'];

  const topStocks = stockCache?.results
    .filter(s => selectedSector === '전체' || s.sector === selectedSector)
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
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border-b border-gray-800/50">
        {/* 배경 장식 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(16,185,129,0.08),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <div className="absolute top-8 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                AI Dividend <span className="text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">대시보드</span>
              </h1>
              <p className="text-gray-400 text-sm">
                {user ? `${user.user_metadata?.name || user.email?.split('@')[0] || '사용자'}님, 환영합니다.` : '미국 배당주 및 ETF 스크리닝 플랫폼에 오신 것을 환영합니다.'}
              </p>
            </div>

            {/* Credit & Plan Info Card */}
            {creditInfo && (
              <div className="flex items-center gap-0 bg-gray-900/80 border border-gray-700/50 rounded-2xl overflow-hidden backdrop-blur-sm shadow-lg shadow-black/20">
                <div className="px-5 py-3 text-center border-r border-gray-700/50">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">플랜</p>
                  <p className="text-sm font-bold text-emerald-400">{creditInfo.plan_name}</p>
                </div>
                <div className="px-5 py-3 text-center border-r border-gray-700/50">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">크레딧</p>
                  <p className="text-sm font-bold text-white">
                    {creditInfo.monthly_credits === -1 ? '∞' : creditInfo.balance.toLocaleString()}
                  </p>
                </div>
                <div className="px-5 py-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">사용량</p>
                  <p className="text-sm font-bold text-gray-300">{creditInfo.total_used.toLocaleString()}</p>
                </div>
                {creditInfo.plan_id === 'free' && (
                  <Link
                    href="/pricing"
                    className="px-4 py-3 text-xs font-semibold bg-gradient-to-r from-emerald-600/80 to-emerald-500/80 text-white hover:from-emerald-500 hover:to-emerald-400 transition-all duration-200 border-l border-emerald-500/30 whitespace-nowrap"
                  >
                    업그레이드 →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* ============================================================ */}
        {/* TOP CARDS ROW                                                */}
        {/* ============================================================ */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Exchange Rate */}
          <div className="relative overflow-hidden bg-gray-900/70 border border-gray-800/70 rounded-2xl p-6 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-2xl translate-x-1/3 translate-y-1/3 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-300">USD/KRW 환율</h3>
              </div>
              {rateLoading ? (
                <div className="h-10 bg-gray-800/80 rounded-lg animate-pulse" />
              ) : exchangeRate ? (
                <>
                  <p className="text-3xl font-bold text-white mb-1 tracking-tight">
                    {exchangeRate.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                    <span className="text-base font-normal text-gray-400 ml-1.5">원</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    {exchangeRate.source} · {timeAgo(exchangeRate.lastUpdated)}
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
            className="group relative overflow-hidden bg-gradient-to-br from-emerald-950/60 via-gray-900/80 to-gray-900/60 border border-emerald-800/40 rounded-2xl p-6 text-left hover:border-emerald-600/60 hover:from-emerald-900/40 transition-all duration-300 shadow-lg shadow-black/10"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <div className="absolute bottom-0 right-0 w-36 h-36 bg-emerald-500/8 rounded-full blur-2xl translate-x-1/4 translate-y-1/4 group-hover:bg-emerald-500/12 transition-colors pointer-events-none" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:bg-emerald-500/25 group-hover:border-emerald-500/40 transition-colors">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1 tracking-tight">배당주 스크리닝</h3>
              <p className="text-sm text-gray-400">AI 기반 미국 배당주 분석 및 스크리닝</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-emerald-400 text-sm font-semibold group-hover:gap-2.5 transition-all">
                시작하기
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </button>

          {/* Quick Action: ETF Screening */}
          <button
            onClick={() => router.push('/etf-screening')}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-950/60 via-gray-900/80 to-gray-900/60 border border-blue-800/40 rounded-2xl p-6 text-left hover:border-blue-600/60 hover:from-blue-900/40 transition-all duration-300 shadow-lg shadow-black/10"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
            <div className="absolute bottom-0 right-0 w-36 h-36 bg-blue-500/8 rounded-full blur-2xl translate-x-1/4 translate-y-1/4 group-hover:bg-blue-500/12 transition-colors pointer-events-none" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/25 group-hover:border-blue-500/40 transition-colors">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1 tracking-tight">ETF 스크리닝</h3>
              <p className="text-sm text-gray-400">배당 ETF 분석 및 비교</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-blue-400 text-sm font-semibold group-hover:gap-2.5 transition-all">
                시작하기
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </button>
        </div>

        {/* ============================================================ */}
        {/* QUICK STATS                                                  */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 분석된 종목 수 */}
          <div className="relative overflow-hidden bg-gray-900/60 border border-gray-800/60 rounded-xl p-5">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gray-600/60 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <p className="text-xs text-gray-500">분석된 종목 수</p>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{stockCache?.results.length ?? 0}<span className="text-sm font-normal text-gray-500 ml-1">개</span></p>
          </div>
          {/* 분석된 ETF 수 */}
          <div className="relative overflow-hidden bg-gray-900/60 border border-gray-800/60 rounded-xl p-5">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-blue-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
              <p className="text-xs text-gray-500">분석된 ETF 수</p>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{etfCache?.results.length ?? 0}<span className="text-sm font-normal text-gray-500 ml-1">개</span></p>
          </div>
          {/* 평균 배당수익률 */}
          <div className="relative overflow-hidden bg-gray-900/60 border border-gray-800/60 rounded-xl p-5">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-emerald-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              <p className="text-xs text-gray-500">평균 배당수익률</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400 tracking-tight">
              {avgYield > 0 ? `${avgYield.toFixed(2)}%` : <span className="text-gray-600">-</span>}
            </p>
          </div>
          {/* 최고 등급 종목 */}
          <div className="relative overflow-hidden bg-gray-900/60 border border-gray-800/60 rounded-xl p-5">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-yellow-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              <p className="text-xs text-gray-500">최고 등급 종목</p>
            </div>
            {bestGrade ? (
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold tracking-tight ${gradeColor(bestGrade.grade)}`}>{bestGrade.symbol}</span>
                <GradeBadge grade={bestGrade.grade} size="sm" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-600">-</p>
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

            {/* Sector filter chips */}
            {availableSectors.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {availableSectors.slice(0, 8).map((sector) => (
                  <button
                    key={sector}
                    onClick={() => setSelectedSector(sector)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedSector === sector
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:border-gray-600/60 hover:text-gray-300'
                    }`}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            )}

            {topStocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg className="w-12 h-12 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <p className="text-gray-500 text-sm">
                  {selectedSector === '전체' ? '스크리닝 결과가 없습니다.' : `'${selectedSector}' 섹터 결과가 없습니다.`}
                </p>
                {selectedSector !== '전체' ? (
                  <button
                    onClick={() => setSelectedSector('전체')}
                    className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    전체 보기 &rarr;
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/screening')}
                    className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    스크리닝 시작하기 &rarr;
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {topStocks.map((stock, i) => (
                  <button
                    key={stock.symbol}
                    onClick={() => router.push(`/stock/${stock.symbol}`)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/60 border border-gray-700/20 hover:border-gray-700/50 rounded-xl transition-all text-left group"
                  >
                    <span className={`text-xs font-bold w-5 shrink-0 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-white">{stock.symbol}</span>
                        <GradeBadge grade={stock.grade} size="sm" />
                        {exchangeRate && (
                          <span className="text-xs text-gray-500 ml-auto">
                            {formatKRW(stock.currentPrice, exchangeRate.rate)}원
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-xs text-gray-500 truncate">{stock.name}</p>
                        {selectedSector === '전체' && stock.sector && (
                          <span className="text-[10px] text-gray-500 bg-gray-700/40 px-1.5 py-0.5 rounded shrink-0">{stock.sector}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-emerald-400 font-semibold shrink-0">
                          {stock.dividendYield.toFixed(2)}%
                        </span>
                        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: `${Math.min(100, stock.overallScore)}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono shrink-0">{stock.overallScore.toFixed(0)}점</span>
                      </div>
                    </div>
                    <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
              <div className="space-y-2">
                {topETFs.map((etf, i) => (
                  <button
                    key={etf.symbol}
                    onClick={() => router.push(`/etf/${etf.symbol}`)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/60 border border-gray-700/20 hover:border-gray-700/50 rounded-xl transition-all text-left group"
                  >
                    <span className={`text-xs font-bold w-5 shrink-0 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-white">{etf.symbol}</span>
                        <GradeBadge grade={etf.totalScore >= 80 ? 'A+' : etf.totalScore >= 70 ? 'A' : etf.totalScore >= 60 ? 'B+' : etf.totalScore >= 50 ? 'B' : etf.totalScore >= 40 ? 'C' : 'D'} size="sm" />
                        {exchangeRate && (
                          <span className="text-xs text-gray-500 ml-auto">
                            {formatKRW(etf.price, exchangeRate.rate)}원
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mb-1.5">{etf.name}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-blue-400 font-semibold shrink-0">
                          {(etf.dividendYield * 100).toFixed(2)}%
                        </span>
                        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/50 rounded-full" style={{ width: `${Math.min(100, etf.totalScore)}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono shrink-0">{etf.totalScore.toFixed(0)}점</span>
                      </div>
                    </div>
                    <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* DIVIDEND ALERTS                                              */}
        {/* ============================================================ */}
        {user && dividendAlerts.length > 0 && !alertsDismissed && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                포트폴리오 배당 알림
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-1 ${
                  dividendAlerts.some(a => a.alert_type === 'suspension') ? 'bg-red-500/20 text-red-400' :
                  dividendAlerts.some(a => a.alert_type === 'cut') ? 'bg-orange-500/20 text-orange-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>{dividendAlerts.length}건</span>
              </h2>
              <button
                onClick={() => setAlertsDismissed(true)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
                aria-label="알림 닫기"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {dividendAlerts.map((alert) => {
                const isSuspension = alert.alert_type === 'suspension';
                const isCut = alert.alert_type === 'cut';
                const isIncrease = alert.alert_type === 'increase';
                const freqLabel: Record<string, string> = {
                  monthly: '월배당', quarterly: '분기배당',
                  'semi-annual': '반기배당', annual: '연배당', unknown: '',
                };
                return (
                  <button
                    key={alert.symbol}
                    onClick={() => router.push(`/stock/${alert.symbol}`)}
                    className={`text-left rounded-xl p-3 border transition-colors group ${
                      isSuspension ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15' :
                      isCut        ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15' :
                                     'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{alert.symbol}</span>
                        {freqLabel[alert.frequency] && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400">
                            {freqLabel[alert.frequency]}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isSuspension ? 'bg-red-500/20 text-red-400' :
                        isCut        ? 'bg-orange-500/20 text-orange-400' :
                                       'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {isSuspension ? '⚠ 중단 의심' : isCut ? '▼ 삭감' : '▲ 증가'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate mb-1">{alert.company_name}</p>
                    <div className="flex items-center gap-2 text-xs">
                      {isSuspension ? (
                        <span className="text-red-400">마지막 배당: {alert.latest_ex_date} 이후 미지급</span>
                      ) : (
                        <>
                          <span className="text-zinc-500">${alert.previous_dividend.toFixed(4)}</span>
                          <span className="text-zinc-600">→</span>
                          <span className={isCut ? 'text-orange-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                            ${alert.current_dividend.toFixed(4)}
                          </span>
                          <span className={`font-bold ml-auto ${isCut ? 'text-orange-400' : 'text-emerald-400'}`}>
                            {alert.change_pct > 0 ? '+' : ''}{alert.change_pct.toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* PORTFOLIO ESG SCORE                                          */}
        {/* ============================================================ */}
        {user && portfolioESG && portfolioESG.compositeScore != null && (
          <section className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 backdrop-blur-xl p-5">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              포트폴리오 ESG 종합점수
              <span className="text-xs text-zinc-500 font-normal ml-1">보유 종목 가중평균</span>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {/* 종합 점수 */}
              <div className="col-span-2 md:col-span-1 bg-gray-900/60 border border-emerald-700/30 rounded-xl p-4 flex flex-col items-center justify-center">
                {(() => {
                  const score = portfolioESG.compositeScore!;
                  const rating = portfolioESG.compositeRating ?? '-';
                  const color = score >= 65 ? 'text-emerald-400' : score >= 45 ? 'text-yellow-400' : 'text-red-400';
                  return (
                    <>
                      <p className="text-xs text-gray-400 mb-1">종합 ESG</p>
                      <p className={`text-3xl font-bold ${color}`}>{score.toFixed(1)}</p>
                      <p className={`text-sm font-semibold mt-1 ${color}`}>{rating}</p>
                      <p className="text-xs text-gray-500 mt-1">커버리지 {portfolioESG.coverage}%</p>
                    </>
                  );
                })()}
              </div>

              {/* E / S / G 개별 점수 */}
              {[
                { label: '환경 (E)', value: portfolioESG.environmental, icon: '🌿' },
                { label: '사회 (S)', value: portfolioESG.social, icon: '🤝' },
                { label: '지배구조 (G)', value: portfolioESG.governance, icon: '🏛️' },
              ].map((item) => {
                const v = item.value ?? 0;
                const color = v >= 65 ? 'text-emerald-400' : v >= 45 ? 'text-yellow-400' : 'text-red-400';
                const barW = Math.max(0, Math.min(100, v));
                return (
                  <div key={item.label} className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">{item.icon} {item.label}</p>
                    <p className={`text-xl font-bold ${color}`}>{v.toFixed(1)}</p>
                    <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${v >= 65 ? 'bg-emerald-500' : v >= 45 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 종목별 브레이크다운 */}
            {portfolioESG.breakdown.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">종목별 ESG 점수</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {portfolioESG.breakdown.slice(0, 6).map((item) => {
                    const score = item.total;
                    const color = score == null ? 'text-gray-500' : score >= 65 ? 'text-emerald-400' : score >= 45 ? 'text-yellow-400' : 'text-red-400';
                    return (
                      <button
                        key={item.symbol}
                        onClick={() => router.push(`/stock/${item.symbol}`)}
                        className="text-left rounded-lg bg-gray-900/50 border border-gray-800/50 hover:border-gray-700/70 p-3 transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">{item.symbol}</span>
                          <span className={`text-sm font-bold ${color}`}>
                            {score != null ? score.toFixed(1) : 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mb-1.5">{item.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span>E: {item.environmental?.toFixed(0) ?? '-'}</span>
                          <span>S: {item.social?.toFixed(0) ?? '-'}</span>
                          <span>G: {item.governance?.toFixed(0) ?? '-'}</span>
                          <span className="ml-auto text-gray-600">{item.weight.toFixed(1)}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ============================================================ */}
        {/* MARKET OVERVIEW (Placeholder)                                */}
        {/* ============================================================ */}
        <section className="relative overflow-hidden bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700/60 to-transparent" />
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              시장 개요
            </h2>
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500/60 animate-pulse" />
              5분마다 자동 갱신
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const defaults = [
                { label: 'S&P 500', icon: '📊', sub: '' },
                { label: 'NASDAQ', icon: '📈', sub: '' },
                { label: '10년물 금리', icon: '💰', sub: '' },
                { label: 'VIX', icon: '⚡', sub: '공포 지수' },
              ];
              return defaults.map((d, i) => {
                const m = marketIndices[i];
                const price = m?.price;
                const change = m?.changesPercentage;
                const isUp = change != null && change >= 0;
                return (
                  <div
                    key={i}
                    className={`relative overflow-hidden rounded-xl p-4 border transition-colors ${
                      change != null
                        ? isUp
                          ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/8'
                          : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/8'
                        : 'bg-gray-800/30 border-gray-700/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{d.label}</p>
                      <span className="text-sm">{d.icon}</span>
                    </div>
                    <p className={`text-xl font-bold font-mono tracking-tight ${price != null ? 'text-white' : 'text-gray-600'}`}>
                      {price != null
                        ? i === 2
                          ? `${price.toFixed(2)}%`
                          : price.toLocaleString('en-US', { maximumFractionDigits: 2 })
                        : '-'}
                    </p>
                    {change != null ? (
                      <p className={`text-xs font-semibold mt-1 flex items-center gap-0.5 ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                        {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                      </p>
                    ) : (
                      <p className="text-xs text-gray-600 mt-1">{d.sub || '대기 중'}</p>
                    )}
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
            {(() => {
              const maxAbs = Math.max(...sectorPerf.map(s => Math.abs(parseFloat(s.changesPercentage))), 0.01);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {sectorPerf.map((s) => {
                    const pct = parseFloat(s.changesPercentage);
                    const isUp = pct >= 0;
                    const barW = Math.min(100, (Math.abs(pct) / maxAbs) * 100);
                    return (
                      <div key={s.sector} className={`rounded-xl p-3 border transition-colors ${isUp ? 'bg-red-500/5 border-red-500/15 hover:border-red-500/30' : 'bg-blue-500/5 border-blue-500/15 hover:border-blue-500/30'}`}>
                        <p className="text-[11px] text-zinc-400 truncate mb-1.5">{s.sector}</p>
                        <p className={`text-sm font-bold font-mono ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                          {isUp ? '+' : ''}{pct.toFixed(2)}%
                        </p>
                        <div className="mt-2 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isUp ? 'bg-red-500/50' : 'bg-blue-500/50'}`}
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        )}

        {/* ============================================================ */}
        {/* CRYPTO OVERVIEW                                              */}
        {/* ============================================================ */}
        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/10">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 2.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            가상화폐 시세
            <span className="text-[10px] text-zinc-600 font-normal ml-1">시가총액 상위 5종 · 5분마다 자동 갱신</span>
          </h2>

          {cryptoData.length === 0 ? (
            /* 로딩 스켈레톤 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 animate-pulse">
                  <div className="h-3 bg-zinc-700 rounded w-1/2 mb-3" />
                  <div className="h-6 bg-zinc-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-zinc-700 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {cryptoData.map((c) => {
                const isUp = c.changesPercentage != null && c.changesPercentage >= 0;
                const pct  = c.changesPercentage;

                // 가격 포맷 (BTC는 소수 0자리, 나머지 최대 4자리)
                const fmtPrice = (p: number | null) => {
                  if (p == null) return '-';
                  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                  if (p >= 1)    return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
                  return `$${p.toFixed(4)}`;
                };

                const fmtMarketCap = (mc: number | null) => {
                  if (mc == null) return null;
                  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
                  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`;
                  if (mc >= 1e6)  return `$${(mc / 1e6).toFixed(0)}M`;
                  return null;
                };

                const fmtVol = (v: number | null) => {
                  if (v == null) return null;
                  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
                  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
                  return null;
                };

                return (
                  <div
                    key={c.symbol}
                    className={`rounded-xl border p-4 transition-colors ${
                      isUp
                        ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                        : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                    }`}
                  >
                    {/* 이름 + 아이콘 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-black leading-none text-orange-400">
                          {c.icon}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white leading-none">{c.shortName}</p>
                          <p className="text-[10px] text-zinc-500">{c.name}</p>
                        </div>
                      </div>
                      {/* 등락률 배지 */}
                      {pct != null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                          isUp ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {isUp ? '+' : ''}{pct.toFixed(2)}%
                        </span>
                      )}
                    </div>

                    {/* 현재가 (USD) */}
                    <p className="text-xl font-black tracking-tight mb-0.5 text-white">
                      {fmtPrice(c.price)}
                    </p>

                    {/* 원화 환산가 */}
                    {exchangeRate && c.price != null && (
                      <p className="text-xs text-zinc-400 mb-1">
                        ₩{(c.price * exchangeRate.rate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                      </p>
                    )}

                    {/* 전일 대비 변동 */}
                    {c.change != null && (
                      <p className={`text-xs font-medium mb-2 ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                        {isUp ? '▲' : '▼'} {fmtPrice(Math.abs(c.change))}
                      </p>
                    )}

                    {/* 일중 고/저 */}
                    {(c.dayHigh != null || c.dayLow != null) && (
                      <div className="flex gap-2 text-[10px] text-zinc-500 mb-1.5">
                        {c.dayHigh != null && <span>고 <span className="text-zinc-300">{fmtPrice(c.dayHigh)}</span></span>}
                        {c.dayLow  != null && <span>저 <span className="text-zinc-300">{fmtPrice(c.dayLow)}</span></span>}
                      </div>
                    )}

                    {/* 시총 / 거래량 */}
                    <div className="space-y-0.5 text-[10px]">
                      {fmtMarketCap(c.marketCap) && (
                        <div className="flex justify-between text-zinc-500">
                          <span>시가총액</span>
                          <span className="text-zinc-400">{fmtMarketCap(c.marketCap)}</span>
                        </div>
                      )}
                      {fmtVol(c.volume) && (
                        <div className="flex justify-between text-zinc-500">
                          <span>거래량</span>
                          <span className="text-zinc-400">{fmtVol(c.volume)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

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
              <div className="flex gap-4 mt-2 text-[10px] text-zinc-600">
                <span>숫자: <span className="text-zinc-400">예상치</span></span>
                <span>괄호: <span className="text-zinc-400">이전 발표치</span></span>
                <span>발표 후 실제치가 업데이트됩니다</span>
              </div>
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
