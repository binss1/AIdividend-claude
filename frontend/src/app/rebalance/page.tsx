'use client';

import { useState, useCallback, useRef } from 'react';
import { apiFetch, API_ENDPOINTS } from '@/config/api';
import {
  UserHolding,
  RebalanceResponse,
  RebalanceScenario,
  RebalanceAction,
  RebalanceMetrics,
} from '@/types';

// ==========================================
// Types
// ==========================================

interface SessionListItem {
  id: number;
  asset_type: string;
  session_date: string;
  session_number: number;
  result_count: number;
  label: string;
}

type InvestmentTendency = 'conservative' | 'balanced' | 'growth' | 'aggressive';

// ==========================================
// Helpers
// ==========================================

function formatUSD(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatUSD2(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

const ACTION_LABELS: Record<RebalanceAction, { label: string; color: string; bg: string }> = {
  keep:     { label: '유지',   color: 'text-gray-300',   bg: 'bg-gray-700' },
  increase: { label: '비중확대', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  reduce:   { label: '비중축소', color: 'text-amber-400',   bg: 'bg-amber-500/20' },
  sell:     { label: '매도',   color: 'text-red-400',     bg: 'bg-red-500/20' },
  exclude:  { label: '제외',   color: 'text-orange-400',  bg: 'bg-orange-500/20' },
  new_buy:  { label: '신규매수', color: 'text-blue-400',    bg: 'bg-blue-500/20' },
};

// 한글 금액 표시 (예: 100000000 → "1억원", 15000000 → "1,500만원")
function formatKRW(amount: number): string {
  if (amount === 0) return '0원';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1_0000_0000) {
    const eok = Math.floor(absAmount / 1_0000_0000);
    const remainder = absAmount % 1_0000_0000;
    if (remainder >= 1_0000) {
      const man = Math.floor(remainder / 1_0000);
      return `${sign}${eok.toLocaleString()}억 ${man.toLocaleString()}만원`;
    }
    return `${sign}${eok.toLocaleString()}억원`;
  }
  if (absAmount >= 1_0000) {
    const man = Math.floor(absAmount / 1_0000);
    return `${sign}${man.toLocaleString()}만원`;
  }
  return `${sign}${absAmount.toLocaleString()}원`;
}

// ETF 카테고리 판별 (백엔드 classifyAsset 기준: ETF는 equity-dividend, covered-call, bond-income, reit)
const ETF_CATEGORIES = new Set(['equity-dividend', 'covered-call', 'bond-income', 'reit']);
function isETFCategory(category?: string): boolean {
  return !!category && ETF_CATEGORIES.has(category);
}
// 주요 배당 ETF 심볼 패턴 (카테고리 정보 없을 때 fallback)
const KNOWN_ETF_PATTERNS = /^(SCHD|JEPI|JEPQ|DIVO|HDV|VYM|SPYD|DVY|NOBL|SDY|VIG|DGRO|QYLD|XYLD|RYLD|PFF|PGX|HYG|LQD|BND|AGG|TLT|VCLT|VCIT|VGIT|SPLG|VOO|SPY|QQQ|IVV|VTI|VXUS|VEA|VWO|IWM|DIA|XLF|XLE|XLK|XLV|XLI|XLU|XLP|XLY|XLB|XLRE|XLC|VNQ|VNQI|REET|SRET|SCYB|VWOB|USHY|VCSH|SPHY|JNK|IGSB|FLOT|MINT|BSV|VTIP|STIP|SHV|SGOV|BIL)$/;

const TENDENCY_LABELS: Record<InvestmentTendency, string> = {
  conservative: '보수적',
  balanced: '균형',
  growth: '성장',
  aggressive: '공격적',
};

// ==========================================
// Excel Template Download
// ==========================================

function downloadTemplate() {
  const header = '티커(Symbol)\t보유수량(Shares)\t평균매입가(Avg Price)\n';
  const example = 'AAPL\t50\t150.25\nSCHD\t100\t\nO\t30\t55.00\n';
  const content = header + example;

  // Create workbook via xlsx if available, fallback to TSV
  const blob = new Blob(['\uFEFF' + content], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '보유종목_템플릿.tsv';
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcelTemplate() {
  try {
    const XLSX = await import('xlsx');
    const data = [
      { '티커(Symbol)': 'AAPL', '보유수량(Shares)': 50, '평균매입가(Avg Price)': 150.25 },
      { '티커(Symbol)': 'SCHD', '보유수량(Shares)': 100, '평균매입가(Avg Price)': '' },
      { '티커(Symbol)': 'O', '보유수량(Shares)': 30, '평균매입가(Avg Price)': 55.00 },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '보유종목');
    XLSX.writeFile(wb, '보유종목_템플릿.xlsx');
  } catch {
    downloadTemplate();
  }
}

// ==========================================
// Excel Parsing
// ==========================================

async function parseExcelFile(file: File): Promise<UserHolding[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const holdings: UserHolding[] = [];

  for (const row of rows) {
    // Flexible column matching
    const symbol = String(
      row['티커(Symbol)'] || row['Symbol'] || row['symbol'] || row['티커'] || row['Ticker'] || row['ticker'] || ''
    ).trim().toUpperCase();

    const shares = Number(
      row['보유수량(Shares)'] || row['Shares'] || row['shares'] || row['보유수량'] || row['수량'] || 0
    );

    const avgPriceRaw = row['평균매입가(Avg Price)'] || row['Avg Price'] || row['avgPrice'] || row['평균매입가'] || row['매입가'] || '';
    const avgPrice = avgPriceRaw ? Number(avgPriceRaw) : undefined;

    if (symbol && shares > 0) {
      holdings.push({
        symbol,
        shares,
        avgPrice: avgPrice && !isNaN(avgPrice) ? avgPrice : undefined,
      });
    }
  }

  return holdings;
}

// ==========================================
// Component: MetricCard
// ==========================================

function MetricCard({ label, value, subValue, highlight }: {
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-gray-800/60 border border-gray-700/40'}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      {subValue && <div className="text-xs text-gray-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

// ==========================================
// Component: Final Proposed Portfolio
// ==========================================

interface FinalPortfolioItem {
  symbol: string;
  name: string;
  isETF: boolean;
  shares: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
  dividendYield: number;
  annualDividendTotal: number;
  score: number | null;
  grade: string | null;
  origin: 'keep' | 'increase' | 'reduce' | 'new_buy';
}

function FinalPortfolio({ scenario, afterMetrics, exchangeRate }: { scenario: RebalanceScenario; afterMetrics: RebalanceMetrics; exchangeRate: number }) {
  // Build final portfolio: existing holdings (keep/increase/reduce with target shares) + new buys
  const items: FinalPortfolioItem[] = [];

  for (const h of scenario.existingAnalysis) {
    // Skip sell and exclude
    if (h.action === 'sell' || h.action === 'exclude') continue;

    const shares = h.targetShares ?? h.shares;
    if (shares <= 0) continue;

    const marketValue = shares * h.currentPrice;
    const annualDivTotal = h.annualDividend * shares;

    items.push({
      symbol: h.symbol,
      name: h.name,
      isETF: KNOWN_ETF_PATTERNS.test(h.symbol),
      shares,
      currentPrice: h.currentPrice,
      marketValue,
      weight: 0, // calculated below
      dividendYield: h.dividendYield,
      annualDividendTotal: annualDivTotal,
      score: h.score,
      grade: h.grade,
      origin: h.action as 'keep' | 'increase' | 'reduce',
    });
  }

  for (const nb of scenario.newBuys) {
    if (nb.suggestedShares <= 0) continue;
    const marketValue = nb.suggestedShares * nb.currentPrice;
    const annualDivTotal = (nb.dividendYield / 100) * nb.currentPrice * nb.suggestedShares;

    items.push({
      symbol: nb.symbol,
      name: nb.name,
      isETF: isETFCategory(nb.category) || KNOWN_ETF_PATTERNS.test(nb.symbol),
      shares: nb.suggestedShares,
      currentPrice: nb.currentPrice,
      marketValue,
      weight: 0,
      dividendYield: nb.dividendYield,
      annualDividendTotal: annualDivTotal,
      score: nb.score,
      grade: nb.grade,
      origin: 'new_buy',
    });
  }

  // Calculate weights
  const totalValue = items.reduce((s, i) => s + i.marketValue, 0);
  for (const item of items) {
    item.weight = totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
  }

  // Sort by weight descending
  items.sort((a, b) => b.weight - a.weight);

  if (items.length === 0) return null;

  const totalAnnualDiv = items.reduce((s, i) => s + i.annualDividendTotal, 0);
  const monthlyDivPostTax = (totalAnnualDiv / 12) * 0.85; // 15% tax

  const ORIGIN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    keep:     { label: '기존유지', color: 'text-gray-300',   bg: 'bg-gray-700' },
    increase: { label: '비중확대', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    reduce:   { label: '비중축소', color: 'text-amber-400',   bg: 'bg-amber-500/20' },
    new_buy:  { label: '신규편입', color: 'text-blue-400',    bg: 'bg-blue-500/20' },
  };

  return (
    <div className="mt-2 pt-4 border-t border-gray-700/50">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-semibold text-emerald-400">최종 제안 포트폴리오</span>
        <span className="text-xs text-gray-500">({items.length}종목)</span>
      </div>

      {/* Summary metrics row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
          <div className="text-[10px] text-gray-400">총 평가액</div>
          <div className="text-sm font-bold text-emerald-400">{formatUSD(totalValue)}</div>
          <div className="text-[10px] text-gray-500">{formatKRW(Math.round(totalValue * exchangeRate))}</div>
        </div>
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
          <div className="text-[10px] text-gray-400">가중 배당률</div>
          <div className="text-sm font-bold text-emerald-400">{formatPct(afterMetrics.weightedYield)}</div>
        </div>
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
          <div className="text-[10px] text-gray-400">연간 예상 배당</div>
          <div className="text-sm font-bold text-emerald-400">{formatUSD(Math.round(totalAnnualDiv))}</div>
          <div className="text-[10px] text-gray-500">{formatKRW(Math.round(totalAnnualDiv * exchangeRate))}</div>
        </div>
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
          <div className="text-[10px] text-gray-400">월 배당 (세후)</div>
          <div className="text-sm font-bold text-emerald-400">{formatUSD2(monthlyDivPostTax)}</div>
          <div className="text-[10px] text-gray-500">{formatKRW(Math.round(monthlyDivPostTax * exchangeRate))}</div>
        </div>
      </div>

      {/* Portfolio table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-emerald-500/20">
              <th className="text-center py-2 px-2 w-8">#</th>
              <th className="text-left py-2 px-2">종목</th>
              <th className="text-center py-2 px-2">구분</th>
              <th className="text-right py-2 px-2">현재가</th>
              <th className="text-right py-2 px-2">수량</th>
              <th className="text-right py-2 px-2">평가액</th>
              <th className="text-right py-2 px-2">비중</th>
              <th className="text-right py-2 px-2">배당률</th>
              <th className="text-right py-2 px-2">연 배당금</th>
              <th className="text-center py-2 px-2">점수</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const originBadge = ORIGIN_BADGE[item.origin];
              return (
                <tr key={item.symbol} className="border-b border-gray-800/40 hover:bg-emerald-500/5 transition-colors">
                  <td className="text-center py-2.5 px-2 text-gray-500 text-xs">{idx + 1}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-white">{item.symbol}</span>
                      {item.isETF && (
                        <span className="px-1 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400 font-medium leading-none">ETF</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[140px]">{item.name}</div>
                  </td>
                  <td className="text-center py-2 px-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${originBadge.bg} ${originBadge.color}`}>
                      {originBadge.label}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2 text-gray-300">{formatUSD2(item.currentPrice)}</td>
                  <td className="text-right py-2 px-2 text-white font-medium">{item.shares}주</td>
                  <td className="text-right py-2 px-2">
                    <div className="text-gray-300">{formatUSD(item.marketValue)}</div>
                    <div className="text-[10px] text-gray-500">{formatKRW(Math.round(item.marketValue * exchangeRate))}</div>
                  </td>
                  <td className="text-right py-2 px-2">
                    {/* Weight bar */}
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(item.weight * 2, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-300 min-w-[40px] text-right">{item.weight.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-2 text-emerald-400">{formatPct(item.dividendYield)}</td>
                  <td className="text-right py-2 px-2">
                    <div className="text-gray-300">{formatUSD2(item.annualDividendTotal)}</div>
                    <div className="text-[10px] text-gray-500">{formatKRW(Math.round(item.annualDividendTotal * exchangeRate))}</div>
                  </td>
                  <td className="text-center py-2 px-2">
                    {item.score !== null ? (
                      <span className={`text-xs font-medium ${item.score >= 70 ? 'text-emerald-400' : item.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {item.grade} ({item.score.toFixed(0)})
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Footer: totals */}
          <tfoot>
            <tr className="border-t border-emerald-500/30 font-medium">
              <td className="py-2.5 px-2" colSpan={2}>
                <span className="text-emerald-400 text-xs font-semibold">합계 ({items.length}종목)</span>
              </td>
              <td />
              <td />
              <td />
              <td className="text-right py-2 px-2">
                <div className="text-emerald-400">{formatUSD(totalValue)}</div>
                <div className="text-[10px] text-gray-500">{formatKRW(Math.round(totalValue * exchangeRate))}</div>
              </td>
              <td className="text-right py-2 px-2 text-emerald-400">100%</td>
              <td className="text-right py-2 px-2 text-emerald-400">{formatPct(totalValue > 0 ? (totalAnnualDiv / totalValue) * 100 : 0)}</td>
              <td className="text-right py-2 px-2">
                <div className="text-emerald-400">{formatUSD2(totalAnnualDiv)}</div>
                <div className="text-[10px] text-gray-500">{formatKRW(Math.round(totalAnnualDiv * exchangeRate))}</div>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// Component: Scenario Card
// ==========================================

function ScenarioCard({ scenario, index, exchangeRate }: { scenario: RebalanceScenario; index: number; exchangeRate: number }) {
  const [expanded, setExpanded] = useState(index === 1); // default open balanced

  const { beforeMetrics: before, afterMetrics: after } = scenario;
  const yieldDelta = after.weightedYield - before.weightedYield;
  const divDelta = after.expectedMonthlyDividendPostTax - before.expectedMonthlyDividendPostTax;
  const scoreDelta = after.avgScore - before.avgScore;

  const sellCount = scenario.existingAnalysis.filter(h => h.action === 'sell').length;
  const reduceCount = scenario.existingAnalysis.filter(h => h.action === 'reduce').length;
  const increaseCount = scenario.existingAnalysis.filter(h => h.action === 'increase').length;
  const keepCount = scenario.existingAnalysis.filter(h => h.action === 'keep').length;
  const excludeCount = scenario.existingAnalysis.filter(h => h.action === 'exclude').length;

  const borderColors = ['border-blue-500/40', 'border-emerald-500/40', 'border-amber-500/40'];
  const headerColors = ['from-blue-500/10', 'from-emerald-500/10', 'from-amber-500/10'];

  return (
    <div className={`rounded-2xl border ${borderColors[index]} bg-gray-900/80 overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r ${headerColors[index]} to-transparent hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold text-white">{scenario.name}</div>
          <div className="text-sm text-gray-400">{scenario.description}</div>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 py-5 space-y-6">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {keepCount > 0 && <span className="px-3 py-1 rounded-full text-xs bg-gray-700 text-gray-300">유지 {keepCount}</span>}
            {increaseCount > 0 && <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400">비중확대 {increaseCount}</span>}
            {reduceCount > 0 && <span className="px-3 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">비중축소 {reduceCount}</span>}
            {excludeCount > 0 && <span className="px-3 py-1 rounded-full text-xs bg-orange-500/20 text-orange-400">제외 {excludeCount}</span>}
            {sellCount > 0 && <span className="px-3 py-1 rounded-full text-xs bg-red-500/20 text-red-400">매도 {sellCount}</span>}
            {scenario.newBuys.length > 0 && <span className="px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">신규매수 {scenario.newBuys.length}</span>}
          </div>

          {/* Before / After Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-400 mb-3">현재 포트폴리오</div>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="총 가치" value={formatUSD(before.totalValue)} />
                <MetricCard label="가중 배당률" value={formatPct(before.weightedYield)} />
                <MetricCard label="월 배당(세후)" value={formatUSD2(before.expectedMonthlyDividendPostTax)} />
                <MetricCard label="평균 점수" value={before.avgScore.toFixed(1)} />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-emerald-400 mb-3">리밸런싱 후</div>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="총 가치" value={formatUSD(after.totalValue)} highlight />
                <MetricCard
                  label="가중 배당률"
                  value={formatPct(after.weightedYield)}
                  subValue={yieldDelta !== 0 ? `${yieldDelta > 0 ? '+' : ''}${yieldDelta.toFixed(2)}%p` : undefined}
                  highlight={yieldDelta > 0}
                />
                <MetricCard
                  label="월 배당(세후)"
                  value={formatUSD2(after.expectedMonthlyDividendPostTax)}
                  subValue={divDelta !== 0 ? `${divDelta > 0 ? '+' : ''}${formatUSD2(divDelta)}` : undefined}
                  highlight={divDelta > 0}
                />
                <MetricCard
                  label="평균 점수"
                  value={after.avgScore.toFixed(1)}
                  subValue={scoreDelta !== 0 ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(1)}` : undefined}
                  highlight={scoreDelta > 0}
                />
              </div>
            </div>
          </div>

          {/* Existing Holdings Table */}
          <div>
            <div className="text-sm font-medium text-gray-300 mb-2">보유 종목 분석</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700/50">
                    <th className="text-left py-2 px-2">종목</th>
                    <th className="text-right py-2 px-2">현재가</th>
                    <th className="text-right py-2 px-2">수량</th>
                    <th className="text-right py-2 px-2">평가액</th>
                    <th className="text-right py-2 px-2">비중</th>
                    <th className="text-right py-2 px-2">배당률</th>
                    <th className="text-center py-2 px-2">점수</th>
                    <th className="text-center py-2 px-2">권고</th>
                    <th className="text-right py-2 px-2">변동</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.existingAnalysis.map((h) => {
                    const actionInfo = ACTION_LABELS[h.action];
                    return (
                      <tr key={h.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white">{h.symbol}</span>
                            {KNOWN_ETF_PATTERNS.test(h.symbol) && (
                              <span className="px-1 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400 font-medium leading-none">ETF</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[120px]">{h.name}</div>
                        </td>
                        <td className="text-right py-2 px-2 text-gray-300">{formatUSD2(h.currentPrice)}</td>
                        <td className="text-right py-2 px-2 text-gray-300">{h.shares}</td>
                        <td className="text-right py-2 px-2 text-gray-300">{formatUSD(h.marketValue)}</td>
                        <td className="text-right py-2 px-2 text-gray-300">{h.weight.toFixed(1)}%</td>
                        <td className="text-right py-2 px-2 text-gray-300">{formatPct(h.dividendYield)}</td>
                        <td className="text-center py-2 px-2">
                          {h.score !== null ? (
                            <span className={`text-sm font-medium ${h.score >= 70 ? 'text-emerald-400' : h.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                              {h.grade} ({typeof h.score === 'number' ? h.score.toFixed(2) : h.score})
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionInfo.bg} ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2">
                          {h.shareDelta !== undefined && h.shareDelta !== 0 ? (
                            <span className={h.shareDelta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {h.shareDelta > 0 ? '+' : ''}{h.shareDelta}주
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reason tooltip on mobile: show as list */}
          <div className="space-y-1">
            {scenario.existingAnalysis.filter(h => h.action !== 'keep').map(h => (
              <div key={`reason-${h.symbol}`} className="flex items-start gap-2 text-xs">
                <span className={`font-medium min-w-[50px] ${ACTION_LABELS[h.action].color}`}>{h.symbol}</span>
                <span className="text-gray-400">{h.reason}</span>
              </div>
            ))}
          </div>

          {/* New Buy Recommendations */}
          {scenario.newBuys.length > 0 && (
            <div>
              <div className="text-sm font-medium text-blue-400 mb-2">신규 매수 추천</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700/50">
                      <th className="text-left py-2 px-2">종목</th>
                      <th className="text-right py-2 px-2">현재가</th>
                      <th className="text-right py-2 px-2">배당률</th>
                      <th className="text-center py-2 px-2">점수</th>
                      <th className="text-right py-2 px-2">매수 수량</th>
                      <th className="text-right py-2 px-2">투자금</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.newBuys.map((nb) => (
                      <tr key={nb.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white">{nb.symbol}</span>
                            {(isETFCategory(nb.category) || KNOWN_ETF_PATTERNS.test(nb.symbol)) && (
                              <span className="px-1 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400 font-medium leading-none">ETF</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[120px]">{nb.name}</div>
                        </td>
                        <td className="text-right py-2 px-2 text-gray-300">{formatUSD2(nb.currentPrice)}</td>
                        <td className="text-right py-2 px-2 text-emerald-400">{formatPct(nb.dividendYield)}</td>
                        <td className="text-center py-2 px-2">
                          <span className={`text-sm font-medium ${nb.score >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {nb.grade} ({nb.score.toFixed(2)})
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 text-blue-400 font-medium">{nb.suggestedShares}주</td>
                        <td className="text-right py-2 px-2 text-blue-400">{formatUSD(nb.suggestedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 space-y-1">
                {scenario.newBuys.map(nb => (
                  <div key={`reason-nb-${nb.symbol}`} className="flex items-start gap-2 text-xs">
                    <span className="font-medium min-w-[50px] text-blue-400">{nb.symbol}</span>
                    <span className="text-gray-400">{nb.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================ */}
          {/* Final Proposed Portfolio                          */}
          {/* ================================================ */}
          <FinalPortfolio scenario={scenario} afterMetrics={after} exchangeRate={exchangeRate} />
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main Page Component
// ==========================================

export default function RebalancePage() {
  // State: holdings input
  const [holdings, setHoldings] = useState<UserHolding[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State: session selection (multi-select)
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // State: preferences
  const [additionalInvestment, setAdditionalInvestment] = useState(0);
  const [tendency, setTendency] = useState<InvestmentTendency>('balanced');
  const [targetMonthlyDiv, setTargetMonthlyDiv] = useState(0);
  const [maxNewHoldings, setMaxNewHoldings] = useState(5);

  // State: currency
  type Currency = 'USD' | 'KRW';
  const [currency, setCurrency] = useState<Currency>('USD');
  const [exchangeRate, setExchangeRate] = useState(1400);

  // State: results
  const [result, setResult] = useState<RebalanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert display amount to USD for API
  const toUSD = useCallback((amount: number) => currency === 'KRW' ? amount / exchangeRate : amount, [currency, exchangeRate]);
  const fromUSD = useCallback((amount: number) => currency === 'KRW' ? amount * exchangeRate : amount, [currency, exchangeRate]);
  const currencySymbol = currency === 'USD' ? '$' : '₩';
  const currencyStep = currency === 'USD' ? 1000 : 100000;

  // Load sessions + exchange rate on mount
  const loadInitialData = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const [historyData, rateData] = await Promise.all([
        apiFetch<{ sessions: SessionListItem[] }>(API_ENDPOINTS.SCREENING_HISTORY),
        apiFetch<{ rate: number }>(API_ENDPOINTS.EXCHANGE_RATE).catch(() => ({ rate: 1400 })),
      ]);
      setSessions(historyData.sessions || []);
      if (historyData.sessions?.length > 0) {
        // Auto-select latest session
        setSelectedSessionIds([historyData.sessions[0].id]);
      }
      if (rateData.rate) setExchangeRate(rateData.rate);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Load on mount
  useState(() => { loadInitialData(); });

  // Toggle session selection
  const toggleSession = useCallback((id: number) => {
    setSelectedSessionIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }, []);

  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      if (parsed.length === 0) {
        setError('파일에서 유효한 종목을 찾을 수 없습니다. 열 이름(티커, 보유수량)을 확인해주세요.');
        return;
      }
      setHoldings(parsed);
      setFileName(file.name);
      setError(null);
      setManualInput('');
    } catch (err) {
      setError(`파일 파싱 실패: ${(err as Error).message}`);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Manual input parser (format: AAPL 50, SCHD 100 55.5, ...)
  const parseManualInput = useCallback(() => {
    const lines = manualInput.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    const parsed: UserHolding[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const symbol = parts[0].toUpperCase();
        const shares = parseInt(parts[1]);
        const avgPrice = parts[2] ? parseFloat(parts[2]) : undefined;
        if (symbol && shares > 0) {
          parsed.push({ symbol, shares, avgPrice: avgPrice && !isNaN(avgPrice) ? avgPrice : undefined });
        }
      }
    }

    if (parsed.length === 0) {
      setError('입력 형식을 확인해주세요. 예: AAPL 50 150.25');
      return;
    }

    setHoldings(parsed);
    setFileName(null);
    setError(null);
  }, [manualInput]);

  // Remove a holding
  const removeHolding = useCallback((symbol: string) => {
    setHoldings(prev => prev.filter(h => h.symbol !== symbol));
  }, []);

  // Submit analysis
  const handleAnalyze = useCallback(async () => {
    if (holdings.length === 0) {
      setError('보유 종목을 입력해주세요.');
      return;
    }
    if (selectedSessionIds.length === 0) {
      setError('기준 스크리닝 결과를 1개 이상 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiFetch<RebalanceResponse>(API_ENDPOINTS.PORTFOLIO_REBALANCE, {
        method: 'POST',
        body: JSON.stringify({
          sessionIds: selectedSessionIds,
          holdings,
          preferences: {
            additionalInvestment: toUSD(additionalInvestment),
            investmentTendency: tendency,
            targetMonthlyDividend: targetMonthlyDiv > 0 ? toUSD(targetMonthlyDiv) : undefined,
            maxNewHoldings,
            sellThreshold: 40,
          },
          exchangeRate,
        }),
      });

      setResult(response);
    } catch (err) {
      setError(`분석 실패: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [holdings, selectedSessionIds, additionalInvestment, tendency, targetMonthlyDiv, maxNewHoldings, toUSD, exchangeRate]);

  // Export results to Excel
  const exportResults = useCallback(async () => {
    if (!result) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      for (let i = 0; i < result.scenarios.length; i++) {
        const sc = result.scenarios[i];

        // Existing holdings data
        const existingData = sc.existingAnalysis.map(h => ({
          '티커': h.symbol,
          '종목명': h.name,
          '현재가': h.currentPrice,
          '보유수량': h.shares,
          '평가액': h.marketValue,
          '비중(%)': h.weight,
          '배당률(%)': h.dividendYield,
          '점수': h.score ?? '-',
          '등급': h.grade ?? '-',
          '권고': ACTION_LABELS[h.action].label,
          '목표수량': h.targetShares ?? h.shares,
          '변동수량': h.shareDelta ?? 0,
          '변동금액($)': h.amountDelta ?? 0,
          '사유': h.reason,
        }));

        const ws = XLSX.utils.json_to_sheet(existingData);

        // Add new buys section
        if (sc.newBuys.length > 0) {
          const newBuyData = sc.newBuys.map(nb => ({
            '티커': nb.symbol,
            '종목명': nb.name,
            '현재가': nb.currentPrice,
            '보유수량': 0,
            '평가액': 0,
            '비중(%)': 0,
            '배당률(%)': nb.dividendYield,
            '점수': nb.score,
            '등급': nb.grade,
            '권고': '신규매수',
            '목표수량': nb.suggestedShares,
            '변동수량': nb.suggestedShares,
            '변동금액($)': nb.suggestedAmount,
            '사유': nb.reason,
          }));
          XLSX.utils.sheet_add_json(ws, newBuyData, { origin: -1, skipHeader: true });
        }

        XLSX.utils.book_append_sheet(wb, ws, sc.name);
      }

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `리밸런싱_분석_${date}.xlsx`);
    } catch (err) {
      console.error('Excel export failed:', err);
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            포트폴리오 리밸런싱
          </h1>
          <p className="mt-2 text-gray-400">
            현재 보유 종목을 업로드하고, 최신 스크리닝 결과와 비교하여 리밸런싱 권고를 받으세요.
          </p>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left: Holdings Input */}
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              보유 종목 입력
            </h2>

            {/* File Upload */}
            <div
              className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-colors cursor-pointer mb-4"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <svg className="mx-auto w-10 h-10 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <div className="text-sm text-gray-400">
                {fileName
                  ? <span className="text-emerald-400 font-medium">{fileName} ({holdings.length}종목)</span>
                  : 'Excel 파일을 드래그하거나 클릭하여 업로드'
                }
              </div>
              <div className="text-xs text-gray-500 mt-1">.xlsx, .xls, .csv 지원</div>
            </div>

            {/* Template download */}
            <button
              onClick={downloadExcelTemplate}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline mb-4"
            >
              템플릿 Excel 다운로드
            </button>

            {/* Manual Input */}
            <div className="mb-4">
              <div className="text-xs text-gray-400 mb-1">또는 직접 입력 (티커 수량 매입가)</div>
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={`AAPL 50 150.25\nSCHD 100\nO 30 55`}
                className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 h-24 resize-none"
              />
              <button
                onClick={parseManualInput}
                disabled={!manualInput.trim()}
                className="mt-2 px-4 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-40"
              >
                입력 적용
              </button>
            </div>

            {/* Current holdings list */}
            {holdings.length > 0 && (
              <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 text-xs text-gray-400 flex justify-between">
                  <span>{holdings.length}개 종목</span>
                  <button onClick={() => { setHoldings([]); setFileName(null); }} className="text-red-400 hover:text-red-300">전체 삭제</button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {holdings.map(h => (
                    <div key={h.symbol} className="flex items-center justify-between px-4 py-1.5 text-sm border-t border-gray-800/50">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white w-16">{h.symbol}</span>
                        <span className="text-gray-400">{h.shares}주</span>
                        {h.avgPrice && <span className="text-gray-500 text-xs">@${h.avgPrice}</span>}
                      </div>
                      <button onClick={() => removeHolding(h.symbol)} className="text-gray-500 hover:text-red-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Settings */}
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              분석 설정
            </h2>

            {/* Screening Session - Multi Select */}
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-2">기준 스크리닝 결과 (복수 선택 가능)</label>
              {sessionsLoading ? (
                <div className="text-sm text-gray-500">불러오는 중...</div>
              ) : sessions.length === 0 ? (
                <div className="text-sm text-gray-500">스크리닝 이력이 없습니다. 먼저 배당주 또는 ETF 스크리닝을 실행하세요.</div>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-gray-700/50 rounded-xl bg-gray-800/40">
                  {sessions.map(s => {
                    const isSelected = selectedSessionIds.includes(s.id);
                    const isETF = s.asset_type === 'etf';
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-700/30 border-b border-gray-800/50 last:border-b-0 transition-colors ${
                          isSelected ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSession(s.id)}
                          className="accent-emerald-500 w-4 h-4"
                        />
                        <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                          isETF ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {isETF ? 'ETF' : '주식'}
                        </span>
                        <span className="text-sm text-gray-300 flex-1">{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                배당주 + ETF를 동시에 선택하면 통합 리밸런싱 분석을 수행합니다.
                {selectedSessionIds.length > 0 && (
                  <span className="text-emerald-400 ml-1">({selectedSessionIds.length}개 선택)</span>
                )}
              </p>
            </div>

            {/* Currency Toggle */}
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-2">금액 표시 통화</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (currency === 'KRW') {
                      // Convert KRW values to USD
                      setAdditionalInvestment(prev => Math.round(prev / exchangeRate));
                      setTargetMonthlyDiv(prev => Math.round(prev / exchangeRate));
                    }
                    setCurrency('USD');
                  }}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-all ${
                    currency === 'USD'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:bg-gray-700/40'
                  }`}
                >
                  $ USD
                </button>
                <button
                  onClick={() => {
                    if (currency === 'USD') {
                      // Convert USD values to KRW
                      setAdditionalInvestment(prev => Math.round(prev * exchangeRate));
                      setTargetMonthlyDiv(prev => Math.round(prev * exchangeRate));
                    }
                    setCurrency('KRW');
                  }}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-all ${
                    currency === 'KRW'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:bg-gray-700/40'
                  }`}
                >
                  ₩ 원화
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">환율: 1 USD = {exchangeRate.toLocaleString()}원</p>
            </div>

            {/* Additional Investment */}
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-1">추가 투자금 ({currency})</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currencySymbol}</span>
                <input
                  type="number"
                  value={additionalInvestment || ''}
                  onChange={(e) => setAdditionalInvestment(Number(e.target.value))}
                  min={0}
                  step={currencyStep}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-7 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  placeholder="0"
                />
              </div>
              {currency === 'KRW' && additionalInvestment > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xs text-emerald-400 font-medium">{formatKRW(additionalInvestment)}</p>
                  <p className="text-xs text-gray-500">≈ ${toUSD(additionalInvestment).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</p>
                </div>
              )}
            </div>

            {/* Investment Tendency */}
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-2">투자 성향</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(TENDENCY_LABELS) as [InvestmentTendency, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTendency(key)}
                    className={`py-2 text-sm rounded-xl border transition-all ${
                      tendency === key
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                        : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:bg-gray-700/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max New Holdings */}
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-1">최대 신규 편입 종목 수: {maxNewHoldings}</label>
              <input
                type="range"
                min={0}
                max={10}
                value={maxNewHoldings}
                onChange={(e) => setMaxNewHoldings(Number(e.target.value))}
                onInput={(e) => setMaxNewHoldings(Number((e.target as HTMLInputElement).value))}
                className="w-full accent-emerald-500"
                style={{ touchAction: 'manipulation' }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0 (신규 없음)</span>
                <span>10</span>
              </div>
            </div>

            {/* Target Monthly Dividend */}
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-1">월 목표 배당금 - 세후 ({currency}, 선택)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currencySymbol}</span>
                <input
                  type="number"
                  value={targetMonthlyDiv || ''}
                  onChange={(e) => setTargetMonthlyDiv(Number(e.target.value))}
                  min={0}
                  step={currency === 'USD' ? 100 : 50000}
                  className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-7 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  placeholder="미설정 시 기본 분석만 수행"
                />
              </div>
              {currency === 'KRW' && targetMonthlyDiv > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xs text-emerald-400 font-medium">{formatKRW(targetMonthlyDiv)}</p>
                  <p className="text-xs text-gray-500">≈ ${toUSD(targetMonthlyDiv).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 px-5 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Analyze Button */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={handleAnalyze}
            disabled={loading || holdings.length === 0 || selectedSessionIds.length === 0}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                분석 중... (보유 종목 데이터 조회)
              </span>
            ) : (
              '리밸런싱 분석 시작'
            )}
          </button>

          {result && (
            <button
              onClick={exportResults}
              className="px-6 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl hover:bg-gray-700 border border-gray-700/50 transition-colors"
            >
              Excel 내보내기
            </button>
          )}
        </div>

        {/* Unmatched Symbols Warning */}
        {result && result.unmatchedSymbols.length > 0 && (
          <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-3 text-sm text-amber-400">
            <strong>주의:</strong> 다음 종목의 시세를 조회할 수 없었습니다: {result.unmatchedSymbols.join(', ')}
          </div>
        )}

        {/* Session Info */}
        {result && result.sessionInfo.length > 0 && (
          <div className="mb-6 text-sm text-gray-400 flex flex-wrap gap-3">
            <span>기준 데이터:</span>
            {result.sessionInfo.map((si, i) => (
              <span key={si.id} className="inline-flex items-center gap-1">
                <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                  si.assetType === 'etf' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {si.assetType === 'etf' ? 'ETF' : '주식'}
                </span>
                <span>{si.date} ({si.resultCount}종목)</span>
                {i < result.sessionInfo.length - 1 && <span className="text-gray-600">+</span>}
              </span>
            ))}
          </div>
        )}

        {/* Results: Scenarios */}
        {result && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">리밸런싱 시나리오</h2>
            {result.scenarios.map((scenario, i) => (
              <ScenarioCard key={scenario.name} scenario={scenario} index={i} exchangeRate={exchangeRate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
