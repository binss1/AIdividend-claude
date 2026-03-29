'use client';

import { useState, useEffect } from 'react';
import { apiFetch, API_ENDPOINTS } from '@/config/api';
import PortfolioRecommendation from '@/components/PortfolioRecommendation';

// ==========================================
// Types
// ==========================================

interface SessionItem {
  id: number;
  asset_type: string;
  session_date: string;
  session_number: number;
  result_count: number;
  created_at: string;
  label: string;
}

interface SessionDetail {
  session: {
    id: number;
    asset_type: string;
    session_date: string;
    session_number: number;
    criteria: Record<string, unknown>;
    result_count: number;
    created_at: string;
  };
  results: unknown[];
}

// ==========================================
// Helpers
// ==========================================

function formatCriteriaLabel(key: string): string {
  const labels: Record<string, string> = {
    minDividendYield: '최소 배당수익률',
    minMarketCapUSD: '최소 시가총액',
    maxPayoutRatio: '최대 배당성향',
    minConsecutiveDividendYears: '최소 연속배당 연수',
    maxStocksToCheck: '최대 분석 종목수',
    batchSize: '배치 크기',
    indexOnly: '인덱스 종목만',
    minAUM: '최소 AUM',
    maxExpenseRatio: '최대 운용보수',
    maxETFsToCheck: '최대 분석 종목수',
    sortBy: '정렬 기준',
    limit: '결과 제한',
  };
  return labels[key] || key;
}

function formatCriteriaValue(key: string, value: unknown): string {
  if (key === 'minMarketCapUSD' || key === 'minAUM') {
    const v = Number(value);
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v.toLocaleString()}`;
  }
  if (key === 'minDividendYield') return `${value}%`;
  if (key === 'maxPayoutRatio') return `${value}%`;
  if (key === 'maxExpenseRatio') return `${(Number(value) * 100).toFixed(2)}%`;
  if (key === 'indexOnly') return value ? 'S&P500 + NASDAQ100' : '전체 미국 배당주';
  return String(value);
}

// ==========================================
// Page Component
// ==========================================

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(1400);

  // Load session list + exchange rate on mount
  useEffect(() => {
    apiFetch<{ sessions: SessionItem[] }>(API_ENDPOINTS.SCREENING_HISTORY)
      .then(data => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));

    apiFetch<{ rate: number }>(API_ENDPOINTS.EXCHANGE_RATE)
      .then(data => { if (data.rate) setExchangeRate(data.rate); })
      .catch(() => {});
  }, []);

  // Load detail when session selected
  useEffect(() => {
    if (selectedId === null) { setDetail(null); return; }
    setLoading(true);
    apiFetch<SessionDetail>(API_ENDPOINTS.SCREENING_HISTORY_DETAIL(selectedId))
      .then(data => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const handleDelete = async (id: number) => {
    if (!confirm('이 스크리닝 이력을 삭제하시겠습니까?')) return;
    try {
      await apiFetch(API_ENDPOINTS.SCREENING_HISTORY_DETAIL(id), { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
    } catch { /* ignore */ }
  };

  const isETF = detail?.session.asset_type === 'etf';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            스크리닝 이력
          </h1>
          <p className="text-sm text-zinc-400 mt-1">과거 스크리닝 결과를 조회하고 포트폴리오 추천을 받을 수 있습니다</p>
        </div>

        {/* Session Selector */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            스크리닝 이력 선택
          </h3>

          {loadingSessions ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              이력 불러오는 중...
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">저장된 스크리닝 이력이 없습니다. 스크리닝을 실행하면 자동으로 저장됩니다.</p>
          ) : (
            <div className="flex items-center gap-3">
              <select
                value={selectedId ?? ''}
                onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none cursor-pointer"
              >
                <option value="">-- 이력을 선택하세요 --</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              {selectedId && (
                <button
                  onClick={() => handleDelete(selectedId)}
                  className="px-3 py-2.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-12 text-center">
            <svg className="w-8 h-8 animate-spin mx-auto text-emerald-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <p className="text-zinc-400 mt-3 text-sm">데이터 불러오는 중...</p>
          </div>
        )}

        {/* Detail View */}
        {detail && !loading && (
          <>
            {/* Session Info + Criteria */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                  스크리닝 조건
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isETF ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                    {isETF ? 'ETF' : '배당주'}
                  </span>
                  <span className="text-xs text-zinc-500">{detail.session.session_date} {detail.session.session_number}회차</span>
                  <span className="text-xs text-zinc-500">({detail.session.result_count}종목)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(detail.session.criteria)
                  .filter(([key]) => !['batchSize', 'sortBy', 'limit'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-zinc-800/40 px-3 py-2">
                      <div className="text-[10px] text-zinc-500">{formatCriteriaLabel(key)}</div>
                      <div className="text-sm text-white font-medium mt-0.5">{formatCriteriaValue(key, value)}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                  스크리닝 결과
                </h3>
                <span className="text-xs text-zinc-500">총 {detail.results.length}종목</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 border-b border-zinc-800/40">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">티커</th>
                      <th className="px-3 py-2 text-left">{isETF ? 'ETF명' : '종목명'}</th>
                      <th className="px-3 py-2 text-right">가격</th>
                      <th className="px-3 py-2 text-right">배당수익률</th>
                      {isETF ? (
                        <>
                          <th className="px-3 py-2 text-right">AUM</th>
                          <th className="px-3 py-2 text-right">운용보수</th>
                          <th className="px-3 py-2 text-right">Q-LEAD</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-right">배당성향</th>
                          <th className="px-3 py-2 text-right">시가총액</th>
                          <th className="px-3 py-2 text-right">점수</th>
                          <th className="px-3 py-2 text-right">등급</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {detail.results.map((item: any, idx: number) => (
                      <tr key={item.symbol || idx} className="hover:bg-zinc-800/30">
                        <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-white">{item.symbol}</td>
                        <td className="px-3 py-2 text-zinc-300 truncate max-w-[200px]">{item.name}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">
                          ${(item.currentPrice || item.price || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-400">
                          {isETF
                            ? `${((item.dividendYield || 0) * 100).toFixed(2)}%`
                            : `${(item.dividendYield || 0).toFixed(2)}%`}
                        </td>
                        {isETF ? (
                          <>
                            <td className="px-3 py-2 text-right text-zinc-300">
                              {formatAUM(item.aum)}
                            </td>
                            <td className="px-3 py-2 text-right text-zinc-300">
                              {((item.expenseRatio || 0) * 100).toFixed(2)}%
                            </td>
                            <td className="px-3 py-2 text-right text-white font-medium">
                              {(item.totalScore || 0).toFixed(1)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-right text-zinc-300">
                              {(item.payoutRatio || 0).toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-right text-zinc-300">
                              {formatAUM(item.marketCap)}
                            </td>
                            <td className="px-3 py-2 text-right text-white font-medium">
                              {(item.overallScore || 0).toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                item.grade === 'A+' ? 'bg-emerald-500/20 text-emerald-400' :
                                item.grade === 'A' ? 'bg-green-500/20 text-green-400' :
                                item.grade === 'B+' ? 'bg-teal-500/20 text-teal-400' :
                                item.grade === 'B' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-zinc-500/20 text-zinc-400'
                              }`}>
                                {item.grade}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Portfolio Recommendation */}
            {detail.results.length > 0 && (
              <PortfolioRecommendation
                assetType={detail.session.asset_type as 'stock' | 'etf'}
                assets={detail.results}
                exchangeRate={exchangeRate}
              />
            )}
          </>
        )}

        {/* Empty state when no session selected */}
        {!selectedId && !loadingSessions && sessions.length > 0 && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-zinc-500">위 콤보박스에서 스크리닝 이력을 선택해 주세요</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatAUM(v: number | undefined): string {
  if (!v) return '-';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}
