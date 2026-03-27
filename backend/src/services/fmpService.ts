import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';
import { getExchangeRate } from './exchangeRateService';
import {
  StockScreeningCriteria,
  ScreenedStock,
  ScreeningProgress,
  DividendCycle,
  StockGrade,
  ScoreBreakdown,
  FMPCompanyProfile,
  FMPQuote,
  FMPDividendHistorical,
  FMPIncomeStatement,
  FMPBalanceSheet,
  FMPCashFlow,
  FMPFinancialRatios,
  FMPHistoricalPrice,
} from '../types/index';

// ==========================================
// Constants
// ==========================================

const REQUEST_DELAY_MS = 300;
const BATCH_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const KNOWN_REITS: Set<string> = new Set([
  'O', 'VICI', 'AMT', 'PLD', 'CCI', 'EQIX', 'PSA', 'DLR', 'SPG', 'WELL',
  'AVB', 'EQR', 'VTR', 'ARE', 'MAA', 'UDR', 'ESS', 'SUI', 'ELS', 'INVH',
  'PEAK', 'HST', 'KIM', 'REG', 'FRT', 'BXP', 'SLG', 'VNO', 'HIW', 'KRC',
  'OHI', 'MPW', 'NNN', 'STORE', 'ADC', 'EPRT', 'STAG', 'LTC', 'GTY',
  'IRM', 'CUBE', 'EXR', 'NSA', 'LSI', 'COLD', 'REXR', 'FR', 'TRNO',
  'WPC', 'BNL', 'GLPI', 'MGP', 'RHP', 'APLE', 'SHO', 'PK', 'XHR',
]);

const REIT_KEYWORDS = [
  'reit', 'real estate investment trust', 'real estate',
  'mortgage reit', 'equity reit', 'realty', 'property trust',
];

// ==========================================
// Axios Instance with Rate Limiting
// ==========================================

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await delay(REQUEST_DELAY_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fmpClient: AxiosInstance = axios.create({
  baseURL: env.FMP_BASE_URL,
  timeout: 15000,
  params: { apikey: env.FMP_API_KEY },
});

fmpClient.interceptors.request.use(async (config) => {
  await rateLimit();
  return config;
});

fmpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    const retryCount = (config as any).__retryCount || 0;

    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      (config as any).__retryCount = retryCount + 1;
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
      logger.warn(`Rate limited (429). Retry ${retryCount + 1}/${MAX_RETRIES} after ${backoff}ms`);
      await delay(backoff);
      return fmpClient(config);
    }

    return Promise.reject(error);
  }
);

// ==========================================
// FMP API Methods
// ==========================================

export async function getCompanyProfile(symbol: string): Promise<FMPCompanyProfile | null> {
  try {
    const { data } = await fmpClient.get<FMPCompanyProfile[]>(`/v3/profile/${symbol}`);
    return data?.[0] ?? null;
  } catch (err) {
    logger.error(`Failed to get profile for ${symbol}`, (err as Error).message);
    return null;
  }
}

export async function getQuote(symbol: string): Promise<FMPQuote | null> {
  try {
    const { data } = await fmpClient.get<FMPQuote[]>(`/v3/quote/${symbol}`);
    return data?.[0] ?? null;
  } catch (err) {
    logger.error(`Failed to get quote for ${symbol}`, (err as Error).message);
    return null;
  }
}

export async function getDividendHistory(symbol: string): Promise<FMPDividendHistorical[]> {
  try {
    const { data } = await fmpClient.get(`/v3/historical-price-full/stock_dividend/${symbol}`);
    return data?.historical ?? [];
  } catch (err) {
    logger.error(`Failed to get dividend history for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getIncomeStatements(symbol: string, limit = 5): Promise<FMPIncomeStatement[]> {
  try {
    const { data } = await fmpClient.get<FMPIncomeStatement[]>(
      `/v3/income-statement/${symbol}`,
      { params: { limit, apikey: env.FMP_API_KEY } }
    );
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get income statements for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getBalanceSheet(symbol: string): Promise<FMPBalanceSheet[]> {
  try {
    const { data } = await fmpClient.get<FMPBalanceSheet[]>(
      `/v3/balance-sheet-statement/${symbol}`,
      { params: { limit: 5, apikey: env.FMP_API_KEY } }
    );
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get balance sheet for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getCashFlowStatements(symbol: string): Promise<FMPCashFlow[]> {
  try {
    const { data } = await fmpClient.get<FMPCashFlow[]>(
      `/v3/cash-flow-statement/${symbol}`,
      { params: { limit: 5, apikey: env.FMP_API_KEY } }
    );
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get cash flow for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getFinancialRatios(symbol: string): Promise<FMPFinancialRatios[]> {
  try {
    const { data } = await fmpClient.get<FMPFinancialRatios[]>(
      `/v3/ratios/${symbol}`,
      { params: { limit: 5, apikey: env.FMP_API_KEY } }
    );
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get financial ratios for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getSP500Constituents(): Promise<{ symbol: string; name: string }[]> {
  try {
    const { data } = await fmpClient.get('/v3/sp500_constituent');
    return (data ?? []).map((c: any) => ({ symbol: c.symbol, name: c.name }));
  } catch (err) {
    logger.error('Failed to get S&P 500 constituents', (err as Error).message);
    return [];
  }
}

export async function getNasdaqConstituents(): Promise<{ symbol: string; name: string }[]> {
  try {
    const { data } = await fmpClient.get('/v3/nasdaq_constituent');
    return (data ?? []).map((c: any) => ({ symbol: c.symbol, name: c.name }));
  } catch (err) {
    logger.error('Failed to get NASDAQ constituents', (err as Error).message);
    return [];
  }
}

/**
 * Get ALL US dividend-paying stocks via stock-screener API.
 * Returns NYSE + NASDAQ + AMEX listed stocks with dividendMoreThan > 0.
 */
// In-memory cache for full universe (valid 30 min)
let _allDividendStocksCache: { data: { symbol: string; name: string }[]; fetchedAt: number } | null = null;

export async function getAllUSDividendStocks(): Promise<{ symbol: string; name: string }[]> {
  // Return cache if fresh (30 min)
  if (_allDividendStocksCache && Date.now() - _allDividendStocksCache.fetchedAt < 1800_000) {
    logger.info(`[FMP] 전체 배당주 유니버스 캐시 반환: ${_allDividendStocksCache.data.length}개 (${Math.round((Date.now() - _allDividendStocksCache.fetchedAt) / 1000)}초 전 조회)`);
    return _allDividendStocksCache.data;
  }

  try {
    const startTime = Date.now();
    const exchanges = ['NYSE', 'NASDAQ', 'AMEX'];

    logger.info('═══════════════════════════════════════════════════════');
    logger.info('  🌐 전체 미국 배당주 유니버스 조회 시작');
    logger.info('═══════════════════════════════════════════════════════');

    // Parallel fetch all 3 exchanges (bypass rate limiter - these are bulk queries)
    const fetches = exchanges.map(async (exchange) => {
      const t0 = Date.now();
      logger.info(`  📡 ${exchange} 배당주 조회 중...`);
      const { data } = await axios.get(`${env.FMP_BASE_URL}/v3/stock-screener`, {
        params: {
          apikey: env.FMP_API_KEY,
          exchange,
          dividendMoreThan: 0,
          isActivelyTrading: true,
          limit: 5000,
        },
        timeout: 30000,
      });
      const count = Array.isArray(data) ? data.length : 0;
      logger.info(`  ✅ ${exchange}: ${count}개 (${((Date.now() - t0) / 1000).toFixed(1)}초)`);
      return { exchange, data: Array.isArray(data) ? data : [] };
    });

    const results = await Promise.all(fetches);

    // Deduplicate
    const seen = new Map<string, string>();
    for (const { data } of results) {
      for (const s of data) {
        if (!seen.has(s.symbol)) {
          seen.set(s.symbol, s.companyName || s.symbol);
        }
      }
    }

    const deduped = Array.from(seen.entries()).map(([symbol, name]) => ({ symbol, name }));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info('───────────────────────────────────────────────────────');
    for (const r of results) {
      logger.info(`     • ${r.exchange}: ${r.data.length}개`);
    }
    logger.info(`     • 중복 제거 후: ${deduped.length}개`);
    logger.info(`  ⏱️  소요 시간: ${elapsed}초`);
    logger.info('═══════════════════════════════════════════════════════');

    // Cache result
    _allDividendStocksCache = { data: deduped, fetchedAt: Date.now() };

    return deduped;
  } catch (err) {
    logger.error(`[FMP] 전체 배당주 유니버스 조회 실패: ${(err as Error).message}`);
    return [];
  }
}

export async function getHistoricalPrices(
  symbol: string,
  from: string,
  to: string
): Promise<FMPHistoricalPrice[]> {
  try {
    const { data } = await fmpClient.get(`/v3/historical-price-full/${symbol}`, {
      params: { from, to, apikey: env.FMP_API_KEY },
    });
    return data?.historical ?? [];
  } catch (err) {
    logger.error(`Failed to get historical prices for ${symbol}`, (err as Error).message);
    return [];
  }
}

// ==========================================
// REIT Detection
// ==========================================

function isREIT(symbol: string, sector?: string, industry?: string): boolean {
  if (KNOWN_REITS.has(symbol.toUpperCase())) return true;

  const combined = `${sector ?? ''} ${industry ?? ''}`.toLowerCase();
  return REIT_KEYWORDS.some(kw => combined.includes(kw));
}

// ==========================================
// Dividend Cycle Detection
// ==========================================

function determineDividendCycle(dividends: FMPDividendHistorical[]): DividendCycle {
  if (dividends.length < 2) return 'unknown';

  // Sort descending by date
  const sorted = [...dividends]
    .filter(d => d.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sorted.length < 2) return 'unknown';

  // Calculate gaps between consecutive dividends (in days)
  const gaps: number[] = [];
  const recentDivs = sorted.slice(0, Math.min(12, sorted.length));
  for (let i = 0; i < recentDivs.length - 1; i++) {
    const d1 = new Date(recentDivs[i].date).getTime();
    const d2 = new Date(recentDivs[i + 1].date).getTime();
    const gapDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
    if (gapDays > 5) { // filter out duplicate entries
      gaps.push(gapDays);
    }
  }

  if (gaps.length === 0) return 'unknown';

  // Use median gap
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  if (median < 45) return 'monthly';
  if (median >= 60 && median <= 120) return 'quarterly';
  if (median >= 150 && median <= 210) return 'semi-annual';
  if (median > 300) return 'annual';

  // Edge cases
  if (median > 45 && median < 60) return 'quarterly';
  if (median > 120 && median < 150) return 'quarterly';
  if (median > 210 && median <= 300) return 'semi-annual';

  return 'unknown';
}

// ==========================================
// Annual Dividend Calculation
// ==========================================

function calculateAnnualDividend(
  cycle: DividendCycle,
  dividends: FMPDividendHistorical[]
): number {
  if (dividends.length === 0) return 0;

  const sorted = [...dividends]
    .filter(d => d.dividend > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sorted.length === 0) return 0;

  const latestDiv = sorted[0].dividend;

  switch (cycle) {
    case 'monthly':
      return latestDiv * 12;
    case 'quarterly':
      return latestDiv * 4;
    case 'semi-annual':
      return latestDiv * 2;
    case 'annual':
      return latestDiv;
    case 'unknown':
    default: {
      // Sum last 12 months of dividends
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const last12 = sorted.filter(d => new Date(d.date) >= oneYearAgo);
      if (last12.length > 0) {
        return last12.reduce((sum, d) => sum + d.dividend, 0);
      }
      // Fallback: use last 4 dividends
      return sorted.slice(0, 4).reduce((sum, d) => sum + d.dividend, 0);
    }
  }
}

// ==========================================
// Payout Ratio Calculation (IMPROVED)
// ==========================================

interface PayoutResult {
  ratio: number;      // percentage
  method: string;
  isValid: boolean;
}

function calculatePayoutRatio(
  annualDividend: number,
  eps: number,
  netIncome: number,
  sharesOutstanding: number,
  cashFlows: FMPCashFlow[],
  isReit: boolean
): PayoutResult {
  // REIT: AFFO-based calculation
  if (isReit && cashFlows.length > 0) {
    const cf = cashFlows[0];
    const operatingCF = cf.operatingCashFlow || 0;
    const da = cf.depreciationAndAmortization || 0;
    const capex = Math.abs(cf.capitalExpenditure || 0);
    const affo = operatingCF + da - capex * 0.5; // maintenance capex ~50% of total
    if (affo > 0 && sharesOutstanding > 0) {
      const totalDividends = annualDividend * sharesOutstanding;
      const ratio = Math.min((totalDividends / affo) * 100, 300);
      return { ratio, method: 'AFFO', isValid: true };
    }
  }

  // Primary: DPS / EPS
  if (eps > 0 && annualDividend > 0) {
    const ratio = Math.min((annualDividend / eps) * 100, 300);
    return { ratio, method: 'DPS/EPS', isValid: true };
  }

  // Secondary: Total dividends / Net income
  if (netIncome > 0 && sharesOutstanding > 0 && annualDividend > 0) {
    const totalDividends = annualDividend * sharesOutstanding;
    const ratio = Math.min((totalDividends / netIncome) * 100, 300);
    return { ratio, method: 'TotalDiv/NetIncome', isValid: true };
  }

  // Company is unprofitable - REJECT
  if (eps <= 0 && netIncome <= 0) {
    return { ratio: 0, method: 'unprofitable', isValid: false };
  }

  return { ratio: 0, method: 'unknown', isValid: false };
}

// ==========================================
// Consecutive Dividend Years
// ==========================================

function countConsecutiveDividendYears(dividends: FMPDividendHistorical[]): number {
  if (dividends.length === 0) return 0;

  const years = new Set<number>();
  for (const d of dividends) {
    if (d.date) {
      years.add(new Date(d.date).getFullYear());
    }
  }

  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();

  let consecutive = 0;
  for (let i = 0; i < sortedYears.length; i++) {
    const expectedYear = currentYear - i;
    // Allow 1 year tolerance (current year might not have dividend yet)
    if (sortedYears[i] === expectedYear || sortedYears[i] === expectedYear - 1) {
      consecutive++;
    } else if (i === 0 && sortedYears[i] === currentYear - 1) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

// ==========================================
// Dividend Consistency Check (STRICTER)
// ==========================================

function checkDividendConsistency(dividends: FMPDividendHistorical[]): boolean {
  // Must have at least 3 of last 4 expected payments
  const sorted = [...dividends]
    .filter(d => d.date && d.dividend > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sorted.length < 3) return false;

  // Check: in last 15 months, should have at least 3 payments
  const fifteenMonthsAgo = new Date();
  fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);

  const recentPayments = sorted.filter(d => new Date(d.date) >= fifteenMonthsAgo);
  return recentPayments.length >= 3;
}

// ==========================================
// Scoring System
// ==========================================

function calculateStockScore(
  stock: Partial<ScreenedStock>,
  incomeStatements: FMPIncomeStatement[],
  cashFlows: FMPCashFlow[],
  balanceSheets: FMPBalanceSheet[]
): { score: number; grade: StockGrade; breakdown: ScoreBreakdown } {
  // --- Stability (30%) ---
  let stabilityScore = 0;
  {
    // Consecutive dividend years (max 25yr = 100)
    const yearScore = Math.min((stock.consecutiveDividendYears ?? 0) / 25, 1) * 40;

    // Payout ratio safety (sweet spot: 30-60%)
    const pr = stock.payoutRatio ?? 0;
    let payoutScore = 0;
    if (pr >= 20 && pr <= 50) payoutScore = 35;
    else if (pr > 50 && pr <= 70) payoutScore = 25;
    else if (pr > 70 && pr <= 85) payoutScore = 15;
    else if (pr > 10 && pr < 20) payoutScore = 20;
    else payoutScore = 5;

    // Debt/Equity (lower is better, <1 is good)
    const de = stock.debtToEquity ?? 2;
    let debtScore = 0;
    if (de < 0.3) debtScore = 25;
    else if (de < 0.5) debtScore = 22;
    else if (de < 1.0) debtScore = 18;
    else if (de < 1.5) debtScore = 12;
    else if (de < 2.0) debtScore = 8;
    else debtScore = 3;

    stabilityScore = yearScore + payoutScore + debtScore;
  }

  // --- Profitability (20%) ---
  let profitabilityScore = 0;
  {
    // ROE
    const roe = stock.roe ?? 0;
    let roeScore = 0;
    if (roe >= 20) roeScore = 50;
    else if (roe >= 15) roeScore = 42;
    else if (roe >= 10) roeScore = 32;
    else if (roe >= 5) roeScore = 20;
    else roeScore = 5;

    // Operating margin
    let marginScore = 0;
    if (incomeStatements.length > 0) {
      const latest = incomeStatements[0];
      const margin = latest.revenue > 0 ? (latest.operatingIncome / latest.revenue) * 100 : 0;
      if (margin >= 25) marginScore = 50;
      else if (margin >= 15) marginScore = 40;
      else if (margin >= 10) marginScore = 30;
      else if (margin >= 5) marginScore = 18;
      else marginScore = 5;
    }

    profitabilityScore = roeScore + marginScore;
  }

  // --- Growth (15%) ---
  let growthScore = 0;
  {
    if (incomeStatements.length >= 2) {
      const latest = incomeStatements[0];
      const previous = incomeStatements[1];

      // Revenue growth
      const revGrowth = previous.revenue > 0
        ? ((latest.revenue - previous.revenue) / previous.revenue) * 100
        : 0;
      let revScore = 0;
      if (revGrowth >= 15) revScore = 50;
      else if (revGrowth >= 10) revScore = 42;
      else if (revGrowth >= 5) revScore = 32;
      else if (revGrowth >= 0) revScore = 20;
      else revScore = 5;

      // EPS growth
      const epsGrowth = previous.epsdiluted > 0
        ? ((latest.epsdiluted - previous.epsdiluted) / previous.epsdiluted) * 100
        : 0;
      let epsScore = 0;
      if (epsGrowth >= 20) epsScore = 50;
      else if (epsGrowth >= 10) epsScore = 40;
      else if (epsGrowth >= 5) epsScore = 30;
      else if (epsGrowth >= 0) epsScore = 18;
      else epsScore = 5;

      growthScore = revScore + epsScore;
    }
  }

  // --- Valuation (15%) ---
  let valuationScore = 0;
  {
    // PE ratio (sweet spot 10-20)
    const pe = stock.pe ?? 0;
    let peScore = 0;
    if (pe > 0 && pe <= 15) peScore = 50;
    else if (pe > 15 && pe <= 20) peScore = 42;
    else if (pe > 20 && pe <= 25) peScore = 30;
    else if (pe > 25 && pe <= 35) peScore = 18;
    else if (pe > 35) peScore = 8;
    else peScore = 5; // negative or 0

    // PB ratio
    const pb = stock.pb ?? 0;
    let pbScore = 0;
    if (pb > 0 && pb <= 1.5) pbScore = 50;
    else if (pb > 1.5 && pb <= 3) pbScore = 38;
    else if (pb > 3 && pb <= 5) pbScore = 25;
    else if (pb > 5) pbScore = 10;
    else pbScore = 5;

    valuationScore = peScore + pbScore;
  }

  // --- Dividend (20%) ---
  let dividendScore = 0;
  {
    // Yield score
    const yld = stock.dividendYield ?? 0;
    let yieldScore = 0;
    if (yld >= 5) yieldScore = 35;
    else if (yld >= 4) yieldScore = 32;
    else if (yld >= 3) yieldScore = 28;
    else if (yld >= 2) yieldScore = 22;
    else if (yld >= 1) yieldScore = 15;
    else yieldScore = 5;

    // Consistency score (from property)
    const consistScore = Math.min((stock.dividendConsistencyScore ?? 0) / 100, 1) * 35;

    // FCF coverage
    let fcfScore = 0;
    if (cashFlows.length > 0) {
      const fcf = cashFlows[0].freeCashFlow || 0;
      const divPaid = Math.abs(cashFlows[0].dividendsPaid || 0);
      if (fcf > 0 && divPaid > 0) {
        const coverage = fcf / divPaid;
        if (coverage >= 2.0) fcfScore = 30;
        else if (coverage >= 1.5) fcfScore = 25;
        else if (coverage >= 1.2) fcfScore = 20;
        else if (coverage >= 1.0) fcfScore = 12;
        else fcfScore = 5;
      }
    }

    dividendScore = yieldScore + consistScore + fcfScore;
  }

  // Weighted total
  const score = Math.round(
    stabilityScore * 0.30 +
    profitabilityScore * 0.20 +
    growthScore * 0.15 +
    valuationScore * 0.15 +
    dividendScore * 0.20
  );

  const clampedScore = Math.max(0, Math.min(100, score));

  // Grade assignment
  let grade: StockGrade;
  if (clampedScore >= 85) grade = 'A+';
  else if (clampedScore >= 75) grade = 'A';
  else if (clampedScore >= 65) grade = 'B+';
  else if (clampedScore >= 55) grade = 'B';
  else if (clampedScore >= 40) grade = 'C';
  else grade = 'D';

  return {
    score: clampedScore,
    grade,
    breakdown: {
      stability: Math.round(stabilityScore),
      profitability: Math.round(profitabilityScore),
      growth: Math.round(growthScore),
      valuation: Math.round(valuationScore),
      dividend: Math.round(dividendScore),
    },
  };
}

// ==========================================
// Stock Screening
// ==========================================

export async function screenDividendStocks(
  criteria: StockScreeningCriteria,
  progressCallback?: (progress: ScreeningProgress) => void
): Promise<ScreenedStock[]> {
  const results: ScreenedStock[] = [];

  logger.info('═══════════════════════════════════════════════════════');
  logger.info('  📊 배당주 스크리닝 시작');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  📋 필터 조건:`);
  logger.info(`     • 최소 배당수익률: ${criteria.minDividendYield}%`);
  logger.info(`     • 최소 시가총액: $${(criteria.minMarketCapUSD / 1e9).toFixed(1)}B`);
  logger.info(`     • 최대 배당성향: ${criteria.maxPayoutRatio}%`);
  logger.info(`     • 최대 분석 종목수: ${criteria.maxStocksToCheck}`);
  logger.info(`     • 유니버스 모드: ${criteria.indexOnly !== false ? '지수 편입 종목 (S&P500+NASDAQ100)' : '전체 미국 배당주'}`);
  logger.info(`     • 배치 크기: ${criteria.batchSize || 10}`);
  logger.info('───────────────────────────────────────────────────────');

  // Step 1: Get universe
  let allSymbols: string[];
  let screeningOrder: string;

  if (criteria.indexOnly !== false) {
    // Index-only mode: S&P500 + NASDAQ100
    logger.info('  🔍 종목 유니버스 수집 중 (S&P500 + NASDAQ100 지수)...');
    const [sp500, nasdaq] = await Promise.all([
      getSP500Constituents(),
      getNasdaqConstituents(),
    ]);

    const symbolMap = new Map<string, string>();
    for (const s of sp500) symbolMap.set(s.symbol, s.name);
    for (const s of nasdaq) symbolMap.set(s.symbol, s.name);

    allSymbols = Array.from(symbolMap.keys());
    screeningOrder = `S&P500(${sp500.length}개) + NASDAQ100(${nasdaq.length}개) 중복 제거 → ${allSymbols.length}개`;

    logger.info(`  📈 유니버스 구성 (지수 모드):`);
    logger.info(`     • S&P500: ${sp500.length}개`);
    logger.info(`     • NASDAQ100: ${nasdaq.length}개`);
    logger.info(`     • 중복 제거 후: ${allSymbols.length}개`);
  } else {
    // Full mode: all US dividend-paying stocks
    logger.info('  🔍 종목 유니버스 수집 중 (전체 미국 배당주)...');
    const allStocks = await getAllUSDividendStocks();
    allSymbols = allStocks.map(s => s.symbol);
    screeningOrder = `NYSE+NASDAQ+AMEX 배당 지급 종목 → ${allSymbols.length}개`;

    logger.info(`  📈 유니버스 구성 (전체 모드):`);
    logger.info(`     • 전체 미국 배당주: ${allSymbols.length}개`);
  }

  const totalToCheck = Math.min(allSymbols.length, criteria.maxStocksToCheck);
  const universe = allSymbols.slice(0, totalToCheck);

  logger.info(`     • 분석 대상: ${universe.length}개 (앞에서부터 선택)`);
  logger.info(`  ℹ️  순서: ${screeningOrder}`);
  logger.info('───────────────────────────────────────────────────────');

  // Get exchange rate
  const exchangeRateData = await getExchangeRate();
  const krwRate = exchangeRateData.rate;
  logger.info(`  💱 환율: 1 USD = ${krwRate.toLocaleString()} KRW`);
  logger.info('───────────────────────────────────────────────────────');

  // Step 2: Batch process with ETA tracking
  const batchSize = criteria.batchSize || 10;
  let processedCount = 0;
  let skippedCount = 0;
  const startTime = Date.now();
  const stockTimings: number[] = []; // 최근 N개 종목의 처리 시간 추적

  logger.info(`  🚀 스크리닝 시작 (배치 크기: ${batchSize}, 총 ${Math.ceil(universe.length / batchSize)} 배치)`);

  for (let batchStart = 0; batchStart < universe.length; batchStart += batchSize) {
    const batchNum = Math.floor(batchStart / batchSize) + 1;
    const totalBatches = Math.ceil(universe.length / batchSize);
    const batch = universe.slice(batchStart, batchStart + batchSize);

    logger.info(`  ── 배치 ${batchNum}/${totalBatches} ──────────────────────`);

    for (const symbol of batch) {
      processedCount++;
      const stockStart = Date.now();

      try {
        const stock = await analyzeStock(symbol, criteria, krwRate);
        if (stock) {
          results.push(stock);
          logger.info(`  ✅ [${processedCount}/${universe.length}] ${symbol.padEnd(6)} | 수익률: ${stock.dividendYield.toFixed(2)}% | 성향: ${stock.payoutRatio.toFixed(1)}% | 점수: ${stock.overallScore} (${stock.grade}) | ${stock.sector}`);
        } else {
          skippedCount++;
          logger.info(`  ⏭️  [${processedCount}/${universe.length}] ${symbol.padEnd(6)} | 조건 미달 (SKIP)`);
        }
      } catch (err) {
        skippedCount++;
        logger.error(`  ❌ [${processedCount}/${universe.length}] ${symbol.padEnd(6)} | ERROR: ${(err as Error).message}`);
      }

      // 처리 시간 추적 (최근 20개 이동평균)
      const stockElapsed = (Date.now() - stockStart) / 1000;
      stockTimings.push(stockElapsed);
      if (stockTimings.length > 20) stockTimings.shift();

      // ETA 계산
      const avgTimePerStock = stockTimings.reduce((a, b) => a + b, 0) / stockTimings.length;
      const remainingStocks = universe.length - processedCount;
      const estimatedRemaining = avgTimePerStock * remainingStocks;

      // Progress callback with ETA
      if (progressCallback) {
        progressCallback({
          status: 'running',
          processedStocks: processedCount,
          totalStocks: universe.length,
          foundStocks: results.length,
          progress: Math.round((processedCount / universe.length) * 100),
          currentSymbol: symbol,
          estimatedTimeRemaining: Math.round(estimatedRemaining),
          averageTimePerStock: Math.round(avgTimePerStock * 100) / 100,
          skippedStocks: skippedCount,
          screeningOrder,
        });
      }
    }

    // 배치 요약 로그
    const elapsed = (Date.now() - startTime) / 1000;
    const avgTime = stockTimings.reduce((a, b) => a + b, 0) / stockTimings.length;
    const remaining = universe.length - processedCount;
    const eta = avgTime * remaining;
    logger.info(`  📊 진행: ${processedCount}/${universe.length} (${Math.round((processedCount / universe.length) * 100)}%) | 발견: ${results.length}개 | 스킵: ${skippedCount}개 | 경과: ${formatElapsed(elapsed)} | 예상잔여: ${formatElapsed(eta)}`);

    // Delay between batches
    if (batchStart + batchSize < universe.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  // Sort by score descending, then by dividend yield descending
  results.sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    return b.dividendYield - a.dividendYield;
  });

  const totalElapsed = (Date.now() - startTime) / 1000;
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('  🏁 배당주 스크리닝 완료');
  logger.info(`     • 총 분석: ${processedCount}개`);
  logger.info(`     • 통과: ${results.length}개`);
  logger.info(`     • 스킵/필터링: ${skippedCount}개`);
  logger.info(`     • 총 소요시간: ${formatElapsed(totalElapsed)}`);
  logger.info(`     • 종목당 평균: ${(totalElapsed / processedCount).toFixed(1)}초`);
  if (results.length > 0) {
    logger.info(`     • 최고점수: ${results[0].symbol} (${results[0].overallScore}점, ${results[0].grade})`);
    logger.info(`     • 최고수익률: ${results.reduce((max, s) => s.dividendYield > max.dividendYield ? s : max).symbol} (${results.reduce((max, s) => s.dividendYield > max.dividendYield ? s : max).dividendYield.toFixed(2)}%)`);
  }
  logger.info('═══════════════════════════════════════════════════════');

  return results;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}초`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}분 ${secs}초`;
}

// ==========================================
// Analyze Single Stock
// ==========================================

async function analyzeStock(
  symbol: string,
  criteria: StockScreeningCriteria,
  krwRate: number
): Promise<ScreenedStock | null> {
  // Get profile first for quick filtering
  const profile = await getCompanyProfile(symbol);
  if (!profile) return null;

  // Must be actively trading
  if (!profile.isActivelyTrading) return null;

  // Must be on NYSE or NASDAQ (strict match)
  const exchange = (profile.exchangeShortName || '').toUpperCase();
  if (exchange !== 'NYSE' && exchange !== 'NASDAQ') return null;

  // Skip ETFs
  if (profile.isEtf) return null;

  // Market cap filter (always in USD)
  if (profile.mktCap < criteria.minMarketCapUSD) return null;

  // Get quote for more data
  const quote = await getQuote(symbol);
  if (!quote) return null;

  // Get dividend history
  const dividends = await getDividendHistory(symbol);
  if (dividends.length === 0) return null;

  // Dividend consistency check (3 of last 4 payments)
  if (!checkDividendConsistency(dividends)) return null;

  // Determine cycle and annual dividend
  const cycle = determineDividendCycle(dividends);
  const annualDividend = calculateAnnualDividend(cycle, dividends);
  if (annualDividend <= 0) return null;

  // Calculate dividend yield
  const price = quote.price || profile.price;
  if (!price || price <= 0) return null;
  const dividendYield = (annualDividend / price) * 100;

  // Yield filter
  if (dividendYield < criteria.minDividendYield) return null;

  // Detect REIT
  const stockIsREIT = isREIT(symbol, profile.sector, profile.industry);

  // Get financial data
  const [incomeStatements, balanceSheets, cashFlows, ratios] = await Promise.all([
    getIncomeStatements(symbol, 5),
    getBalanceSheet(symbol),
    getCashFlowStatements(symbol),
    getFinancialRatios(symbol),
  ]);

  // Payout ratio calculation
  const eps = quote.eps || (incomeStatements.length > 0 ? incomeStatements[0].epsdiluted : 0);
  const netIncome = incomeStatements.length > 0 ? incomeStatements[0].netIncome : 0;
  const sharesOut = quote.sharesOutstanding || (incomeStatements.length > 0 ? incomeStatements[0].weightedAverageShsOut : 0);

  const payoutResult = calculatePayoutRatio(
    annualDividend, eps, netIncome, sharesOut, cashFlows, stockIsREIT
  );

  // Reject unprofitable companies
  if (!payoutResult.isValid && payoutResult.method === 'unprofitable') {
    logger.debug(`${symbol}: rejected - unprofitable (EPS: ${eps}, NetIncome: ${netIncome})`);
    return null;
  }

  // Payout ratio filter
  const payoutRatio = payoutResult.ratio;
  const maxPayout = criteria.maxPayoutRatio || 85;
  if (stockIsREIT) {
    if (payoutRatio < 10 || payoutRatio > 100) return null;
  } else {
    if (payoutRatio < 10 || payoutRatio > maxPayout) return null;
  }

  // Calculate additional metrics
  const consecutiveYears = countConsecutiveDividendYears(dividends);
  const consistencyScore = calculateConsistencyScore(dividends);

  // Financial ratios
  const latestRatios = ratios.length > 0 ? ratios[0] : null;

  // ROE: try TTM ratio first, then calculate from financial statements
  let roe = 0;
  if (latestRatios?.returnOnEquityTTM) {
    roe = latestRatios.returnOnEquityTTM * 100;
  } else if (latestRatios?.returnOnEquity) {
    roe = latestRatios.returnOnEquity * 100;
  } else if (incomeStatements.length > 0 && balanceSheets.length > 0) {
    // Fallback: calculate ROE = NetIncome / Shareholders' Equity × 100
    const ni = incomeStatements[0].netIncome;
    const equity = balanceSheets[0].totalStockholdersEquity;
    if (equity > 0 && ni !== 0) {
      roe = (ni / equity) * 100;
    }
  }

  const debtToEquity = latestRatios?.debtEquityRatioTTM ?? (
    balanceSheets.length > 0 && balanceSheets[0].totalStockholdersEquity > 0
      ? balanceSheets[0].totalDebt / balanceSheets[0].totalStockholdersEquity
      : 0
  );

  const pe = latestRatios?.priceEarningsRatioTTM ?? quote.pe ?? 0;
  const pb = latestRatios?.priceToBookRatioTTM ?? undefined;
  const ps = latestRatios?.priceToSalesRatioTTM ?? undefined;

  // Cash flow metrics
  const ocf = cashFlows.length > 0 ? cashFlows[0].operatingCashFlow : undefined;
  const fcf = cashFlows.length > 0 ? cashFlows[0].freeCashFlow : undefined;
  const fcfPayout = fcf && fcf > 0 && sharesOut > 0
    ? ((annualDividend * sharesOut) / fcf) * 100
    : undefined;

  // Growth metrics
  let revenueGrowth: number | undefined;
  let netIncomeGrowth: number | undefined;
  if (incomeStatements.length >= 2) {
    const curr = incomeStatements[0];
    const prev = incomeStatements[1];
    if (prev.revenue > 0) {
      revenueGrowth = ((curr.revenue - prev.revenue) / prev.revenue) * 100;
    }
    if (prev.netIncome > 0) {
      netIncomeGrowth = ((curr.netIncome - prev.netIncome) / prev.netIncome) * 100;
    }
  }

  // Recent dividend dates
  const sortedDivs = [...dividends].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestDiv = sortedDivs[0];

  // Build partial stock for scoring
  const partialStock: Partial<ScreenedStock> = {
    symbol,
    name: profile.companyName || quote.name,
    exchange: profile.exchangeShortName,
    sector: profile.sector,
    industry: profile.industry,
    currentPrice: price,
    marketCap: profile.mktCap,
    dividendYield,
    annualDividend,
    dividendCycle: cycle,
    payoutRatio,
    consecutiveDividendYears: consecutiveYears,
    dividendConsistencyScore: consistencyScore,
    eps,
    pe,
    pb,
    ps,
    beta: profile.beta,
    roe,
    debtToEquity,
    operatingCashFlow: ocf,
    freeCashFlow: fcf,
    fcfPayoutRatio: fcfPayout,
    revenueGrowth,
    netIncomeGrowth,
    isREIT: stockIsREIT,
  };

  // Calculate score
  const { score, grade, breakdown } = calculateStockScore(
    partialStock, incomeStatements, cashFlows, balanceSheets
  );

  const screenedStock: ScreenedStock = {
    symbol,
    name: profile.companyName || quote.name,
    exchange: profile.exchangeShortName,
    sector: profile.sector || '',
    industry: profile.industry || '',
    currentPrice: price,
    marketCap: profile.mktCap,
    marketCapKRW: profile.mktCap * krwRate,
    dividendYield,
    annualDividend,
    dividendCycle: cycle,
    payoutRatio: Math.round(payoutRatio * 100) / 100,
    consecutiveDividendYears: consecutiveYears,
    dividendConsistencyScore: consistencyScore,
    exDividendDate: latestDiv?.date,
    paymentDate: latestDiv?.paymentDate || undefined,
    eps,
    pe: Math.round(pe * 100) / 100,
    pb,
    ps,
    beta: profile.beta,
    roe: Math.round(roe * 100) / 100,
    debtToEquity: Math.round(debtToEquity * 100) / 100,
    operatingCashFlow: ocf,
    freeCashFlow: fcf,
    fcfPayoutRatio: fcfPayout ? Math.round(fcfPayout * 100) / 100 : undefined,
    revenueGrowth: revenueGrowth ? Math.round(revenueGrowth * 100) / 100 : undefined,
    netIncomeGrowth: netIncomeGrowth ? Math.round(netIncomeGrowth * 100) / 100 : undefined,
    overallScore: score,
    grade,
    scoreBreakdown: breakdown,
    isREIT: stockIsREIT,
    lastUpdated: new Date().toISOString(),
  };

  return screenedStock;
}

function calculateConsistencyScore(dividends: FMPDividendHistorical[]): number {
  if (dividends.length === 0) return 0;

  const sorted = [...dividends]
    .filter(d => d.date && d.dividend > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Factors:
  // 1. Number of dividend payments (max 40 = 100 points / 50%)
  const countScore = Math.min(sorted.length / 40, 1) * 50;

  // 2. Regularity (coefficient of variation of gaps, lower = better) / 30%
  let regularityScore = 0;
  if (sorted.length >= 3) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(sorted.length - 1, 20); i++) {
      const d1 = new Date(sorted[i].date).getTime();
      const d2 = new Date(sorted[i + 1].date).getTime();
      gaps.push(Math.abs(d1 - d2));
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    regularityScore = Math.max(0, (1 - cv)) * 30;
  }

  // 3. No dividend cuts in recent history (last 8 payments) / 20%
  let noCutScore = 20;
  for (let i = 0; i < Math.min(sorted.length - 1, 7); i++) {
    if (sorted[i].dividend < sorted[i + 1].dividend * 0.9) {
      noCutScore = Math.max(0, noCutScore - 5);
    }
  }

  return Math.round(countScore + regularityScore + noCutScore);
}

// ==========================================
// Stock Detail
// ==========================================

export async function getStockDetail(symbol: string): Promise<ScreenedStock | null> {
  const defaultCriteria: StockScreeningCriteria = {
    minDividendYield: 0,
    minMarketCapUSD: 0,
    maxPayoutRatio: 300,
    minConsecutiveDividendYears: 0,
    maxStocksToCheck: 1,
    batchSize: 1,
  };

  const exchangeRateData = await getExchangeRate();

  // Bypass most filters for detail view
  const profile = await getCompanyProfile(symbol);
  if (!profile) return null;

  const quote = await getQuote(symbol);
  if (!quote) return null;

  const dividends = await getDividendHistory(symbol);
  const cycle = determineDividendCycle(dividends);
  const annualDividend = calculateAnnualDividend(cycle, dividends);
  const price = quote.price || profile.price;
  const dividendYield = price > 0 ? (annualDividend / price) * 100 : 0;

  const stockIsREIT = isREIT(symbol, profile.sector, profile.industry);

  const [incomeStatements, balanceSheets, cashFlows, ratios] = await Promise.all([
    getIncomeStatements(symbol, 5),
    getBalanceSheet(symbol),
    getCashFlowStatements(symbol),
    getFinancialRatios(symbol),
  ]);

  const eps = quote.eps || (incomeStatements.length > 0 ? incomeStatements[0].epsdiluted : 0);
  const netIncome = incomeStatements.length > 0 ? incomeStatements[0].netIncome : 0;
  const sharesOut = quote.sharesOutstanding || (incomeStatements.length > 0 ? incomeStatements[0].weightedAverageShsOut : 0);

  const payoutResult = calculatePayoutRatio(
    annualDividend, eps, netIncome, sharesOut, cashFlows, stockIsREIT
  );

  const consecutiveYears = countConsecutiveDividendYears(dividends);
  const consistencyScore = calculateConsistencyScore(dividends);

  const latestRatios = ratios.length > 0 ? ratios[0] : null;

  // ROE: try TTM ratio, then annual ratio, then calculate from statements
  let roe = 0;
  if (latestRatios?.returnOnEquityTTM) {
    roe = latestRatios.returnOnEquityTTM * 100;
    logger.debug(`${symbol} ROE from TTM ratio: ${roe.toFixed(1)}%`);
  } else if (latestRatios?.returnOnEquity) {
    roe = latestRatios.returnOnEquity * 100;
    logger.debug(`${symbol} ROE from annual ratio: ${roe.toFixed(1)}%`);
  } else if (incomeStatements.length > 0 && balanceSheets.length > 0) {
    const ni = incomeStatements[0].netIncome;
    const equity = balanceSheets[0].totalStockholdersEquity;
    if (equity > 0 && ni !== 0) {
      roe = (ni / equity) * 100;
      logger.debug(`${symbol} ROE calculated from statements: NI=${ni}, Equity=${equity}, ROE=${roe.toFixed(1)}%`);
    }
  }
  if (roe === 0) {
    logger.warn(`${symbol} ROE is 0 - ratios TTM: ${latestRatios?.returnOnEquityTTM}, annual: ${latestRatios?.returnOnEquity}`);
  }

  const debtToEquity = latestRatios?.debtEquityRatioTTM ?? latestRatios?.debtEquityRatio ?? (
    balanceSheets.length > 0 && balanceSheets[0].totalStockholdersEquity > 0
      ? balanceSheets[0].totalDebt / balanceSheets[0].totalStockholdersEquity
      : 0
  );
  const pe = latestRatios?.priceEarningsRatioTTM ?? latestRatios?.priceEarningsRatio ?? quote.pe ?? 0;
  const pb = latestRatios?.priceToBookRatioTTM ?? latestRatios?.priceToBookRatio ?? undefined;
  const ps = latestRatios?.priceToSalesRatioTTM ?? latestRatios?.priceToSalesRatio ?? undefined;

  const ocf = cashFlows.length > 0 ? cashFlows[0].operatingCashFlow : undefined;
  const fcf = cashFlows.length > 0 ? cashFlows[0].freeCashFlow : undefined;
  const fcfPayout = fcf && fcf > 0 && sharesOut > 0
    ? ((annualDividend * sharesOut) / fcf) * 100
    : undefined;

  let revenueGrowth: number | undefined;
  let netIncomeGrowth: number | undefined;
  if (incomeStatements.length >= 2) {
    const curr = incomeStatements[0];
    const prev = incomeStatements[1];
    if (prev.revenue > 0) revenueGrowth = ((curr.revenue - prev.revenue) / prev.revenue) * 100;
    if (prev.netIncome > 0) netIncomeGrowth = ((curr.netIncome - prev.netIncome) / prev.netIncome) * 100;
  }

  const sortedDivs = [...dividends].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestDiv = sortedDivs[0];

  const partialStock: Partial<ScreenedStock> = {
    dividendYield, payoutRatio: payoutResult.ratio,
    consecutiveDividendYears: consecutiveYears,
    dividendConsistencyScore: consistencyScore,
    eps, pe, pb, roe, debtToEquity, isREIT: stockIsREIT,
  };

  const { score, grade, breakdown } = calculateStockScore(
    partialStock, incomeStatements, cashFlows, balanceSheets
  );

  return {
    symbol,
    name: profile.companyName || quote.name,
    exchange: profile.exchangeShortName,
    sector: profile.sector || '',
    industry: profile.industry || '',
    currentPrice: price,
    marketCap: profile.mktCap,
    marketCapKRW: profile.mktCap * exchangeRateData.rate,
    dividendYield,
    annualDividend,
    dividendCycle: cycle,
    payoutRatio: Math.round(payoutResult.ratio * 100) / 100,
    consecutiveDividendYears: consecutiveYears,
    dividendConsistencyScore: consistencyScore,
    exDividendDate: latestDiv?.date,
    paymentDate: latestDiv?.paymentDate || undefined,
    eps,
    pe: Math.round(pe * 100) / 100,
    pb,
    ps,
    beta: profile.beta,
    roe: Math.round(roe * 100) / 100,
    debtToEquity: Math.round(debtToEquity * 100) / 100,
    operatingCashFlow: ocf,
    freeCashFlow: fcf,
    fcfPayoutRatio: fcfPayout ? Math.round(fcfPayout * 100) / 100 : undefined,
    revenueGrowth: revenueGrowth ? Math.round(revenueGrowth * 100) / 100 : undefined,
    netIncomeGrowth: netIncomeGrowth ? Math.round(netIncomeGrowth * 100) / 100 : undefined,
    overallScore: score,
    grade,
    scoreBreakdown: breakdown,
    isREIT: stockIsREIT,
    lastUpdated: new Date().toISOString(),
  };
}
