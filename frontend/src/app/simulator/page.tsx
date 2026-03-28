'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiFetch, API_ENDPOINTS } from '@/config/api';

interface Holding {
  id: string;
  symbol: string;
  shares: number;
  avgPrice: number;
}

interface SimResult {
  initialInvestment: number;
  additionalMonthly: number;
  years: number;
  dividendReinvest: boolean;
  dividendGrowthRate: number;
  priceGrowthRate: number;
  holdings: Array<{
    symbol: string;
    name: string;
    shares: number;
    currentPrice: number;
    marketValue: number;
    annualDividend: number;
    dividendYield: number;
  }>;
  finalPortfolioValue: number;
  totalInvested: number;
  totalDividendsReceived: number;
  totalReturn: number;
  totalReturnPercent: number;
  finalAnnualDividendIncome: number;
  finalMonthlyDividendIncome: number;
  yieldOnCost: number;
  yearlySnapshots: Array<{
    year: number;
    portfolioValue: number;
    totalDividends: number;
    totalInvested: number;
    annualDividendIncome: number;
    dividendYield: number;
  }>;
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function formatUSD(v: number): string {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatKRW(v: number, rate: number): string {
  const krw = v * rate;
  if (krw >= 1e8) return `${(krw / 1e8).toFixed(1)}억원`;
  if (krw >= 1e4) return `${(krw / 1e4).toFixed(0)}만원`;
  return `${krw.toFixed(0)}원`;
}

function formatDual(v: number, rate: number): string {
  return `${formatUSD(v)} (${formatKRW(v, rate)})`;
}

export default function SimulatorPage() {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: genId(), symbol: '', shares: 0, avgPrice: 0 },
  ]);
  const [additionalMonthly, setAdditionalMonthly] = useState(500);
  const [years, setYears] = useState(10);
  const [dividendReinvest, setDividendReinvest] = useState(true);
  const [dividendGrowthRate, setDividendGrowthRate] = useState(5);
  const [priceGrowthRate, setPriceGrowthRate] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState('');
  const [exchangeRate, setExchangeRate] = useState(1500);

  useEffect(() => {
    apiFetch<{ rate: number }>(API_ENDPOINTS.EXCHANGE_RATE)
      .then(data => { if (data.rate) setExchangeRate(data.rate); })
      .catch(() => {});
  }, []);

  const addHolding = () => {
    setHoldings([...holdings, { id: genId(), symbol: '', shares: 0, avgPrice: 0 }]);
  };

  const removeHolding = (id: string) => {
    if (holdings.length <= 1) return;
    setHoldings(holdings.filter(h => h.id !== id));
  };

  const updateHolding = (id: string, field: keyof Holding, value: string | number) => {
    setHoldings(holdings.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const validHoldings = useMemo(() =>
    holdings.filter(h => h.symbol.trim() && h.shares > 0),
    [holdings]
  );

  const runSimulation = async () => {
    if (validHoldings.length === 0) {
      setError('최소 1개 종목을 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await apiFetch<SimResult>(API_ENDPOINTS.PORTFOLIO_SIMULATE, {
        method: 'POST',
        body: JSON.stringify({
          stocks: validHoldings.map(h => ({
            symbol: h.symbol.toUpperCase().trim(),
            shares: h.shares,
            avgPrice: h.avgPrice > 0 ? h.avgPrice : undefined,
          })),
          additionalMonthly,
          years,
          dividendReinvest,
          dividendGrowthRate,
          priceGrowthRate,
        }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || '시뮬레이션 실패');
    } finally {
      setLoading(false);
    }
  };

  // Find max value for chart scaling
  const chartMax = result ? Math.max(...result.yearlySnapshots.map(s => s.portfolioValue)) : 0;

  return (
    <div className="min-h-screen bg-gray-950 pt-20 pb-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            포트폴리오 시뮬레이터
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            보유 종목 기반으로 배당 재투자(DRIP) 및 장기 수익을 시뮬레이션합니다
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Input Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Holdings */}
            <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
                보유 종목
              </h3>
              <div className="space-y-2">
                {holdings.map((h, idx) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-4">{idx + 1}</span>
                    <input
                      type="text"
                      placeholder="티커"
                      value={h.symbol}
                      onChange={e => updateHolding(h.id, 'symbol', e.target.value.toUpperCase())}
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="number"
                      placeholder="수량"
                      value={h.shares || ''}
                      onChange={e => updateHolding(h.id, 'shares', Number(e.target.value))}
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="number"
                      placeholder="평단가"
                      value={h.avgPrice || ''}
                      onChange={e => updateHolding(h.id, 'avgPrice', Number(e.target.value))}
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    {holdings.length > 1 && (
                      <button onClick={() => removeHolding(h.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addHolding} className="mt-3 flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                종목 추가
              </button>
              <p className="mt-2 text-[10px] text-zinc-500">평단가를 비우면 현재가로 자동 적용됩니다</p>
            </div>

            {/* Simulation Parameters */}
            <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                시뮬레이션 설정
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">월 추가 투자($)</label>
                  <input
                    type="number"
                    value={additionalMonthly}
                    onChange={e => setAdditionalMonthly(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">투자 기간(년)</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={years}
                    onChange={e => setYears(Math.min(40, Math.max(1, Number(e.target.value))))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">배당 성장률(%/년)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={dividendGrowthRate}
                    onChange={e => setDividendGrowthRate(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">주가 성장률(%/년)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={priceGrowthRate}
                    onChange={e => setPriceGrowthRate(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dividendReinvest}
                  onChange={e => setDividendReinvest(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-300">배당금 자동 재투자 (DRIP)</span>
              </label>

              <p className="text-[10px] text-zinc-500 leading-relaxed">
                배당 성장률: 연간 배당금 증가 비율 (S&P500 평균 ~5~7%)<br/>
                주가 성장률: 연간 주가 상승 비율 (S&P500 장기 평균 ~7~10%)
              </p>
            </div>

            {/* Run Button */}
            <button
              onClick={runSimulation}
              disabled={loading || validHoldings.length === 0}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  시뮬레이션 중...
                </span>
              ) : '시뮬레이션 실행'}
            </button>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
            )}
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2 space-y-4">
            {!result && !loading && (
              <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-zinc-500">보유 종목을 입력하고 시뮬레이션을 실행하세요</p>
              </div>
            )}

            {result && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SummaryCard
                    label="최종 포트폴리오"
                    value={formatUSD(result.finalPortfolioValue)}
                    sub={formatKRW(result.finalPortfolioValue, exchangeRate)}
                    sub2={`${result.totalReturnPercent >= 0 ? '+' : ''}${result.totalReturnPercent.toFixed(1)}% 수익`}
                    color={result.totalReturnPercent >= 0 ? 'emerald' : 'red'}
                  />
                  <SummaryCard
                    label="총 투자금"
                    value={formatUSD(result.totalInvested)}
                    sub={formatKRW(result.totalInvested, exchangeRate)}
                    sub2={`초기 ${formatUSD(result.initialInvestment)}`}
                    color="zinc"
                  />
                  <SummaryCard
                    label="연간 배당 수입"
                    value={formatUSD(result.finalAnnualDividendIncome)}
                    sub={formatKRW(result.finalAnnualDividendIncome, exchangeRate)}
                    sub2={`월 ${formatUSD(result.finalMonthlyDividendIncome)} (${formatKRW(result.finalMonthlyDividendIncome, exchangeRate)})`}
                    color="emerald"
                  />
                  <SummaryCard
                    label="총 수령 배당금"
                    value={formatUSD(result.totalDividendsReceived)}
                    sub={formatKRW(result.totalDividendsReceived, exchangeRate)}
                    sub2={`YOC ${result.yieldOnCost.toFixed(1)}%`}
                    color="teal"
                  />
                </div>

                {/* Holdings Table */}
                <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/60">
                    <h3 className="text-sm font-semibold text-white">보유 종목 분석</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/40 text-xs text-zinc-500">
                          <th className="px-4 py-2 text-left">종목</th>
                          <th className="px-3 py-2 text-right">수량</th>
                          <th className="px-3 py-2 text-right">현재가</th>
                          <th className="px-3 py-2 text-right">평가금</th>
                          <th className="px-3 py-2 text-right">연배당</th>
                          <th className="px-3 py-2 text-right">수익률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/30">
                        {result.holdings.map(h => (
                          <tr key={h.symbol} className="hover:bg-zinc-800/30">
                            <td className="px-4 py-2">
                              <div className="font-semibold text-white">{h.symbol}</div>
                              <div className="text-xs text-zinc-500 truncate max-w-[150px]">{h.name}</div>
                            </td>
                            <td className="px-3 py-2 text-right text-zinc-300">{h.shares.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-zinc-300">${h.currentPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="text-white">{formatUSD(h.marketValue)}</div>
                              <div className="text-[10px] text-zinc-500">{formatKRW(h.marketValue, exchangeRate)}</div>
                            </td>
                            <td className="px-3 py-2 text-right text-zinc-300">${h.annualDividend.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-emerald-400">{h.dividendYield.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Growth Chart (Bar-based) */}
                <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">연도별 포트폴리오 성장</h3>
                  <div className="space-y-2">
                    {result.yearlySnapshots.map(snap => {
                      const pctWidth = chartMax > 0 ? (snap.portfolioValue / chartMax * 100) : 0;
                      const investedWidth = chartMax > 0 ? (snap.totalInvested / chartMax * 100) : 0;
                      return (
                        <div key={snap.year} className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500 w-10 text-right shrink-0">{snap.year}년</span>
                          <div className="flex-1 relative h-7 bg-zinc-800/50 rounded-lg overflow-hidden">
                            {/* Invested bar */}
                            <div
                              className="absolute inset-y-0 left-0 bg-zinc-600/40 rounded-lg"
                              style={{ width: `${investedWidth}%` }}
                            />
                            {/* Portfolio value bar */}
                            <div
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/70 to-teal-500/70 rounded-lg"
                              style={{ width: `${pctWidth}%` }}
                            />
                            <div className="relative z-10 flex items-center h-full px-2 gap-2">
                              <span className="text-xs font-medium text-white drop-shadow-sm">
                                {formatUSD(snap.portfolioValue)}
                              </span>
                              <span className="text-[10px] text-zinc-400 drop-shadow-sm">
                                {formatKRW(snap.portfolioValue, exchangeRate)}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-500 w-24 text-right shrink-0">
                            배당 {formatUSD(snap.annualDividendIncome)}/년
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 rounded-sm bg-gradient-to-r from-emerald-500/70 to-teal-500/70" />
                      포트폴리오 가치
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 rounded-sm bg-zinc-600/40" />
                      총 투자금
                    </span>
                  </div>
                </div>

                {/* Yearly Detail Table */}
                <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/60 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/60">
                    <h3 className="text-sm font-semibold text-white">연도별 상세</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/40 text-xs text-zinc-500">
                          <th className="px-4 py-2 text-center">연차</th>
                          <th className="px-3 py-2 text-right">포트폴리오</th>
                          <th className="px-3 py-2 text-right">총 투자금</th>
                          <th className="px-3 py-2 text-right">누적 배당금</th>
                          <th className="px-3 py-2 text-right">연 배당 수입</th>
                          <th className="px-3 py-2 text-right">수익률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/30">
                        {result.yearlySnapshots.map(snap => {
                          const returnPct = snap.totalInvested > 0
                            ? ((snap.portfolioValue - snap.totalInvested) / snap.totalInvested * 100)
                            : 0;
                          return (
                            <tr key={snap.year} className="hover:bg-zinc-800/30">
                              <td className="px-4 py-2 text-center text-zinc-400">{snap.year}</td>
                              <td className="px-3 py-2 text-right">
                                <div className="font-medium text-white">{formatUSD(snap.portfolioValue)}</div>
                                <div className="text-[10px] text-zinc-500">{formatKRW(snap.portfolioValue, exchangeRate)}</div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="text-zinc-400">{formatUSD(snap.totalInvested)}</div>
                                <div className="text-[10px] text-zinc-500">{formatKRW(snap.totalInvested, exchangeRate)}</div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="text-teal-400">{formatUSD(snap.totalDividends)}</div>
                                <div className="text-[10px] text-zinc-500">{formatKRW(snap.totalDividends, exchangeRate)}</div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="text-emerald-400">{formatUSD(snap.annualDividendIncome)}</div>
                                <div className="text-[10px] text-zinc-500">{formatKRW(snap.annualDividendIncome, exchangeRate)}</div>
                              </td>
                              <td className={`px-3 py-2 text-right font-medium ${returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, sub2, color }: { label: string; value: string; sub: string; sub2?: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    teal: 'border-teal-500/20 bg-teal-500/5',
    red: 'border-red-500/20 bg-red-500/5',
    zinc: 'border-zinc-700/40 bg-zinc-800/30',
  };
  const textColors: Record<string, string> = {
    emerald: 'text-emerald-400',
    teal: 'text-teal-400',
    red: 'text-red-400',
    zinc: 'text-white',
  };

  return (
    <div className={`rounded-xl border p-3 ${colors[color] || colors.zinc}`}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold mt-1 ${textColors[color] || 'text-white'}`}>{value}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
      {sub2 && <div className="text-[10px] text-zinc-500 mt-0.5">{sub2}</div>}
    </div>
  );
}
