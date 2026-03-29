'use client';

import { useState } from 'react';
import { apiFetch, API_ENDPOINTS } from '@/config/api';

// ==========================================
// Types
// ==========================================

interface PortfolioHolding {
  symbol: string;
  name: string;
  weight: number;
  amount: number;
  shares: number;
  currentPrice: number;
  annualDividend: number;
  monthlyDividend: number;
  dividendYield: number;
  score: number;
  grade: string;
  category: string;
  dividendCycle: string;
}

interface PortfolioMetrics {
  totalInvestment: number;
  weightedYield: number;
  expectedAnnualDividend: number;
  expectedMonthlyDividendPreTax: number;
  expectedMonthlyDividendPostTax: number;
  portfolioBeta: number;
  avgExpenseRatio?: number;
  avgScore: number;
  sectorDistribution: Record<string, number>;
  dividendCalendar: number[];
}

interface PortfolioProjection {
  years: number[];
  portfolioValues: number[];
  monthlyDividends: number[];
  totalDividends: number[];
}

interface PortfolioVariant {
  name: string;
  description: string;
  holdings: PortfolioHolding[];
  metrics: PortfolioMetrics;
  projection: PortfolioProjection;
}

interface Achievability {
  isAchievable: boolean;
  currentMonthlyDividend: number;
  targetMonthlyDividend: number;
  gap: number;
  monthsToTarget: number | null;
  yearsToTarget: number | null;
}

interface RecommendResponse {
  portfolios: PortfolioVariant[];
  achievability: Achievability;
}

type Tendency = 'conservative' | 'balanced' | 'growth' | 'aggressive';
type SectorConc = 'low' | 'medium' | 'high';
type DivFreq = 'monthly' | 'quarterly' | 'any';

interface Props {
  assetType: 'stock' | 'etf';
  assets: unknown[];
  exchangeRate: number;
}

// ==========================================
// Formatting helpers
// ==========================================

function fmtUSD(v: number): string {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtKRW(v: number, rate: number): string {
  const krw = v * rate;
  if (krw >= 1e8) return `${(krw / 1e8).toFixed(1)}억원`;
  if (krw >= 1e4) return `${Math.round(krw / 1e4).toLocaleString()}만원`;
  return `${Math.round(krw).toLocaleString()}원`;
}

function fmtDual(v: number, rate: number): string {
  return `${fmtUSD(v)} (${fmtKRW(v, rate)})`;
}

function fmtKRWHangul(v: number): string {
  if (v <= 0) return '0원';
  const rounded = Math.round(v);
  const eok = Math.floor(rounded / 1e8);
  const manTotal = Math.floor((rounded % 1e8) / 1e4);
  const below = rounded % 1e4;

  let result = '';
  if (eok > 0) result += `${eok}억`;
  if (manTotal > 0) result += `${manTotal.toLocaleString()}만`;
  if (!result) return `${rounded.toLocaleString()}원`;
  if (below > 0) result += `${below.toLocaleString()}`;
  result += '원';
  return result;
}

const CATEGORY_LABELS: Record<string, string> = {
  'bond-income': '채권',
  'covered-call': '커버드콜',
  'equity-dividend': '배당주',
  reit: 'REIT',
  international: '해외',
  'low-risk': '저위험',
  'medium-risk': '중위험',
  'high-risk': '고위험',
};

const TENDENCY_LABELS: Record<Tendency, string> = {
  conservative: '보수적',
  balanced: '균형',
  growth: '성장',
  aggressive: '적극적',
};

// ==========================================
// Main Component
// ==========================================

export default function PortfolioRecommendation({ assetType, assets, exchangeRate }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [activeTab, setActiveTab] = useState(1); // 0=안정, 1=균형, 2=성장

  // Form state (KRW 기준 입력)
  const [totalInvestmentKRW, setTotalInvestmentKRW] = useState(15000000); // 1500만원
  const [targetMonthlyDivKRW, setTargetMonthlyDivKRW] = useState(150000); // 15만원
  const [monthlyAdditionalKRW, setMonthlyAdditionalKRW] = useState(500000); // 50만원
  const [investmentYears, setInvestmentYears] = useState(10);
  const [tendency, setTendency] = useState<Tendency>('balanced');
  const [reinvest, setReinvest] = useState(true);
  const [maxHoldings, setMaxHoldings] = useState(7);
  const [sectorConc, setSectorConc] = useState<SectorConc>('medium');
  const [divFreq, setDivFreq] = useState<DivFreq>('any');

  // KRW → USD 변환
  const toUSD = (krw: number) => exchangeRate > 0 ? krw / exchangeRate : 0;
  const totalInvestmentUSD = toUSD(totalInvestmentKRW);
  const targetMonthlyDivUSD = toUSD(targetMonthlyDivKRW);
  const monthlyAdditionalUSD = toUSD(monthlyAdditionalKRW);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const resp = await apiFetch<RecommendResponse>(API_ENDPOINTS.PORTFOLIO_RECOMMEND, {
        method: 'POST',
        body: JSON.stringify({
          assetType,
          assets,
          preferences: {
            totalInvestment: totalInvestmentUSD,
            targetMonthlyDividend: targetMonthlyDivUSD,
            monthlyAdditionalInvestment: monthlyAdditionalUSD,
            reinvestDividends: reinvest,
            investmentTendency: tendency,
            maxHoldings,
            sectorConcentration: sectorConc,
            dividendFrequency: divFreq,
            investmentYears,
          },
          exchangeRate,
        }),
      });
      setResult(resp);
      setActiveTab(1);
    } catch (err) {
      setError((err as Error).message || '포트폴리오 추천 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-1.5L12 12m0 0l3-1.5M12 12V9" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-white">포트폴리오 추천</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              선정된 <span className="text-emerald-400 font-medium">{assets.length}개</span> 종목을 대상으로 포트폴리오를 구성합니다
            </p>
          </div>
        </div>
        <svg className={`w-5 h-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Body */}
      <div className={`transition-all duration-300 ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="px-5 pb-5 space-y-5">
          {/* Input Form */}
          <div className="space-y-4">
            {/* Row 1: Investment amounts (KRW 기준 입력) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FormField label="총 투자금액 (원)" sub={`${fmtKRWHangul(totalInvestmentKRW)} / ${fmtUSD(totalInvestmentUSD)}`}>
                <input type="number" value={totalInvestmentKRW} step={100000}
                  onChange={e => setTotalInvestmentKRW(Number(e.target.value))}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
              </FormField>
              <FormField label="희망 월 배당금 세후 (원)" sub={`${fmtKRWHangul(targetMonthlyDivKRW)} / ${fmtUSD(targetMonthlyDivUSD)}`}>
                <input type="number" value={targetMonthlyDivKRW} step={10000}
                  onChange={e => setTargetMonthlyDivKRW(Number(e.target.value))}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
              </FormField>
              <FormField label="월 추가 투자금 (원)" sub={`${fmtKRWHangul(monthlyAdditionalKRW)} / ${fmtUSD(monthlyAdditionalUSD)}`}>
                <input type="number" value={monthlyAdditionalKRW} step={100000}
                  onChange={e => setMonthlyAdditionalKRW(Number(e.target.value))}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
              </FormField>
              <FormField label="투자 기간 (년)">
                <input type="number" value={investmentYears} min={1} max={30} onChange={e => setInvestmentYears(Number(e.target.value))}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none" />
              </FormField>
            </div>

            {/* Row 2: Preferences */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FormField label="투자 성향">
                <div className="flex gap-1">
                  {(['conservative', 'balanced', 'growth', 'aggressive'] as Tendency[]).map(t => (
                    <button key={t} onClick={() => setTendency(t)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-all ${
                        tendency === t
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
                      }`}>
                      {TENDENCY_LABELS[t]}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="배당 빈도 선호">
                <div className="flex gap-1">
                  {([['monthly', '월배당'], ['quarterly', '분기'], ['any', '무관']] as [DivFreq, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setDivFreq(v)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-all ${
                        divFreq === v
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="섹터 집중 허용" tooltip="단일 섹터(자산유형)에 투자 비중을 얼마나 허용할지 설정합니다. 제한(20%)은 분산 극대화, 보통(35%)은 적절한 균형, 허용(50%)은 고수익 섹터 집중이 가능합니다.">
                <div className="flex gap-1">
                  {([['low', '제한'], ['medium', '보통'], ['high', '허용']] as [SectorConc, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setSectorConc(v)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-all ${
                        sectorConc === v
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label={`최대 종목 수: ${maxHoldings}개`}>
                <input type="range" min={3} max={15} value={maxHoldings} onChange={e => setMaxHoldings(Number(e.target.value))}
                  className="w-full accent-emerald-500 mt-1" />
              </FormField>
            </div>

            {/* Row 3: Reinvest + Submit */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reinvest} onChange={e => setReinvest(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30" />
                <span className="text-sm text-zinc-300">배당금 자동 재투자 (DRIP)</span>
              </label>
              <button onClick={handleSubmit} disabled={loading || assets.length === 0}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    분석 중...
                  </span>
                ) : '포트폴리오 추천'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Achievability Banner */}
              <AchievabilityBanner achievability={result.achievability} exchangeRate={exchangeRate} reinvest={reinvest} monthlyAdditionalKRW={monthlyAdditionalKRW} />

              {/* Tabs */}
              <div className="flex gap-2">
                {result.portfolios.map((p, i) => (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      activeTab === i
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>

              {/* Active Portfolio */}
              {result.portfolios[activeTab] && (
                <PortfolioDisplay
                  portfolio={result.portfolios[activeTab]}
                  exchangeRate={exchangeRate}
                  assetType={assetType}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Sub Components
// ==========================================

function FormField({ label, sub, tooltip, children }: { label: string; sub?: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="relative group cursor-help">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              {tooltip}
            </span>
          </span>
        )}
      </label>
      {children}
      {sub && <p className="text-[10px] text-emerald-400/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function AchievabilityBanner({ achievability, exchangeRate, reinvest, monthlyAdditionalKRW }: {
  achievability: Achievability;
  exchangeRate: number;
  reinvest: boolean;
  monthlyAdditionalKRW: number;
}) {
  const a = achievability;
  if (a.isAchievable && a.monthsToTarget === 0) {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-400">목표 달성 가능!</span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          현재 투자금으로 월 {fmtDual(a.currentMonthlyDividend, exchangeRate)} (세후) 배당 수령 가능합니다.
        </p>
      </div>
    );
  }

  const color = a.isAchievable ? 'amber' : 'red';
  const borderColor = a.isAchievable ? 'border-amber-500/20' : 'border-red-500/20';
  const bgColor = a.isAchievable ? 'bg-amber-500/10' : 'bg-red-500/10';
  const textColor = a.isAchievable ? 'text-amber-400' : 'text-red-400';

  return (
    <div className={`rounded-xl ${bgColor} ${borderColor} border p-4`}>
      <div className="flex items-center gap-2">
        <svg className={`w-5 h-5 ${textColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span className={`text-sm font-medium ${textColor}`}>
          {a.isAchievable ? '추가 투자 필요' : '목표 달성이 어렵습니다'}
        </span>
      </div>
      <div className="text-xs text-zinc-400 mt-2 space-y-1">
        <p>현재 예상 월배당(세후): <span className="text-white">{fmtDual(a.currentMonthlyDividend, exchangeRate)}</span></p>
        <p>목표 월배당(세후): <span className="text-white">{fmtDual(a.targetMonthlyDividend, exchangeRate)}</span></p>
        <p>부족분: <span className={textColor}>{fmtDual(a.gap, exchangeRate)}</span></p>
        {a.isAchievable && a.yearsToTarget && (
          <p className="mt-1">
            월 {monthlyAdditionalKRW.toLocaleString()}원 추가투자 {reinvest ? '+ 배당 재투자' : ''} 시{' '}
            <span className="text-emerald-400 font-medium">약 {a.yearsToTarget}년 후</span> 목표 달성 예상
          </p>
        )}
      </div>
    </div>
  );
}

function PortfolioDisplay({ portfolio, exchangeRate, assetType }: {
  portfolio: PortfolioVariant;
  exchangeRate: number;
  assetType: 'stock' | 'etf';
}) {
  const m = portfolio.metrics;
  const p = portfolio.projection;

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-xs text-zinc-400">{portfolio.description}</p>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="가중평균 수익률" value={`${m.weightedYield.toFixed(2)}%`} />
        <MetricCard label="월 배당금 (세후)" value={fmtUSD(m.expectedMonthlyDividendPostTax)} sub={fmtKRW(m.expectedMonthlyDividendPostTax, exchangeRate)} color="emerald" />
        <MetricCard label="연 배당금" value={fmtUSD(m.expectedAnnualDividend)} sub={fmtKRW(m.expectedAnnualDividend, exchangeRate)} />
        <MetricCard label="포트폴리오 Beta" value={m.portfolioBeta.toFixed(2)} sub={`평균 점수: ${m.avgScore}`} />
      </div>

      {/* Holdings Table */}
      <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-700/40">
                <th className="px-3 py-2 text-left">종목</th>
                <th className="px-3 py-2 text-center">분류</th>
                <th className="px-3 py-2 text-right">비중</th>
                <th className="px-3 py-2 text-right">투자금</th>
                <th className="px-3 py-2 text-right">수량</th>
                <th className="px-3 py-2 text-right">수익률</th>
                <th className="px-3 py-2 text-center">배당주기</th>
                <th className="px-3 py-2 text-right">예상 월배당</th>
                <th className="px-3 py-2 text-right">점수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {portfolio.holdings.map(h => (
                <tr key={h.symbol} className="hover:bg-zinc-800/30">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-white">{h.symbol}</div>
                    <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">{h.name}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-700/50 text-zinc-300">
                      {CATEGORY_LABELS[h.category] || h.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(h.weight, 100)}%` }} />
                      </div>
                      <span className="text-white text-xs w-10 text-right">{h.weight.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="text-white">{fmtUSD(h.amount)}</div>
                    <div className="text-[10px] text-zinc-500">{fmtKRW(h.amount, exchangeRate)}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-300">{h.shares}</td>
                  <td className="px-3 py-2 text-right text-red-400">{h.dividendYield.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs ${h.dividendCycle === 'monthly' ? 'text-emerald-400 font-semibold' : h.dividendCycle === 'quarterly' ? 'text-blue-400' : 'text-zinc-400'}`}>
                      {h.dividendCycle === 'monthly' ? '월배당' : h.dividendCycle === 'quarterly' ? '분기' : h.dividendCycle === 'semi-annual' ? '반기' : h.dividendCycle === 'annual' ? '연간' : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="text-teal-400">{fmtUSD(h.monthlyDividend)}</div>
                    <div className="text-[10px] text-zinc-500">{fmtKRW(h.monthlyDividend, exchangeRate)}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-xs font-medium ${h.score >= 80 ? 'text-emerald-400' : h.score >= 60 ? 'text-teal-400' : 'text-zinc-400'}`}>
                      {h.score.toFixed(0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-700/40 text-xs text-zinc-400">
                <td className="px-3 py-2 font-medium text-white">합계</td>
                <td />
                <td className="px-3 py-2 text-right text-white">100%</td>
                <td className="px-3 py-2 text-right">
                  <div className="text-white">{fmtUSD(m.totalInvestment)}</div>
                  <div className="text-[10px] text-zinc-500">{fmtKRW(m.totalInvestment, exchangeRate)}</div>
                </td>
                <td />
                <td className="px-3 py-2 text-right text-emerald-400">{m.weightedYield.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right">
                  <div className="text-teal-400">{fmtUSD(m.expectedMonthlyDividendPostTax)}</div>
                  <div className="text-[10px] text-zinc-500">{fmtKRW(m.expectedMonthlyDividendPostTax, exchangeRate)} (세후)</div>
                </td>
                <td className="px-3 py-2 text-right text-white">{m.avgScore.toFixed(0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sector Distribution */}
      <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/40 p-4">
        <h4 className="text-xs font-semibold text-zinc-400 mb-3">{assetType === 'etf' ? '자산유형 분포' : '리스크 분포'}</h4>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(m.sectorDistribution).map(([sector, weight]) => (
            <div key={sector} className="flex items-center gap-2 bg-zinc-900/50 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-300">{CATEGORY_LABELS[sector] || sector}</span>
              <span className="text-xs text-white font-medium">{weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Projection */}
      {p.years.length > 0 && (
        <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/40 p-4">
          <h4 className="text-xs font-semibold text-zinc-400 mb-3">{p.years.length}년 투자 전망</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-700/40">
                  <th className="px-3 py-2 text-left">연차</th>
                  <th className="px-3 py-2 text-right">포트폴리오 가치</th>
                  <th className="px-3 py-2 text-right">예상 월배당</th>
                  <th className="px-3 py-2 text-right">누적 배당금</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {p.years.map((yr, i) => (
                  <tr key={yr} className="hover:bg-zinc-800/20">
                    <td className="px-3 py-2 text-zinc-400">{yr}년</td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-white">{fmtUSD(p.portfolioValues[i])}</div>
                      <div className="text-[10px] text-zinc-500">{fmtKRW(p.portfolioValues[i], exchangeRate)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-emerald-400">{fmtUSD(p.monthlyDividends[i])}</div>
                      <div className="text-[10px] text-zinc-500">{fmtKRW(p.monthlyDividends[i], exchangeRate)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-teal-400">{fmtUSD(p.totalDividends[i])}</div>
                      <div className="text-[10px] text-zinc-500">{fmtKRW(p.totalDividends[i], exchangeRate)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dividend Calendar */}
      <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/40 p-4">
        <h4 className="text-xs font-semibold text-zinc-400 mb-3">월별 배당 캘린더 (예상)</h4>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {m.dividendCalendar.map((amount, i) => {
            const maxDiv = Math.max(...m.dividendCalendar, 1);
            const intensity = amount / maxDiv;
            return (
              <div key={i} className="text-center">
                <div className="text-[10px] text-zinc-500 mb-1">{i + 1}월</div>
                <div
                  className="rounded-md py-1.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: amount > 0 ? `rgba(16, 185, 129, ${0.1 + intensity * 0.3})` : 'rgba(39, 39, 42, 0.5)',
                    color: amount > 0 ? '#6ee7b7' : '#71717a',
                  }}
                >
                  {amount > 0 ? `$${amount.toFixed(0)}` : '-'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const borderColor = color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-700/40 bg-zinc-800/30';
  const valueColor = color === 'emerald' ? 'text-emerald-400' : 'text-white';
  return (
    <div className={`rounded-xl border p-3 ${borderColor}`}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}
