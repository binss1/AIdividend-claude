'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/config/api';
import ScoreBar from '@/components/ScoreBar';
import PriceChart from '@/components/PriceChart';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface ETFDetailData {
  symbol: string;
  name: string;
  price: number;
  aum: number;
  expenseRatio: number;      // decimal (0.0006 = 0.06%)
  dividendYield: number;     // decimal (0.04 = 4%)
  qualityScore: number;
  liquidityScore: number;
  exposureScore: number;
  dividendScore: number;
  totalScore: number;
  qualityGrade: string;
  liquidityGrade: string;
  exposureGrade: string;
  dividendGrade: string;
  holdingsCount?: number;
  top10Concentration?: number;
  dividendGrowth5Y?: number;
  beta?: number;
  lastUpdated: string;
}

interface ETFHolding {
  asset: string;
  name: string;
  weightPercentage: number;
}

interface PriceDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatAum(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (grade === 'B+') return 'text-blue-400 bg-blue-500/15 border-blue-500/30';
  if (grade === 'B') return 'text-sky-400 bg-sky-500/15 border-sky-500/30';
  if (grade === 'C') return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30';
  return 'text-red-400 bg-red-500/15 border-red-500/30';
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function ETFDetailPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = params.symbol?.toUpperCase() ?? '';

  const [etf, setEtf] = useState<ETFDetailData | null>(null);
  const [holdings, setHoldings] = useState<ETFHolding[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([]);
  const [lastDividend, setLastDividend] = useState<{ amount: number; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    const base = getApiBaseUrl();

    try {
      const [detailRes, holdingsRes, priceRes, divRes] = await Promise.allSettled([
        fetch(`${base}/screening/etf/${symbol}`),
        fetch(`${base}/screening/etf/${symbol}/holdings`),
        fetch(
          `${base}/screening/stock/${symbol}/historical?from=${
            new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10)
          }&to=${new Date().toISOString().slice(0, 10)}`
        ),
        fetch(`${base}/screening/stock/${symbol}/dividend-history`),
      ]);

      if (detailRes.status === 'fulfilled' && detailRes.value.ok) {
        setEtf(await detailRes.value.json());
      } else {
        setError('ETF 데이터를 불러올 수 없습니다.');
      }

      if (holdingsRes.status === 'fulfilled' && holdingsRes.value.ok) {
        const data = await holdingsRes.value.json();
        setHoldings(Array.isArray(data) ? data : data.holdings ?? []);
      }

      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        const data = await priceRes.value.json();
        setPriceHistory(Array.isArray(data) ? data : data.prices ?? data.data ?? []);
      }

      if (divRes.status === 'fulfilled' && divRes.value.ok) {
        const data = await divRes.value.json();
        const divs = Array.isArray(data) ? data : data.dividends ?? [];
        if (divs.length > 0) {
          const sorted = [...divs].sort((a: { date: string }) => 0).sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date));
          const latest = sorted[0];
          setLastDividend({ amount: latest.dividend ?? latest.amount ?? 0, date: latest.date });
        }
      }
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">{symbol} ETF 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !etf) {
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
            <button onClick={() => router.push('/etf-screening')} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm">
              ETF 스크리닝으로 돌아가기
            </button>
            <button onClick={fetchData} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors text-sm">
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  const qleadCategories = [
    { key: 'quality', label: 'Quality (운용 품질)', score: etf.qualityScore, grade: etf.qualityGrade, desc: '운용보수 효율성' },
    { key: 'liquidity', label: 'Liquidity (유동성)', score: etf.liquidityScore, grade: etf.liquidityGrade, desc: '자산 규모 및 거래량' },
    { key: 'exposure', label: 'Exposure (분산도)', score: etf.exposureScore, grade: etf.exposureGrade, desc: '보유 종목 분산' },
    { key: 'dividend', label: 'Dividend (배당)', score: etf.dividendScore, grade: etf.dividendGrade, desc: '배당수익률 및 성장성' },
  ];

  const top10 = holdings
    .sort((a, b) => (b.weightPercentage || 0) - (a.weightPercentage || 0))
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900/80 to-gray-950 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => router.push('/etf-screening')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            ETF 스크리닝 목록
          </button>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="px-4 py-2 bg-teal-500/15 text-teal-400 text-2xl font-bold rounded-xl border border-teal-500/20 tracking-wider">
                  {etf.symbol}
                </span>
                <span className={`inline-flex items-center justify-center font-bold rounded-full border px-3 py-1 text-sm ${gradeColor(
                  etf.totalScore >= 85 ? 'A+' : etf.totalScore >= 75 ? 'A' : etf.totalScore >= 65 ? 'B+' : etf.totalScore >= 50 ? 'B' : etf.totalScore >= 35 ? 'C' : 'D'
                )}`}>
                  Q-LEAD {etf.totalScore}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">{etf.name}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span>ETF</span>
                {etf.holdingsCount && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span>{etf.holdingsCount}개 보유종목</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right lg:text-right">
              <p className="text-4xl font-bold text-white tracking-tight mb-1">
                ${etf.price.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                배당수익률 <span className="text-emerald-400 font-semibold">{formatPercent(etf.dividendYield)}</span>
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                운용보수 <span className="text-yellow-400 font-semibold">{formatPercent(etf.expenseRatio)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Price Chart */}
        <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            주가 차트
          </h2>
          <PriceChart data={priceHistory} />
        </section>

        {/* Key Metrics */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'AUM (자산규모)', value: formatAum(etf.aum), color: 'text-white', sub: '' },
            { label: '배당수익률', value: formatPercent(etf.dividendYield), color: 'text-emerald-400', sub: '' },
            { label: '최근 배당금', value: lastDividend ? `$${lastDividend.amount.toFixed(4)}` : '-', color: 'text-teal-400', sub: lastDividend ? lastDividend.date : '' },
            { label: '운용보수', value: formatPercent(etf.expenseRatio), color: etf.expenseRatio <= 0.001 ? 'text-emerald-400' : etf.expenseRatio <= 0.005 ? 'text-yellow-400' : 'text-red-400', sub: '' },
            { label: 'Beta', value: etf.beta != null ? etf.beta.toFixed(2) : '-', color: 'text-zinc-300', sub: '' },
          ].map((m, i) => (
            <div key={i} className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 text-center">
              <p className="text-xs text-gray-400 mb-2">{m.label}</p>
              <p className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</p>
              {m.sub && <p className="text-[10px] text-zinc-500 mt-1">{m.sub}</p>}
            </div>
          ))}
        </section>

        {/* Q-LEAD Score Breakdown */}
        <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-emerald-400">📊</span>
            Q-LEAD 점수 분석
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {qleadCategories.map(({ key, label, score, grade, desc }) => (
              <div key={key} className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{label}</h3>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <span className={`inline-flex items-center justify-center font-bold rounded-full border px-2.5 py-0.5 text-xs ${gradeColor(grade)}`}>
                    {grade}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold font-mono text-white w-8 text-right">{score}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Total Score */}
          <div className="mt-6 p-5 bg-gray-800/60 rounded-xl border border-gray-700/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">종합 Q-LEAD 점수</span>
              <span className="text-2xl font-bold text-white">{etf.totalScore}<span className="text-sm text-gray-500 ml-1">/ 100</span></span>
            </div>
            <ScoreBar score={etf.totalScore} />
          </div>
        </section>

        {/* Top Holdings */}
        {top10.length > 0 && (
          <section className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-emerald-400">📋</span>
              상위 보유 종목 (Top 10)
            </h2>
            {etf.top10Concentration != null && (
              <p className="text-xs text-gray-500 mb-4">
                상위 10종목 집중도: <span className="text-zinc-300 font-mono">{etf.top10Concentration.toFixed(1)}%</span>
              </p>
            )}
            <div className="space-y-2">
              {top10.map((h, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-800/40 transition-colors">
                  <span className="text-xs text-gray-500 font-mono w-5">{i + 1}</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono w-14">{h.asset}</span>
                  <span className="text-xs text-gray-300 flex-1 truncate">{h.name}</span>
                  <div className="flex items-center gap-2 w-32">
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${Math.min(h.weightPercentage * 2, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-mono w-12 text-right">
                      {h.weightPercentage?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => router.push('/etf-screening')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            ETF 스크리닝 목록
          </button>
        </div>
      </div>
    </div>
  );
}
