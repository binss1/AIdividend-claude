'use client';

import Link from 'next/link';
import { demoStocks, demoETFs, gradeFromScore } from '@/data/demoData';
import GradeBadge from '@/components/GradeBadge';
import ScoreBar from '@/components/ScoreBar';

const EXCHANGE_RATE = 1501.66;
const top5Stocks = demoStocks.slice(0, 5);
const top5ETFs = demoETFs.slice(0, 5);
const avgYield = demoStocks.reduce((s, r) => s + r.dividendYield, 0) / demoStocks.length;
const topStock = demoStocks[0];

const marketData = [
  { label: 'S&P 500', icon: '📊', value: '5,892.38', change: '+0.42%', up: true },
  { label: 'NASDAQ', icon: '📈', value: '18,432.65', change: '+0.78%', up: true },
  { label: '미국 10년물 금리', icon: '💰', value: '4.28%', change: '-0.03%', up: false },
  { label: 'VIX', icon: '⚡', value: '15.82', change: '-2.14%', up: false },
];

function formatKRW(usd: number): string {
  const krw = usd * EXCHANGE_RATE;
  if (krw >= 1e8) return `${Math.round(krw / 1e4).toLocaleString()}만원`;
  return `${Math.round(krw).toLocaleString()}원`;
}

export default function DemoDashboardPage() {
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
              <p className="text-amber-200/60 text-xs mt-0.5">스크리닝을 실행하면 실시간 데이터가 이 대시보드에 반영됩니다.</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all shrink-0"
          >
            실제 대시보드 보기 →
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            포트폴리오 대시보드
          </h1>
          <p className="mt-2 text-zinc-400 text-sm">스크리닝 결과 요약, 시장 지수, 환율을 한눈에 확인</p>
        </div>

        {/* Top Cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {/* Exchange Rate */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 mb-3 text-xs text-zinc-500">
              <span className="text-base">💱</span>
              USD/KRW 환율
            </div>
            <p className="text-3xl font-bold text-zinc-100 font-mono">
              {EXCHANGE_RATE.toLocaleString()} <span className="text-lg text-zinc-400">원</span>
            </p>
            <p className="mt-1.5 text-[11px] text-zinc-600">exchangerate-api.com · 3분 전</p>
          </div>

          {/* Stock Screening CTA */}
          <Link href="/screening" className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/20 hover:border-emerald-500/30 transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            </div>
            <p className="font-semibold text-zinc-100">배당주 스크리닝 시작</p>
            <p className="text-xs text-zinc-500 mt-1">AI 기반 미국 배당주 분석 및 스크리닝</p>
          </Link>

          {/* ETF Screening CTA */}
          <Link href="/etf-screening" className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/20 hover:border-blue-500/30 transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 mb-3">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
            </div>
            <p className="font-semibold text-zinc-100">ETF 스크리닝 시작</p>
            <p className="text-xs text-zinc-500 mt-1">배당 ETF 분석 및 비교</p>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-center">
            <p className="text-xs text-zinc-500 mb-1">분석된 종목 수</p>
            <p className="text-2xl font-bold text-zinc-100">{demoStocks.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-center">
            <p className="text-xs text-zinc-500 mb-1">분석된 ETF 수</p>
            <p className="text-2xl font-bold text-zinc-100">{demoETFs.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-center">
            <p className="text-xs text-zinc-500 mb-1">평균 배당수익률</p>
            <p className="text-2xl font-bold text-emerald-400">{avgYield.toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-center">
            <p className="text-xs text-zinc-500 mb-1">최고 등급 종목</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-lg font-bold text-zinc-100">{topStock.symbol}</span>
              <GradeBadge grade={topStock.grade} size="sm" />
            </div>
          </div>
        </div>

        {/* Top 5 Grid */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          {/* Top 5 Stocks */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <span className="text-base">📈</span>
                <span className="font-semibold text-zinc-100">상위 배당주 TOP 5</span>
              </div>
              <span className="text-[11px] text-zinc-600">방금 전</span>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {top5Stocks.map((stock, idx) => (
                <div key={stock.symbol} className="flex items-center gap-4 px-6 py-3.5 hover:bg-emerald-500/[0.03] transition-colors cursor-pointer">
                  <span className="text-zinc-600 text-sm w-6 text-center font-mono">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100 text-sm">{stock.symbol}</span>
                      <GradeBadge grade={stock.grade} size="sm" />
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{stock.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-emerald-400">수익률 {stock.dividendYield.toFixed(2)}%</span>
                      <ScoreBar score={stock.overallScore} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400">{formatKRW(stock.currentPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 ETFs */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <span className="text-base">🧩</span>
                <span className="font-semibold text-zinc-100">상위 ETF TOP 5</span>
              </div>
              <span className="text-[11px] text-zinc-600">방금 전</span>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {top5ETFs.map((etf, idx) => (
                <div key={etf.symbol} className="flex items-center gap-4 px-6 py-3.5 hover:bg-blue-500/[0.03] transition-colors cursor-pointer">
                  <span className="text-zinc-600 text-sm w-6 text-center font-mono">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100 text-sm">{etf.symbol}</span>
                      {etf.isCoveredCall && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 font-mono font-bold">CC</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        etf.totalScore >= 85 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                        etf.totalScore >= 75 ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' :
                        'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      }`}>
                        {gradeFromScore(etf.totalScore)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{etf.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-emerald-400">수익률 {(etf.dividendYield * 100).toFixed(2)}%</span>
                      <span className="text-xs text-zinc-500">보수 {(etf.expenseRatio * 100).toFixed(2)}%</span>
                      <ScoreBar score={etf.totalScore} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400">{formatKRW(etf.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Market Overview */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20 mb-8">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-zinc-800/60">
            <span className="text-base">🌐</span>
            <span className="font-semibold text-zinc-100">시장 개요</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-800/40">
            {marketData.map(item => (
              <div key={item.label} className="p-5 text-center">
                <p className="text-lg mb-1">{item.icon}</p>
                <p className="text-xs text-zinc-500 mb-2">{item.label}</p>
                <p className="text-lg font-bold text-zinc-100 font-mono">{item.value}</p>
                <p className={`text-xs font-mono mt-1 ${item.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {item.change}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Bottom */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/screening"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all"
            >
              배당주 스크리닝 시작 →
            </Link>
            <Link
              href="/etf-screening"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all"
            >
              ETF 스크리닝 시작 →
            </Link>
          </div>
          <p className="mt-3 text-zinc-500 text-xs">스크리닝을 실행하면 실시간 데이터가 대시보드에 반영됩니다</p>
        </div>
      </div>
    </div>
  );
}
