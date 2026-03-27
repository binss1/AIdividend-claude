'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { demoETFs, gradeFromScore } from '@/data/demoData';

type SortField = 'totalScore' | 'dividendYield' | 'expenseRatio' | 'aum' | 'price' | 'symbol';
type SortDir = 'asc' | 'desc';

function formatAUM(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

const QLEAD_COLORS = {
  Q: { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'Quality' },
  L: { bar: 'bg-blue-500', text: 'text-blue-400', label: 'Liquidity' },
  E: { bar: 'bg-amber-500', text: 'text-amber-400', label: 'Exposure' },
  D: { bar: 'bg-purple-500', text: 'text-purple-400', label: 'Dividend' },
};

export default function DemoETFScreeningPage() {
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' ? 'asc' : 'desc');
    }
  };

  const filteredResults = useMemo(() => {
    let data = [...demoETFs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(e => e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
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
              <p className="text-amber-200/60 text-xs mt-0.5">실제 ETF 스크리닝 결과 샘플입니다. 실시간 데이터로 분석하려면 스크리닝을 시작하세요.</p>
            </div>
          </div>
          <Link
            href="/etf-screening"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            실제 ETF 스크리닝 시작 →
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              ETF 스크리닝 결과
            </h1>
          </div>
          <p className="mt-2 text-zinc-400 text-sm">
            Q-LEAD 모델 - Quality(품질) · Liquidity(유동성) · Exposure(노출도) · Dividend(배당) 4축 종합 평가
          </p>
        </div>

        {/* Q-LEAD Guide */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(QLEAD_COLORS) as [keyof typeof QLEAD_COLORS, typeof QLEAD_COLORS[keyof typeof QLEAD_COLORS]][]).map(([key, cfg]) => (
            <div key={key} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${cfg.bar}`} />
                <span className={`text-sm font-bold ${cfg.text}`}>{key}</span>
                <span className="text-xs text-zinc-500">{cfg.label}</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {key === 'Q' && '운용사 신뢰도, 추적오차, 설정일'}
                {key === 'L' && 'AUM 규모, 거래량, 스프레드'}
                {key === 'E' && '분산투자, 섹터/지역 노출도'}
                {key === 'D' && '배당수익률, 배당성장률, 일관성'}
              </p>
            </div>
          ))}
        </div>

        {/* CC Legend */}
        <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 font-mono font-bold text-[10px]">CC</span>
          <span>= 커버드콜(Covered Call) 전략 ETF — 옵션 매도를 통해 추가 프리미엄 수익 추구</span>
        </div>

        {/* Results Table */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-zinc-800/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-zinc-400">
              총 <span className="text-emerald-400 font-semibold">{filteredResults.length}</span>개 ETF
            </span>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="ETF 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-800/80 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-56 transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-12">#</th>
                  <th className="group px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300" onClick={() => handleSort('symbol')}>
                    티커 <SortIcon field="symbol" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">종목명</th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300" onClick={() => handleSort('price')}>
                    현재가 <SortIcon field="price" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300" onClick={() => handleSort('aum')}>
                    AUM <SortIcon field="aum" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300" onClick={() => handleSort('dividendYield')}>
                    배당수익률 <SortIcon field="dividendYield" />
                  </th>
                  <th className="group px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300" onClick={() => handleSort('expenseRatio')}>
                    운용보수 <SortIcon field="expenseRatio" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider min-w-[160px]">Q-LEAD</th>
                  <th className="group px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300" onClick={() => handleSort('totalScore')}>
                    점수 <SortIcon field="totalScore" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredResults.map((etf, idx) => (
                  <tr
                    key={etf.symbol}
                    className="hover:bg-blue-500/[0.03] cursor-pointer transition-colors duration-150"
                    onClick={() => window.location.href = `/etf/${etf.symbol}`}
                  >
                    <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-100 font-mono text-xs">{etf.symbol}</span>
                        {etf.isCoveredCall && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 font-mono font-bold">CC</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 max-w-[220px] truncate text-xs">{etf.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300 text-xs">${etf.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">{formatAUM(etf.aum)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-400 font-mono text-xs">
                        {(etf.dividendYield * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">
                      {(etf.expenseRatio * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        {(['Q', 'L', 'E', 'D'] as const).map(key => {
                          const score = key === 'Q' ? etf.qualityScore : key === 'L' ? etf.liquidityScore : key === 'E' ? etf.exposureScore : etf.dividendScore;
                          const cfg = QLEAD_COLORS[key];
                          return (
                            <div key={key} className="flex flex-col items-center gap-0.5" title={`${cfg.label}: ${score}`}>
                              <span className={`text-[9px] font-bold ${cfg.text}`}>{key}</span>
                              <div className="w-7 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-200">{etf.totalScore}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          etf.totalScore >= 85 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                          etf.totalScore >= 75 ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' :
                          etf.totalScore >= 65 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                          'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20'
                        }`}>
                          {gradeFromScore(etf.totalScore)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800/60 px-6 py-3 flex items-center justify-between text-xs text-zinc-500">
            <span>
              평균 배당수익률: <span className="text-emerald-400 font-mono">
                {(filteredResults.reduce((s, e) => s + e.dividendYield, 0) / filteredResults.length * 100).toFixed(2)}%
              </span>
            </span>
            <span>
              평균 점수: <span className="text-emerald-400 font-mono">
                {(filteredResults.reduce((s, e) => s + e.totalScore, 0) / filteredResults.length).toFixed(1)}
              </span>
            </span>
          </div>
        </div>

        {/* CTA Bottom */}
        <div className="mt-8 text-center">
          <Link
            href="/etf-screening"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all"
          >
            내 조건으로 ETF 스크리닝 시작하기 →
          </Link>
          <p className="mt-3 text-zinc-500 text-xs">실시간 FMP API 데이터로 분석합니다</p>
        </div>
      </div>
    </div>
  );
}
