'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { demoStocks } from '@/data/demoData';
import GradeBadge from '@/components/GradeBadge';
import ScoreBar from '@/components/ScoreBar';

type SortField = 'overallScore' | 'dividendYield' | 'payoutRatio' | 'marketCap' | 'currentPrice' | 'pe' | 'roe' | 'symbol' | 'name';
type SortDir = 'asc' | 'desc';

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

export default function DemoScreeningPage() {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('overallScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' || field === 'name' ? 'asc' : 'desc');
    }
  };

  const filteredResults = useMemo(() => {
    let data = [...demoStocks];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector?.toLowerCase().includes(q)
      );
    }
    data.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return data;
  }, [sortField, sortDir, searchQuery]);

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

  const avgYield = filteredResults.reduce((s, r) => s + r.dividendYield, 0) / filteredResults.length;
  const avgScore = filteredResults.reduce((s, r) => s + r.overallScore, 0) / filteredResults.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">

        {/* Demo Banner */}
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-300 font-semibold text-sm">미리보기 데모</p>
              <p className="text-amber-200/60 text-xs mt-0.5">실제 스크리닝 결과 샘플입니다. 실시간 데이터로 분석하려면 스크리닝을 시작하세요.</p>
            </div>
          </div>
          <Link
            href="/screening"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            실제 스크리닝 시작 →
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              배당주 스크리닝 결과
            </h1>
          </div>
          <p className="mt-2 text-zinc-400 text-sm">
            5축 평가 모델 (안정성 30% · 수익성 20% · 성장성 15% · 가치 15% · 배당 20%) 기반 종합 분석 결과
          </p>
        </div>

        {/* Score Guide */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: '안정성', weight: '30%', desc: '연속배당, 배당일관성', color: 'emerald' },
            { label: '수익성', weight: '20%', desc: 'ROE, 영업이익률', color: 'blue' },
            { label: '성장성', weight: '15%', desc: '매출/이익 성장률', color: 'purple' },
            { label: '가치', weight: '15%', desc: 'P/E, P/B, 배당성향', color: 'amber' },
            { label: '배당', weight: '20%', desc: '배당수익률, FCF배당성향', color: 'teal' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 text-center">
              <div className={`text-xs font-semibold text-${item.color}-400`}>{item.label}</div>
              <div className="text-lg font-bold text-zinc-100 mt-0.5">{item.weight}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</div>
            </div>
          ))}
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
                총 <span className="text-emerald-400 font-semibold">{filteredResults.length}</span>개 종목
                {searchQuery && demoStocks.length !== filteredResults.length && (
                  <span className="text-zinc-600 ml-1">(전체 {demoStocks.length}개)</span>
                )}
              </span>
            </div>
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
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-12">#</th>
                  <th className="group px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('symbol')}>
                    티커 <SortIcon field="symbol" />
                  </th>
                  <th className="group px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('name')}>
                    종목명 <SortIcon field="name" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('currentPrice')}>
                    현재가 <SortIcon field="currentPrice" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('dividendYield')}>
                    배당수익률 <SortIcon field="dividendYield" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('payoutRatio')}>
                    배당성향 <SortIcon field="payoutRatio" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('marketCap')}>
                    시가총액 <SortIcon field="marketCap" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('pe')}>
                    P/E <SortIcon field="pe" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('roe')}>
                    ROE <SortIcon field="roe" />
                  </th>
                  <th className="group px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 min-w-[140px] transition-colors" onClick={() => handleSort('overallScore')}>
                    점수 <SortIcon field="overallScore" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">등급</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredResults.map((stock, idx) => (
                  <tr
                    key={stock.symbol}
                    className="hover:bg-emerald-500/[0.03] transition-colors duration-150"
                  >
                    <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-100 font-mono text-xs">{stock.symbol}</span>
                        {stock.isREIT && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 font-medium">REIT</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 max-w-[180px] truncate text-xs">{stock.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300 text-xs">${stock.currentPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-400 font-mono text-xs">{stock.dividendYield.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">{stock.payoutRatio.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{formatMarketCap(stock.marketCap)}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">{stock.pe > 0 ? stock.pe.toFixed(1) : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <span className={stock.roe >= 15 ? 'text-emerald-400' : stock.roe >= 10 ? 'text-zinc-300' : 'text-zinc-500'}>
                        {stock.roe.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3"><ScoreBar score={stock.overallScore} /></td>
                    <td className="px-4 py-3 text-center"><GradeBadge grade={stock.grade} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Summary */}
          <div className="border-t border-zinc-800/60 px-6 py-3 flex items-center justify-between text-xs text-zinc-500">
            <span>
              평균 배당수익률: <span className="text-emerald-400 font-mono">{avgYield.toFixed(2)}%</span>
            </span>
            <span>
              평균 점수: <span className="text-emerald-400 font-mono">{avgScore.toFixed(1)}</span>
            </span>
          </div>
        </div>

        {/* CTA Bottom */}
        <div className="mt-8 text-center">
          <Link
            href="/screening"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all"
          >
            내 조건으로 스크리닝 시작하기 →
          </Link>
          <p className="mt-3 text-zinc-500 text-xs">실시간 FMP API 데이터로 분석합니다</p>
        </div>
      </div>
    </div>
  );
}
