'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_ENDPOINTS } from '@/config/api';
import PortfolioRecommendation from '@/components/PortfolioRecommendation';
import ScoreBar from '@/components/ScoreBar';

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
                  .filter(([key]) => !['batchSize', 'sortBy', 'limit', 'skipSummary'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-zinc-800/40 px-3 py-2">
                      <div className="text-[10px] text-zinc-500">{formatCriteriaLabel(key)}</div>
                      <div className="text-sm text-white font-medium mt-0.5">{formatCriteriaValue(key, value)}</div>
                    </div>
                  ))}
              </div>

              {/* Skip Summary */}
              {(() => {
                const ss = detail.session.criteria.skipSummary as Record<string, number> | undefined;
                if (!ss || Object.keys(ss).length === 0) return null;
                const total = Object.values(ss).reduce((a, b) => a + (b as number), 0);
                return (
                  <div className="pt-3 border-t border-zinc-800/40">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">탈락 사유 요약</span>
                      <span className="text-[10px] text-zinc-600">({total}건)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ss)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .map(([reason, count]) => (
                          <span key={reason} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/50 text-[10px]">
                            <span className="text-zinc-400">{reason}</span>
                            <span className="text-amber-400 font-mono">{count as number}</span>
                            <span className="text-zinc-600">({((count as number) / total * 100).toFixed(0)}%)</span>
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Results Table */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20">
              {/* Toolbar */}
              <div className="flex flex-col gap-3 border-b border-zinc-800/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                  </div>
                  <span className="text-sm text-zinc-400">
                    총 <span className="text-emerald-400 font-semibold">{detail.results.length}</span>개 종목
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    {detail.session.session_date} {isETF ? 'ETF' : '배당주'} {detail.session.session_number}회차
                  </span>
                  <button
                    onClick={async () => {
                      const XLSX = await import('xlsx');
                      const rows = detail.results.map((item: any, idx: number) => {
                        if (isETF) {
                          return {
                            '순위': idx + 1, '티커': item.symbol, 'ETF명': item.name,
                            '가격($)': item.price?.toFixed(2), 'AUM': item.aum,
                            '배당수익률(%)': ((item.dividendYield || 0) * 100).toFixed(2),
                            '운용보수(%)': ((item.expenseRatio || 0) * 100).toFixed(3),
                            'Q-LEAD': item.totalScore?.toFixed(1),
                          };
                        }
                        return {
                          '순위': idx + 1, '티커': item.symbol, '종목명': item.name,
                          '현재가($)': item.currentPrice?.toFixed(2),
                          '배당수익률(%)': item.dividendYield?.toFixed(2),
                          '배당성향(%)': item.payoutRatio?.toFixed(1),
                          '시가총액': item.marketCap, 'P/E': item.pe?.toFixed(1),
                          'ROE(%)': item.roe?.toFixed(1), '배당주기': item.dividendCycle,
                          '점수': item.overallScore, '등급': item.grade,
                        };
                      });
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, '스크리닝 이력');
                      XLSX.writeFile(wb, `${detail.session.session_date}_${isETF ? 'ETF' : '배당주'}_${detail.session.session_number}회차.xlsx`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-all"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Excel
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {isETF ? (
                  <ETFResultTable results={detail.results} />
                ) : (
                  <StockResultTable results={detail.results} />
                )}
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

function formatMarketCap(v: number | undefined): string {
  if (!v) return '-';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function getGradeStyle(grade: string): string {
  switch (grade) {
    case 'A+': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'A': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'B+': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'B': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'C': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
}

function getScoreGradeETF(score: number): string {
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B+';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

const QLEAD_COLORS = {
  quality: { bar: 'bg-emerald-500', bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Q' },
  liquidity: { bar: 'bg-blue-500', bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'L' },
  exposure: { bar: 'bg-amber-500', bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'E' },
  dividend: { bar: 'bg-purple-500', bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'D' },
};

// ==========================================
// ETF Result Table (matches etf-screening page)
// ==========================================

function ETFResultTable({ results }: { results: any[] }) {
  const router = useRouter();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
          <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-12">#</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">티커</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ETF명</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">가격</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">AUM</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">배당수익률</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">운용보수</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Q-LEAD</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider min-w-[140px]">총점</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">등급</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/40">
        {results.map((etf: any, idx: number) => {
          const grade = getScoreGradeETF(etf.totalScore || 0);
          return (
            <tr key={etf.symbol || idx} className="hover:bg-emerald-500/[0.03] transition-colors duration-150">
              <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{idx + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-100 font-mono text-xs hover:text-emerald-400 cursor-pointer transition-colors"
                    onClick={() => router.push(`/etf/${etf.symbol}`)}>{etf.symbol}</span>
                  {etf.isCoveredCall && (
                    <span className="shrink-0 rounded bg-orange-500/15 px-1 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/20">CC</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-300 max-w-[200px] truncate text-xs hover:text-zinc-100 cursor-pointer transition-colors"
                onClick={() => router.push(`/etf/${etf.symbol}`)}>{etf.name}</td>
              <td className="px-4 py-3 text-right font-mono text-zinc-300 text-xs">${(etf.price || 0).toFixed(2)}</td>
              <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{formatAUM(etf.aum)}</td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-emerald-400 font-mono text-xs">
                  {((etf.dividendYield || 0) * 100).toFixed(2)}%
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">
                {((etf.expenseRatio || 0) * 100).toFixed(2)}%
              </td>
              <td className="px-4 py-3">
                <QLeadMiniBars etf={etf} />
              </td>
              <td className="px-4 py-3">
                <ScoreBar score={etf.totalScore || 0} />
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center justify-center font-bold rounded-full border px-2 py-0.5 text-xs ${getGradeStyle(grade)}`}>
                  {grade}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ==========================================
// Q-LEAD Mini Bars
// ==========================================

function QLeadMiniBars({ etf }: { etf: any }) {
  const items = [
    { score: etf.qualityScore || 0, ...QLEAD_COLORS.quality },
    { score: etf.liquidityScore || 0, ...QLEAD_COLORS.liquidity },
    { score: etf.exposureScore || 0, ...QLEAD_COLORS.exposure },
    { score: etf.dividendScore || 0, ...QLEAD_COLORS.dividend },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="group/bar relative">
          <div className={`w-6 h-3 rounded-sm ${item.bg} overflow-hidden`}>
            <div className={`h-full rounded-sm ${item.bar}`} style={{ width: `${Math.min(item.score, 100)}%` }} />
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
}

// ==========================================
// Stock Result Table (matches screening page)
// ==========================================

function StockResultTable({ results }: { results: any[] }) {
  const router = useRouter();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
          <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider w-12">#</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">티커</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">종목명</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">현재가</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">배당수익률</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">배당성향</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">시가총액</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">P/E</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">ROE</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">배당주기</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider min-w-[140px]">점수</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">등급</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/40">
        {results.map((s: any, idx: number) => (
          <tr key={s.symbol || idx} className="hover:bg-emerald-500/[0.03] transition-colors duration-150">
            <td className="px-4 py-3 text-zinc-600 font-mono text-xs text-center">{idx + 1}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-zinc-100 font-mono text-xs hover:text-emerald-400 cursor-pointer transition-colors"
                  onClick={() => router.push(`/stock/${s.symbol}`)}>{s.symbol}</span>
                {s.isREIT && (
                  <span className="shrink-0 rounded bg-purple-500/15 px-1 py-0.5 text-[9px] font-bold text-purple-400 border border-purple-500/20">REIT</span>
                )}
              </div>
            </td>
            <td className="px-4 py-3 text-zinc-300 max-w-[180px] truncate text-xs hover:text-zinc-100 cursor-pointer transition-colors"
              onClick={() => router.push(`/stock/${s.symbol}`)}>{s.name}</td>
            <td className="px-4 py-3 text-right font-mono text-zinc-300 text-xs">${(s.currentPrice || 0).toFixed(2)}</td>
            <td className="px-4 py-3 text-right">
              <span className="font-semibold text-emerald-400 font-mono text-xs">{(s.dividendYield || 0).toFixed(2)}%</span>
            </td>
            <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">{(s.payoutRatio || 0).toFixed(1)}%</td>
            <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{formatMarketCap(s.marketCap)}</td>
            <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">{(s.pe || 0).toFixed(1)}</td>
            <td className="px-4 py-3 text-right">
              <span className={`font-mono text-xs ${(s.roe || 0) >= 15 ? 'text-emerald-400' : (s.roe || 0) < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                {(s.roe || 0).toFixed(1)}%
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <span className={`text-xs ${s.dividendCycle === 'monthly' ? 'text-emerald-400 font-semibold' : 'text-zinc-400'}`}>
                {s.dividendCycle === 'monthly' ? '월배당' : s.dividendCycle === 'quarterly' ? '분기' : s.dividendCycle === 'semi-annual' ? '반기' : s.dividendCycle === 'annual' ? '연간' : '-'}
              </span>
            </td>
            <td className="px-4 py-3">
              <ScoreBar score={s.overallScore || 0} />
            </td>
            <td className="px-4 py-3 text-center">
              <span className={`inline-flex items-center justify-center font-bold rounded-full border px-2 py-0.5 text-xs ${getGradeStyle(s.grade || 'D')}`}>
                {s.grade || 'D'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
