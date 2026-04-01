'use client';

import { useState, useEffect, useMemo } from 'react';

// ==========================================
// Types
// ==========================================

interface StockData {
  symbol: string; name: string; dividendYield: number; annualDividend: number;
  overallScore: number; grade: string; payoutRatio: number; consecutiveDividendYears: number;
  currentPrice: number; marketCap: number; pe: number; roe: number; sector: string;
  dividendCycle: string; isREIT: boolean; beta: number;
  scoreBreakdown?: { stability: number; profitability: number; growth: number; valuation: number; dividend: number };
}

interface ETFData {
  symbol: string; name: string; dividendYield: number; totalScore: number;
  price: number; aum: number; expenseRatio: number; isCoveredCall?: boolean;
}

type ReportType = 'top10' | 'portfolio' | 'weekly';

// ==========================================
// Helpers
// ==========================================

function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

function cycleName(c: string): string {
  return c === 'monthly' ? '월배당' : c === 'quarterly' ? '분기' : c === 'semi-annual' ? '반기' : '연간';
}

// ==========================================
// Page
// ==========================================

export default function ReportPage() {
  const [reportType, setReportType] = useState<ReportType>('top10');
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [etfs, setETFs] = useState<ETFData[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const sc = localStorage.getItem('stock_screening_results');
      if (sc) setStocks(JSON.parse(sc));
      const ec = localStorage.getItem('etf_screening_results');
      if (ec) setETFs(JSON.parse(ec));
    } catch { /* ignore */ }
  }, []);

  const top10 = useMemo(() => [...stocks].sort((a, b) => b.overallScore - a.overallScore).slice(0, 10), [stocks]);
  const topETFs = useMemo(() => [...etfs].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5), [etfs]);

  const reportContent = useMemo(() => {
    if (reportType === 'top10') return generateTop10Report(top10);
    if (reportType === 'portfolio') return generatePortfolioReport(top10, topETFs);
    return generateWeeklyReport(top10, topETFs, stocks.length, etfs.length);
  }, [reportType, top10, topETFs, stocks.length, etfs.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportContent.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            리포트 생성기
          </h1>
          <p className="text-sm text-zinc-400 mt-1">블로그/카페 업로드용 리포트를 자동 생성합니다 (내부 확인용)</p>
        </div>

        {/* Report Type Selector */}
        <div className="flex gap-2 flex-wrap">
          {([
            { id: 'top10' as ReportType, label: `${formatMonth()} 배당주 TOP 10`, icon: '🏆' },
            { id: 'portfolio' as ReportType, label: '월 100만원 배당 포트폴리오', icon: '💰' },
            { id: 'weekly' as ReportType, label: '주간 스크리닝 요약', icon: '📋' },
          ]).map(t => (
            <button key={t.id} onClick={() => setReportType(t.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                reportType === t.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Data Status */}
        {stocks.length === 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400">
            ⚠️ 스크리닝 결과가 없습니다. 먼저 배당주/ETF 스크리닝을 실행해 주세요.
          </div>
        )}

        {/* Report Preview */}
        {stocks.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{reportContent.title}</h2>
              <button onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}>
                {copied ? '✅ 복사됨!' : '📋 텍스트 복사'}
              </button>
            </div>

            {/* Visual Preview */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 space-y-5">
              <div dangerouslySetInnerHTML={{ __html: reportContent.html }} />
            </div>

            {/* Raw Text (for copy) */}
            <details className="rounded-xl border border-zinc-800/60 bg-zinc-900/40">
              <summary className="px-4 py-3 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                원본 텍스트 보기 (블로그 붙여넣기용)
              </summary>
              <pre className="px-4 pb-4 text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                {reportContent.text}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Report Generators
// ==========================================

function generateTop10Report(top10: StockData[]): { title: string; html: string; text: string } {
  const title = `${formatMonth()} 미국 배당주 TOP 10`;
  const date = formatDate();

  let text = `📊 ${title}\n`;
  text += `작성일: ${date} | AI Dividend 스크리닝 기준\n\n`;
  text += `AI가 5축 분석(안정성·수익성·성장성·가치·배당)으로 선별한\n`;
  text += `이번 달 최고 배당주 TOP 10을 소개합니다.\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  top10.forEach((s, i) => {
    text += `${i + 1}위. ${s.symbol} — ${s.name}\n`;
    text += `   등급: ${s.grade} (${s.overallScore}점) | 배당수익률: ${s.dividendYield.toFixed(2)}%\n`;
    text += `   현재가: $${s.currentPrice.toFixed(2)} | 배당주기: ${cycleName(s.dividendCycle)}\n`;
    text += `   배당성향: ${s.payoutRatio.toFixed(1)}% | 연속배당: ${s.consecutiveDividendYears}년${s.isREIT ? ' | REIT' : ''}\n`;
    text += `   섹터: ${s.sector} | P/E: ${s.pe?.toFixed(1) || '-'}\n\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `📌 투자 시 참고사항\n`;
  text += `• 위 순위는 AI 종합 점수 기준이며 투자 추천이 아닙니다.\n`;
  text += `• 배당 성향, 재무 건전성 등을 반드시 직접 확인하세요.\n`;
  text += `• 미국 배당소득세 15%가 원천징수됩니다.\n\n`;
  text += `🔗 AI Dividend — AI 기반 배당주 스크리닝\n`;

  let html = `<h2 class="text-xl font-bold text-white mb-1">📊 ${title}</h2>`;
  html += `<p class="text-xs text-zinc-500 mb-4">작성일: ${date} | AI Dividend 스크리닝 기준</p>`;
  html += `<p class="text-sm text-zinc-300 mb-5">AI가 5축 분석(안정성·수익성·성장성·가치·배당)으로 선별한 이번 달 최고 배당주 TOP 10을 소개합니다.</p>`;
  html += `<div class="space-y-3">`;

  top10.forEach((s, i) => {
    const gradeColor = s.grade === 'A+' ? 'text-emerald-400' : s.grade === 'A' ? 'text-green-400' : 'text-teal-400';
    html += `<div class="rounded-lg bg-zinc-800/40 p-4">`;
    html += `<div class="flex items-center justify-between mb-2">`;
    html += `<div class="flex items-center gap-2">`;
    html += `<span class="text-lg font-bold text-amber-400">${i + 1}</span>`;
    html += `<span class="text-base font-bold text-white">${s.symbol}</span>`;
    html += `<span class="${gradeColor} text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-700/50">${s.grade}</span>`;
    html += `${s.isREIT ? '<span class="text-purple-400 text-[10px] px-1 py-0.5 rounded bg-purple-500/10">REIT</span>' : ''}`;
    html += `</div>`;
    html += `<span class="text-emerald-400 font-bold">${s.dividendYield.toFixed(2)}%</span>`;
    html += `</div>`;
    html += `<p class="text-xs text-zinc-400">${s.name}</p>`;
    html += `<div class="flex gap-4 mt-2 text-[11px] text-zinc-500">`;
    html += `<span>$${s.currentPrice.toFixed(2)}</span>`;
    html += `<span>${cycleName(s.dividendCycle)}</span>`;
    html += `<span>성향 ${s.payoutRatio.toFixed(0)}%</span>`;
    html += `<span>${s.consecutiveDividendYears}년 연속</span>`;
    html += `<span>${s.sector}</span>`;
    html += `</div></div>`;
  });

  html += `</div>`;
  html += `<div class="mt-5 pt-4 border-t border-zinc-800/40 text-[11px] text-zinc-600 space-y-1">`;
  html += `<p>📌 위 순위는 AI 종합 점수 기준이며 투자 추천이 아닙니다.</p>`;
  html += `<p>📌 미국 배당소득세 15%가 원천징수됩니다.</p>`;
  html += `</div>`;

  return { title, html, text };
}

function generatePortfolioReport(top10: StockData[], topETFs: ETFData[]): { title: string; html: string; text: string } {
  const title = '월 100만원 배당 포트폴리오';
  const date = formatDate();

  // 월 100만원 세후 = 세전 약 117.6만원 = 연 1,412만원 ≈ $9,400
  // 평균 수익률 6%라면 약 $156,700 ≈ 약 2.4억원 필요
  const avgYield = top10.length > 0 ? top10.reduce((s, t) => s + t.dividendYield, 0) / top10.length : 5;
  const monthlyTarget = 1000000; // KRW
  const monthlyPreTax = Math.round(monthlyTarget / 0.85);
  const annualPreTaxKRW = monthlyPreTax * 12;
  const rate = 1500;
  const annualPreTaxUSD = Math.round(annualPreTaxKRW / rate);
  const requiredInvestment = Math.round(annualPreTaxUSD / (avgYield / 100));

  let text = `💰 ${title}\n`;
  text += `작성일: ${date}\n\n`;
  text += `목표: 매달 세후 100만원 배당 수입\n`;
  text += `필요 투자금: 약 $${requiredInvestment.toLocaleString()} (약 ${(requiredInvestment * rate / 1e8).toFixed(1)}억원)\n`;
  text += `평균 배당수익률: ${avgYield.toFixed(2)}% 기준\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `📊 추천 배당주 (상위 5종목)\n\n`;

  top10.slice(0, 5).forEach((s, i) => {
    const weight = 20;
    const amount = Math.round(requiredInvestment * weight / 100);
    const monthlyDiv = Math.round(amount * (s.dividendYield / 100) / 12 * 0.85);
    text += `${i + 1}. ${s.symbol} (${s.grade}) — 비중 ${weight}%\n`;
    text += `   투자금: $${amount.toLocaleString()} | 수익률: ${s.dividendYield.toFixed(2)}% | 월 세후: $${monthlyDiv}\n\n`;
  });

  if (topETFs.length > 0) {
    text += `📊 추천 ETF (상위 3종목)\n\n`;
    topETFs.slice(0, 3).forEach((e, i) => {
      text += `${i + 1}. ${e.symbol} — ${e.name}\n`;
      text += `   수익률: ${(e.dividendYield * 100).toFixed(2)}% | 보수: ${(e.expenseRatio * 100).toFixed(2)}%\n\n`;
    });
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `⚠️ 본 포트폴리오는 AI 분석 기반 예시이며, 실제 투자는 개인 판단이 필요합니다.\n`;

  let html = `<h2 class="text-xl font-bold text-white mb-1">💰 ${title}</h2>`;
  html += `<p class="text-xs text-zinc-500 mb-4">작성일: ${date}</p>`;
  html += `<div class="grid grid-cols-3 gap-3 mb-5">`;
  html += `<div class="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 text-center"><p class="text-[10px] text-zinc-500">목표 월 배당 (세후)</p><p class="text-lg font-bold text-emerald-400">100만원</p></div>`;
  html += `<div class="rounded-lg bg-zinc-800/40 p-3 text-center"><p class="text-[10px] text-zinc-500">필요 투자금</p><p class="text-lg font-bold text-white">약 ${(requiredInvestment * rate / 1e8).toFixed(1)}억원</p><p class="text-[10px] text-zinc-500">$${requiredInvestment.toLocaleString()}</p></div>`;
  html += `<div class="rounded-lg bg-zinc-800/40 p-3 text-center"><p class="text-[10px] text-zinc-500">평균 수익률</p><p class="text-lg font-bold text-teal-400">${avgYield.toFixed(2)}%</p></div>`;
  html += `</div>`;

  html += `<h3 class="text-sm font-bold text-white mb-3">📊 추천 배당주 구성</h3>`;
  html += `<div class="space-y-2 mb-5">`;
  top10.slice(0, 5).forEach((s, i) => {
    const weight = 20;
    const amount = Math.round(requiredInvestment * weight / 100);
    const monthlyDiv = Math.round(amount * (s.dividendYield / 100) / 12 * 0.85);
    html += `<div class="flex items-center justify-between rounded-lg bg-zinc-800/40 px-4 py-2.5">`;
    html += `<div class="flex items-center gap-2"><span class="text-amber-400 font-bold">${i + 1}</span><span class="text-white font-bold">${s.symbol}</span><span class="text-xs text-zinc-500">${s.grade}</span></div>`;
    html += `<div class="flex items-center gap-4 text-xs"><span class="text-zinc-400">$${amount.toLocaleString()}</span><span class="text-emerald-400">${s.dividendYield.toFixed(2)}%</span><span class="text-teal-400">월 $${monthlyDiv}</span></div>`;
    html += `</div>`;
  });
  html += `</div>`;

  if (topETFs.length > 0) {
    html += `<h3 class="text-sm font-bold text-white mb-3">📊 추천 ETF</h3>`;
    html += `<div class="space-y-2 mb-4">`;
    topETFs.slice(0, 3).forEach(e => {
      html += `<div class="flex items-center justify-between rounded-lg bg-zinc-800/40 px-4 py-2.5">`;
      html += `<div><span class="text-white font-bold">${e.symbol}</span> <span class="text-xs text-zinc-500">${e.name}</span></div>`;
      html += `<span class="text-emerald-400 text-xs">${(e.dividendYield * 100).toFixed(2)}%</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  html += `<p class="text-[11px] text-zinc-600 mt-3">⚠️ AI 분석 기반 예시이며, 실제 투자는 개인 판단이 필요합니다.</p>`;

  return { title, html, text };
}

function generateWeeklyReport(top10: StockData[], topETFs: ETFData[], totalStocks: number, totalETFs: number): { title: string; html: string; text: string } {
  const title = '주간 스크리닝 요약';
  const date = formatDate();
  const avgYield = top10.length > 0 ? (top10.reduce((s, t) => s + t.dividendYield, 0) / top10.length).toFixed(2) : '0';
  const avgScore = top10.length > 0 ? (top10.reduce((s, t) => s + t.overallScore, 0) / top10.length).toFixed(1) : '0';
  const aPlusCount = top10.filter(s => s.grade === 'A+').length;
  const aCount = top10.filter(s => s.grade === 'A').length;
  const monthlyStocks = top10.filter(s => s.dividendCycle === 'monthly');
  const reitStocks = top10.filter(s => s.isREIT);

  let text = `📋 ${title}\n`;
  text += `기준일: ${date}\n\n`;
  text += `━━━━━ 스크리닝 결과 요약 ━━━━━\n\n`;
  text += `배당주 분석: ${totalStocks}종목 → 상위 ${top10.length}종목 선정\n`;
  text += `ETF 분석: ${totalETFs}종목 → 상위 ${topETFs.length}종목 선정\n\n`;
  text += `평균 배당수익률: ${avgYield}%\n`;
  text += `평균 종합점수: ${avgScore}/100\n`;
  text += `A+ 등급: ${aPlusCount}종목 | A 등급: ${aCount}종목\n`;
  text += `월배당 종목: ${monthlyStocks.length}종목\n`;
  text += `REIT: ${reitStocks.length}종목\n\n`;
  text += `━━━━━ TOP 5 배당주 ━━━━━\n\n`;

  top10.slice(0, 5).forEach((s, i) => {
    text += `${i + 1}. ${s.symbol} (${s.grade}, ${s.overallScore}점) — ${s.dividendYield.toFixed(2)}% | ${cycleName(s.dividendCycle)}\n`;
  });

  if (topETFs.length > 0) {
    text += `\n━━━━━ TOP 3 ETF ━━━━━\n\n`;
    topETFs.slice(0, 3).forEach((e, i) => {
      text += `${i + 1}. ${e.symbol} (Q-LEAD ${e.totalScore}) — ${(e.dividendYield * 100).toFixed(2)}%\n`;
    });
  }

  text += `\n🔗 AI Dividend로 더 자세한 분석을 확인하세요.\n`;

  let html = `<h2 class="text-xl font-bold text-white mb-1">📋 ${title}</h2>`;
  html += `<p class="text-xs text-zinc-500 mb-4">기준일: ${date}</p>`;

  html += `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">`;
  html += `<div class="rounded-lg bg-zinc-800/40 p-3 text-center"><p class="text-[10px] text-zinc-500">분석 배당주</p><p class="text-lg font-bold text-white">${totalStocks}</p></div>`;
  html += `<div class="rounded-lg bg-zinc-800/40 p-3 text-center"><p class="text-[10px] text-zinc-500">평균 수익률</p><p class="text-lg font-bold text-emerald-400">${avgYield}%</p></div>`;
  html += `<div class="rounded-lg bg-zinc-800/40 p-3 text-center"><p class="text-[10px] text-zinc-500">A+ 등급</p><p class="text-lg font-bold text-amber-400">${aPlusCount}종목</p></div>`;
  html += `<div class="rounded-lg bg-zinc-800/40 p-3 text-center"><p class="text-[10px] text-zinc-500">월배당</p><p class="text-lg font-bold text-teal-400">${monthlyStocks.length}종목</p></div>`;
  html += `</div>`;

  html += `<h3 class="text-sm font-bold text-white mb-3">🏆 TOP 5 배당주</h3>`;
  html += `<div class="space-y-1.5 mb-4">`;
  top10.slice(0, 5).forEach((s, i) => {
    html += `<div class="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2 text-xs">`;
    html += `<div class="flex items-center gap-2"><span class="text-amber-400 font-bold w-4">${i + 1}</span><span class="text-white font-bold">${s.symbol}</span><span class="text-zinc-500">${s.grade} ${s.overallScore}점</span></div>`;
    html += `<div class="flex items-center gap-3"><span class="text-emerald-400">${s.dividendYield.toFixed(2)}%</span><span class="text-zinc-500">${cycleName(s.dividendCycle)}</span></div>`;
    html += `</div>`;
  });
  html += `</div>`;

  if (topETFs.length > 0) {
    html += `<h3 class="text-sm font-bold text-white mb-3">🏆 TOP 3 ETF</h3>`;
    html += `<div class="space-y-1.5">`;
    topETFs.slice(0, 3).forEach((e, i) => {
      html += `<div class="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2 text-xs">`;
      html += `<div class="flex items-center gap-2"><span class="text-amber-400 font-bold w-4">${i + 1}</span><span class="text-white font-bold">${e.symbol}</span></div>`;
      html += `<span class="text-emerald-400">${(e.dividendYield * 100).toFixed(2)}%</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  return { title, html, text };
}
