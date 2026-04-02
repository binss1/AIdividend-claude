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

const REQUEST_DELAY_MS = 250;  // FMP 분당 300회 한도 → 초당 4회 (종목당 9 API 호출 대응)
const BATCH_DELAY_MS = 800;   // 배치 간 대기 (429 방지 여유)
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

export const fmpClient: AxiosInstance = axios.create({
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
 * Get US dividend-paying stocks via stock-screener API with pre-filtering.
 * Passes user filter criteria (minYield, minMarketCap) directly to FMP API
 * so the server returns only qualifying stocks → dramatically reduces analysis count.
 */
// In-memory cache keyed by filter params (valid 30 min)
const _dividendStocksCache = new Map<string, { data: { symbol: string; name: string }[]; fetchedAt: number }>();

export interface StockUniverseFilter {
  minDividendYield?: number;   // percentage, e.g. 2 = 2%
  minMarketCapUSD?: number;    // absolute USD, e.g. 1_000_000_000
}

export async function getAllUSDividendStocks(filter?: StockUniverseFilter): Promise<{ symbol: string; name: string }[]> {
  // Build cache key from filter params
  const yieldFilter = filter?.minDividendYield ?? 0;
  const mcapFilter = filter?.minMarketCapUSD ?? 0;
  const cacheKey = `y${yieldFilter}_m${mcapFilter}`;

  // Return cache if fresh (30 min)
  const cached = _dividendStocksCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 1800_000) {
    logger.info(`[FMP] 배당주 유니버스 캐시 반환: ${cached.data.length}개 (key: ${cacheKey}, ${Math.round((Date.now() - cached.fetchedAt) / 1000)}초 전 조회)`);
    return cached.data;
  }

  try {
    const startTime = Date.now();
    const exchanges = ['NYSE', 'NASDAQ']; // AMEX 제외: 시총$1B+ 배당 일반주식 사실상 0개 (99% ETF)

    // Build FMP API params with pre-filtering
    const apiParams: Record<string, unknown> = {
      dividendMoreThan: 0.01,  // >0.01 excludes non-dividend stocks (FMP treats 0 as "all")
      isActivelyTrading: true,
      limit: 5000,
    };
    // Note: FMP ignores dividendYieldMoreThan param, so yield filtering remains post-fetch

    // Pre-filter: market cap (FMP uses absolute value)
    if (mcapFilter > 0) {
      apiParams.marketCapMoreThan = mcapFilter;
    }

    logger.info('═══════════════════════════════════════════════════════');
    logger.info('  🌐 미국 배당주 유니버스 조회 시작 (사전 필터 적용)');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`  🔧 FMP API 사전 필터:`);
    logger.info(`     • dividendMoreThan: 0.01 (실제 배당 지급 종목만)`);
    if (mcapFilter > 0) {
      logger.info(`     • marketCapMoreThan: $${(mcapFilter / 1e9).toFixed(1)}B (시가총액 필터)`);
    }
    logger.info(`     • isActivelyTrading: true`);
    logger.info(`     ⚠️ dividendYieldMoreThan: FMP API에서 미지원 → 수익률은 사후 필터링`);

    // Parallel fetch all 3 exchanges
    const fetches = exchanges.map(async (exchange) => {
      const t0 = Date.now();
      logger.info(`  📡 ${exchange} 배당주 조회 중...`);
      const { data } = await axios.get(`${env.FMP_BASE_URL}/v3/stock-screener`, {
        params: {
          apikey: env.FMP_API_KEY,
          exchange,
          ...apiParams,
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
    if (mcapFilter > 0) {
      logger.info(`  📉 사전 필터 효과: API 레벨에서 시총 $${(mcapFilter / 1e9).toFixed(1)}B 미만 제외`);
    }
    logger.info(`  ⏱️  소요 시간: ${elapsed}초`);
    logger.info('═══════════════════════════════════════════════════════');

    // Cache result
    _dividendStocksCache.set(cacheKey, { data: deduped, fetchedAt: Date.now() });

    return deduped;
  } catch (err) {
    logger.error(`[FMP] 배당주 유니버스 조회 실패: ${(err as Error).message}`);
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
// Valuation & Analysis APIs (1단계)
// ==========================================

export async function getDCF(symbol: string): Promise<{ dcf: number; stockPrice: number; date: string } | null> {
  try {
    const { data } = await fmpClient.get(`/v3/discounted-cash-flow/${symbol}`);
    return data?.[0] ?? null;
  } catch (err) {
    logger.error(`Failed to get DCF for ${symbol}`, (err as Error).message);
    return null;
  }
}

export async function getRating(symbol: string): Promise<{
  symbol: string; date: string; rating: string; ratingScore: number;
  ratingRecommendation: string;
  ratingDetailsDCFScore: number; ratingDetailsDCFRecommendation: string;
  ratingDetailsROEScore: number; ratingDetailsROERecommendation: string;
  ratingDetailsDEScore: number; ratingDetailsDERecommendation: string;
  ratingDetailsPEScore: number; ratingDetailsPERecommendation: string;
  ratingDetailsPBScore: number; ratingDetailsPBRecommendation: string;
} | null> {
  try {
    const { data } = await fmpClient.get(`/v3/rating/${symbol}`);
    return data?.[0] ?? null;
  } catch (err) {
    logger.error(`Failed to get rating for ${symbol}`, (err as Error).message);
    return null;
  }
}

export async function getPriceTarget(symbol: string): Promise<{
  symbol: string; lastMonth: number; lastMonthAvgPriceTarget: number;
  lastQuarter: number; lastQuarterAvgPriceTarget: number;
  lastYear: number; lastYearAvgPriceTarget: number;
  allTime: number; allTimeAvgPriceTarget: number;
  publishers: string;
} | null> {
  try {
    const { data } = await fmpClient.get(`/v4/price-target-summary`, { params: { symbol } });
    return data?.[0] ?? null;
  } catch (err) {
    logger.error(`Failed to get price target for ${symbol}`, (err as Error).message);
    return null;
  }
}

export async function getStockPeers(symbol: string): Promise<string[]> {
  try {
    const { data } = await fmpClient.get(`/v4/stock_peers`, { params: { symbol } });
    return data?.[0]?.peersList ?? [];
  } catch (err) {
    logger.error(`Failed to get peers for ${symbol}`, (err as Error).message);
    return [];
  }
}

// ==========================================
// Market Insight APIs (2단계)
// ==========================================

export async function getSectorPerformance(): Promise<Array<{ sector: string; changesPercentage: string }>> {
  try {
    const { data } = await fmpClient.get('/v3/sector-performance');
    return data ?? [];
  } catch (err) {
    logger.error('Failed to get sector performance', (err as Error).message);
    return [];
  }
}

export async function getEconomicCalendar(from: string, to: string): Promise<Array<{
  event: string; date: string; country: string; actual: number | null;
  previous: number | null; change: number | null; estimate: number | null;
  impact: string;
}>> {
  try {
    const { data } = await fmpClient.get('/v3/economic_calendar', { params: { from, to } });
    return data ?? [];
  } catch (err) {
    logger.error('Failed to get economic calendar', (err as Error).message);
    return [];
  }
}

export async function getStockNews(tickers: string, limit = 10): Promise<Array<{
  symbol: string; publishedDate: string; title: string; image: string;
  site: string; text: string; url: string;
}>> {
  try {
    const { data } = await fmpClient.get('/v3/stock_news', { params: { tickers, limit } });
    return data ?? [];
  } catch (err) {
    logger.error('Failed to get stock news', (err as Error).message);
    return [];
  }
}

// ==========================================
// Scoring Enhancement APIs (3단계)
// ==========================================

export async function getFinancialGrowth(symbol: string, limit = 5): Promise<Array<{
  date: string; revenueGrowth: number; netIncomeGrowth: number;
  epsgrowth: number; freeCashFlowGrowth: number; operatingCashFlowGrowth: number;
  [key: string]: unknown;
}>> {
  try {
    const { data } = await fmpClient.get(`/v3/financial-growth/${symbol}`, { params: { limit } });
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get financial growth for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getKeyMetricsTTM(symbol: string): Promise<{
  peRatioTTM: number; pegRatioTTM: number; enterpriseValueOverEBITDATTM: number;
  pfcfRatioTTM: number; freeCashFlowYieldTTM: number;
  [key: string]: unknown;
} | null> {
  try {
    const { data } = await fmpClient.get(`/v3/key-metrics-ttm/${symbol}`);
    return data?.[0] ?? null;
  } catch (err) {
    logger.error(`Failed to get key metrics TTM for ${symbol}`, (err as Error).message);
    return null;
  }
}

// ==========================================
// Advanced APIs (4순위 - 유료 서비스 차별화)
// ==========================================

export async function getInsiderTrading(symbol: string, limit = 20): Promise<Array<{
  symbol: string; transactionDate: string; transactionType: string;
  securitiesOwned: number; securitiesTransacted: number;
  price: number; reportingName: string; typeOfOwner: string;
}>> {
  try {
    const { data } = await fmpClient.get('/v4/insider-trading', { params: { symbol, limit } });
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get insider trading for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getInstitutionalHolders(symbol: string): Promise<Array<{
  holder: string; shares: number; dateReported: string;
  change: number; weightPercent: number;
}>> {
  try {
    const { data } = await fmpClient.get(`/v3/institutional-holder/${symbol}`);
    return (data ?? []).slice(0, 15);
  } catch (err) {
    logger.error(`Failed to get institutional holders for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getSocialSentiment(symbol: string): Promise<Array<{
  date: string; symbol: string; stocktwitsPosts: number; twitterPosts: number;
  stocktwitsComments: number; twitterComments: number;
  stocktwitsSentiment: number; twitterSentiment: number;
  stocktwitsLikes: number; twitterLikes: number;
}>> {
  try {
    const { data } = await fmpClient.get('/v4/social-sentiment', { params: { symbol, limit: 30 } });
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get social sentiment for ${symbol}`, (err as Error).message);
    return [];
  }
}

export async function getAnalystEstimates(symbol: string, limit = 4): Promise<Array<{
  symbol: string; date: string; estimatedRevenueAvg: number; estimatedRevenueHigh: number;
  estimatedRevenueLow: number; estimatedEpsAvg: number; estimatedEpsHigh: number;
  estimatedEpsLow: number; numberAnalystEstimatedRevenue: number;
  numberAnalystsEstimatedEps: number;
}>> {
  try {
    const { data } = await fmpClient.get(`/v3/analyst-estimates/${symbol}`, { params: { limit, period: 'quarter' } });
    return data ?? [];
  } catch (err) {
    logger.error(`Failed to get analyst estimates for ${symbol}`, (err as Error).message);
    return [];
  }
}

// ==========================================
// ==========================================
// Market Drawdown (S&P500 기준, 상대 Drawdown용)
// ==========================================

let _marketDrawdownCache: { value: number; fetchedAt: number } | null = null;

export async function getMarketDrawdown(): Promise<number> {
  // 캐시: 1시간 유효
  if (_marketDrawdownCache && Date.now() - _marketDrawdownCache.fetchedAt < 3600_000) {
    return _marketDrawdownCache.value;
  }

  try {
    const quote = await getQuote('^GSPC'); // S&P500
    if (quote) {
      const yearHigh = (quote as unknown as { yearHigh?: number }).yearHigh;
      const price = quote.price;
      if (yearHigh && yearHigh > 0 && price > 0) {
        const dd = ((price - yearHigh) / yearHigh) * 100;
        _marketDrawdownCache = { value: dd, fetchedAt: Date.now() };
        logger.info(`[Market] S&P500 Drawdown: ${dd.toFixed(1)}% (최고: $${yearHigh.toFixed(0)}, 현재: $${price.toFixed(0)})`);
        return dd;
      }
    }
  } catch (err) {
    logger.error('Failed to get market drawdown', (err as Error).message);
  }

  return 0; // 조회 실패 시 감점 없음 (안전)
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
  // 🟡 개선: 최근 6건만 사용하여 현재 배당 주기를 정확히 감지 (과거 변경 무시)
  const gaps: number[] = [];
  const recentDivs = sorted.slice(0, Math.min(6, sorted.length));
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
  balanceSheets: FMPBalanceSheet[],
  drawdownPercent?: number, // 52주 최고 대비 하락률 (음수, e.g. -50)
  marketDrawdown?: number,  // S&P500 52주 Drawdown (음수, e.g. -15)
  financialGrowth?: Array<{ revenueGrowth: number; netIncomeGrowth: number; epsgrowth: number; freeCashFlowGrowth: number; [key: string]: unknown }>,
  keyMetricsTTM?: { pegRatioTTM: number; enterpriseValueOverEBITDATTM: number; pfcfRatioTTM: number; freeCashFlowYieldTTM: number; [key: string]: unknown } | null,
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

  // --- Growth (15%) --- Enhanced with multi-year CAGR
  let growthScore = 0;
  {
    if (financialGrowth && financialGrowth.length >= 3) {
      // Use multi-year average growth (CAGR proxy)
      const years = financialGrowth.slice(0, 5);
      const avgRevGrowth = (years.reduce((s, y) => s + (y.revenueGrowth || 0), 0) / years.length) * 100;
      const avgEpsGrowth = (years.reduce((s, y) => s + (y.epsgrowth || 0), 0) / years.length) * 100;
      const avgFcfGrowth = (years.reduce((s, y) => s + (y.freeCashFlowGrowth || 0), 0) / years.length) * 100;

      // Revenue CAGR (35 points)
      let revScore = 0;
      if (avgRevGrowth >= 15) revScore = 35;
      else if (avgRevGrowth >= 10) revScore = 30;
      else if (avgRevGrowth >= 5) revScore = 22;
      else if (avgRevGrowth >= 0) revScore = 14;
      else revScore = 4;

      // EPS CAGR (35 points)
      let epsScore = 0;
      if (avgEpsGrowth >= 20) epsScore = 35;
      else if (avgEpsGrowth >= 10) epsScore = 28;
      else if (avgEpsGrowth >= 5) epsScore = 20;
      else if (avgEpsGrowth >= 0) epsScore = 12;
      else epsScore = 4;

      // FCF growth (30 points) - NEW
      let fcfScore = 0;
      if (avgFcfGrowth >= 15) fcfScore = 30;
      else if (avgFcfGrowth >= 10) fcfScore = 24;
      else if (avgFcfGrowth >= 5) fcfScore = 18;
      else if (avgFcfGrowth >= 0) fcfScore = 10;
      else fcfScore = 3;

      growthScore = revScore + epsScore + fcfScore;
    } else if (incomeStatements.length >= 2) {
      // Fallback: single-year growth (existing logic)
      const latest = incomeStatements[0];
      const previous = incomeStatements[1];

      const revGrowth = previous.revenue > 0
        ? ((latest.revenue - previous.revenue) / previous.revenue) * 100
        : 0;
      let revScore = 0;
      if (revGrowth >= 15) revScore = 50;
      else if (revGrowth >= 10) revScore = 42;
      else if (revGrowth >= 5) revScore = 32;
      else if (revGrowth >= 0) revScore = 20;
      else revScore = 5;

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

  // --- Valuation (15%) --- Enhanced with EV/EBITDA, FCF Yield, PEG
  let valuationScore = 0;
  {
    if (keyMetricsTTM) {
      // P/E ratio (25 points)
      const pe = stock.pe ?? 0;
      let peScore = 0;
      if (pe > 0 && pe <= 15) peScore = 25;
      else if (pe > 15 && pe <= 20) peScore = 21;
      else if (pe > 20 && pe <= 25) peScore = 15;
      else if (pe > 25 && pe <= 35) peScore = 9;
      else if (pe > 35) peScore = 4;
      else peScore = 3;

      // PEG ratio (25 points) - lower is better, <1 = undervalued
      // If PEG unavailable, use P/FCF ratio instead
      const peg = keyMetricsTTM.pegRatioTTM ?? 0;
      const pfcf = keyMetricsTTM.pfcfRatioTTM ?? 0;
      let pegScore = 0;
      if (peg > 0) {
        if (peg <= 1) pegScore = 25;
        else if (peg <= 1.5) pegScore = 20;
        else if (peg <= 2) pegScore = 14;
        else if (peg <= 3) pegScore = 8;
        else pegScore = 3;
      } else if (pfcf > 0) {
        // P/FCF fallback: lower is better (<10 good)
        if (pfcf <= 10) pegScore = 25;
        else if (pfcf <= 15) pegScore = 20;
        else if (pfcf <= 20) pegScore = 14;
        else if (pfcf <= 30) pegScore = 8;
        else pegScore = 3;
      } else {
        pegScore = 12; // neutral if no data
      }

      // EV/EBITDA (25 points) - lower is better, <10 attractive
      const evEbitda = keyMetricsTTM.enterpriseValueOverEBITDATTM ?? 0;
      let evScore = 0;
      if (evEbitda > 0 && evEbitda <= 8) evScore = 25;
      else if (evEbitda > 8 && evEbitda <= 12) evScore = 20;
      else if (evEbitda > 12 && evEbitda <= 16) evScore = 14;
      else if (evEbitda > 16 && evEbitda <= 25) evScore = 8;
      else evScore = 3;

      // FCF Yield (25 points) - higher is better (use 1/pfcf if freeCashFlowYieldTTM unavailable)
      let fcfYield = (keyMetricsTTM.freeCashFlowYieldTTM ?? 0) * 100;
      if (fcfYield === 0 && pfcf > 0) fcfYield = (1 / pfcf) * 100;
      let fcfYieldScore = 0;
      if (fcfYield >= 8) fcfYieldScore = 25;
      else if (fcfYield >= 5) fcfYieldScore = 20;
      else if (fcfYield >= 3) fcfYieldScore = 14;
      else if (fcfYield >= 1) fcfYieldScore = 8;
      else fcfYieldScore = 3;

      valuationScore = peScore + pegScore + evScore + fcfYieldScore;
    } else {
      // Fallback: original P/E + P/B scoring
      const pe = stock.pe ?? 0;
      let peScore = 0;
      if (pe > 0 && pe <= 15) peScore = 50;
      else if (pe > 15 && pe <= 20) peScore = 42;
      else if (pe > 20 && pe <= 25) peScore = 30;
      else if (pe > 25 && pe <= 35) peScore = 18;
      else if (pe > 35) peScore = 8;
      else peScore = 5;

      const pb = stock.pb ?? 0;
      let pbScore = 0;
      if (pb > 0 && pb <= 1.5) pbScore = 50;
      else if (pb > 1.5 && pb <= 3) pbScore = 38;
      else if (pb > 3 && pb <= 5) pbScore = 25;
      else if (pb > 5) pbScore = 10;
      else pbScore = 5;

      valuationScore = peScore + pbScore;
    }
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

  // ═══ 감점 로직 (리스크 필터) ═══

  let penalty = 0;

  // 🔴 52주 상대 Drawdown 감점: 시장(S&P500) 대비 초과 하락분만 감점
  // 예: S&P500 -15%, 종목 -50% → 초과 하락 = -35% → -35%에서 감점
  // 시장 전반 하락은 허용하고, 개별 종목 고유 리스크만 감점
  if (drawdownPercent != null) {
    const mktDD = marketDrawdown ?? 0; // 시장 Drawdown (음수)
    const relativeDD = drawdownPercent - mktDD; // 시장 대비 초과 하락 (음수일수록 나쁨)
    const threshold = -20; // 시장 대비 -20% 초과 하락부터 감점

    if (relativeDD < threshold) {
      const ddPenalty = Math.min(15, Math.abs(relativeDD - threshold) * 0.3); // 최대 -15점
      penalty += ddPenalty;
      stabilityScore = Math.max(0, stabilityScore - ddPenalty * 1.5); // 안정성 감점
    }
  }

  // 🔴 비정상 고배당률 감점: 수익률 > 12% 시 배당 점수 감점 (주가 폭락으로 인한 거품)
  const yld = stock.dividendYield ?? 0;
  if (yld > 12) {
    const yieldPenalty = Math.min(15, (yld - 12) * 1.5); // 12% 초과분 × 1.5, 최대 -15점
    penalty += yieldPenalty;
    dividendScore = Math.max(0, dividendScore - yieldPenalty * 2);
  }

  // 🔴 극단적 저PER 밸류트랩 감점: PER < 3 시 가치 점수 제한
  const pe = stock.pe ?? 0;
  if (pe > 0 && pe < 3) {
    valuationScore = Math.min(valuationScore, 60); // 가치 최대 60점으로 제한
    penalty += 5;
  }

  const adjustedScore = score - penalty;
  const clampedScore = Math.max(0, Math.min(100, adjustedScore));

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
): Promise<{ results: ScreenedStock[]; skipSummary: Record<string, number> }> {
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
    // Full mode: all US dividend-paying stocks WITH pre-filtering
    logger.info('  🔍 종목 유니버스 수집 중 (전체 미국 배당주 + 사전 필터)...');
    const preFilter: StockUniverseFilter = {
      minMarketCapUSD: criteria.minMarketCapUSD,
    };
    logger.info(`  🔧 사전 필터 전달: 시총≥$${(criteria.minMarketCapUSD / 1e9).toFixed(1)}B`);

    const allStocks = await getAllUSDividendStocks(preFilter);
    allSymbols = allStocks.map(s => s.symbol);
    screeningOrder = `NYSE+NASDAQ 배당주 (시총≥$${(criteria.minMarketCapUSD / 1e9).toFixed(1)}B 사전필터) → ${allSymbols.length}개`;

    logger.info(`  📈 유니버스 구성 (전체 + 사전필터 모드):`);
    logger.info(`     • 사전 필터 적용 후: ${allSymbols.length}개`);
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

  // Get market (S&P500) drawdown for relative comparison
  const mktDrawdown = await getMarketDrawdown();
  logger.info(`  📉 시장 Drawdown (S&P500): ${mktDrawdown.toFixed(1)}% (상대 감점 기준)`);
  logger.info('───────────────────────────────────────────────────────');

  // Step 2: Batch process with ETA tracking
  const batchSize = criteria.batchSize || 10;
  const skipReasons: Record<string, number> = {}; // 탈락 사유 집계
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
        const result = await analyzeStock(symbol, criteria, krwRate, mktDrawdown);
        if (result.stock) {
          results.push(result.stock);
          logger.info(`  ✅ [${processedCount}/${universe.length}] ${symbol.padEnd(6)} | 수익률: ${result.stock.dividendYield.toFixed(2)}% | 성향: ${result.stock.payoutRatio.toFixed(1)}% | 점수: ${result.stock.overallScore} (${result.stock.grade}) | ${result.stock.sector}`);
        } else {
          skippedCount++;
          const reason = result.skipReason || '기타';
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          logger.info(`  ⏭️  [${processedCount}/${universe.length}] ${symbol.padEnd(6)} | ${reason}`);
        }
      } catch (err) {
        skippedCount++;
        skipReasons['오류'] = (skipReasons['오류'] || 0) + 1;
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
  if (Object.keys(skipReasons).length > 0) {
    logger.info('     • 탈락 사유:');
    Object.entries(skipReasons).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
      logger.info(`       - ${reason}: ${count}건`);
    });
  }
  if (results.length > 0) {
    logger.info(`     • 최고점수: ${results[0].symbol} (${results[0].overallScore}점, ${results[0].grade})`);
    logger.info(`     • 최고수익률: ${results.reduce((max, s) => s.dividendYield > max.dividendYield ? s : max).symbol} (${results.reduce((max, s) => s.dividendYield > max.dividendYield ? s : max).dividendYield.toFixed(2)}%)`);
  }
  logger.info('═══════════════════════════════════════════════════════');

  return { results, skipSummary: skipReasons };
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
  krwRate: number,
  marketDrawdown?: number
): Promise<{ stock: ScreenedStock; skipReason?: undefined } | { stock?: undefined; skipReason: string }> {
  // Get profile first for quick filtering
  const profile = await getCompanyProfile(symbol);
  if (!profile) { logger.info(`    [${symbol}] SKIP: 프로필 없음`); return { skipReason: '프로필 없음' }; }

  if (!profile.isActivelyTrading) { logger.info(`    [${symbol}] SKIP: 비활성 종목`); return { skipReason: '비활성 종목' }; }

  const exchange = (profile.exchangeShortName || '').toUpperCase();
  if (exchange !== 'NYSE' && exchange !== 'NASDAQ') { logger.info(`    [${symbol}] SKIP: 거래소 ${exchange}`); return { skipReason: '거래소 불일치' }; }

  if (profile.isEtf) { logger.info(`    [${symbol}] SKIP: ETF`); return { skipReason: 'ETF 제외' }; }

  // 🔴 외국 기업(ADR) 제외 — 미국 기업만 허용
  const country = (profile.country || '').toUpperCase();
  if (country && country !== 'US') { logger.info(`    [${symbol}] SKIP: 외국기업 (${profile.country})`); return { skipReason: `외국기업 (${profile.country})` }; }

  if (profile.mktCap < criteria.minMarketCapUSD) { logger.info(`    [${symbol}] SKIP: 시총 미달`); return { skipReason: '시가총액 미달' }; }

  const quote = await getQuote(symbol);
  if (!quote) { logger.info(`    [${symbol}] SKIP: 시세 없음`); return { skipReason: '시세 없음' }; }

  const dividends = await getDividendHistory(symbol);
  if (dividends.length === 0) { logger.info(`    [${symbol}] SKIP: 배당이력 없음`); return { skipReason: '배당이력 없음' }; }

  if (!checkDividendConsistency(dividends)) { logger.info(`    [${symbol}] SKIP: 배당 일관성 미달`); return { skipReason: '배당 일관성 미달' }; }

  const cycle = determineDividendCycle(dividends);
  const annualDividend = calculateAnnualDividend(cycle, dividends);
  if (annualDividend <= 0) { logger.info(`    [${symbol}] SKIP: 연간배당 ≤0`); return { skipReason: '연간배당 없음' }; }

  const price = quote.price || profile.price;
  if (!price || price <= 0) { logger.info(`    [${symbol}] SKIP: 주가 없음`); return { skipReason: '주가 없음' }; }
  const dividendYield = (annualDividend / price) * 100;

  if (dividendYield < criteria.minDividendYield) { logger.info(`    [${symbol}] SKIP: 수익률 ${dividendYield.toFixed(2)}% < ${criteria.minDividendYield}%`); return { skipReason: '수익률 미달' }; }

  // Detect REIT
  const stockIsREIT = isREIT(symbol, profile.sector, profile.industry);

  // Get financial data (including enhanced scoring data)
  const [incomeStatements, balanceSheets, cashFlows, ratios, finGrowth, keyMetrics] = await Promise.all([
    getIncomeStatements(symbol, 5),
    getBalanceSheet(symbol),
    getCashFlowStatements(symbol),
    getFinancialRatios(symbol),
    getFinancialGrowth(symbol, 5),
    getKeyMetricsTTM(symbol),
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
    logger.debug(`${symbol}: rejected - unprofitable`);
    return { skipReason: '적자 기업' };
  }

  // Payout ratio filter
  const payoutRatio = payoutResult.ratio;
  const maxPayout = criteria.maxPayoutRatio || 85;
  if (stockIsREIT) {
    if (payoutRatio < 10 || payoutRatio > 100) return { skipReason: '배당성향 범위 초과 (REIT)' };
  } else {
    if (payoutRatio < 10 || payoutRatio > maxPayout) return { skipReason: '배당성향 초과' };
  }

  // Calculate additional metrics
  const consecutiveYears = countConsecutiveDividendYears(dividends);
  const consistencyScore = calculateConsistencyScore(dividends);

  // Financial ratios
  const latestRatios = ratios.length > 0 ? ratios[0] : null;

  // ROE: try TTM ratio first, then annual, then calculate from statements
  // Note: FMP returns ROE as decimal (0.19 = 19%), except for negative equity stocks
  // where values can be extremely high/misleading. Cap at ±200% and null out negative equity cases.
  let roe = 0;
  const hasNegativeEquity = balanceSheets.length > 0 && balanceSheets[0].totalStockholdersEquity < 0;

  if (hasNegativeEquity) {
    // Negative equity (e.g. HPQ from heavy buybacks) → ROE is meaningless
    roe = 0; // Will display as N/A in frontend
  } else if (latestRatios?.returnOnEquityTTM != null && latestRatios.returnOnEquityTTM !== 0) {
    roe = latestRatios.returnOnEquityTTM * 100;
  } else if (latestRatios?.returnOnEquity != null && latestRatios.returnOnEquity !== 0) {
    roe = latestRatios.returnOnEquity * 100;
  } else if (incomeStatements.length > 0 && balanceSheets.length > 0) {
    const ni = incomeStatements[0].netIncome;
    const equity = balanceSheets[0].totalStockholdersEquity;
    if (equity > 0 && ni !== 0) {
      roe = (ni / equity) * 100;
    }
  }
  // Sanity check: ROE beyond ±200% is likely from distorted equity, treat as unreliable
  if (Math.abs(roe) > 200) {
    roe = 0;
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

  // 52주 Drawdown 계산 (quote.yearHigh 활용, 추가 API 호출 없음)
  const yearHigh = (quote as unknown as { yearHigh?: number }).yearHigh;
  const drawdownPercent = yearHigh && yearHigh > 0 && price > 0
    ? ((price - yearHigh) / yearHigh) * 100
    : undefined;

  // Calculate score (enhanced with financial growth + key metrics + risk penalties)
  const { score, grade, breakdown } = calculateStockScore(
    partialStock, incomeStatements, cashFlows, balanceSheets,
    drawdownPercent,
    marketDrawdown,
    finGrowth.length > 0 ? finGrowth : undefined,
    keyMetrics,
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

  return { stock: screenedStock };
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

  // ROE: try TTM ratio, then annual, then calculate from statements
  // Negative equity (heavy buybacks) → ROE is meaningless → treat as N/A
  let roe = 0;
  const hasNegativeEquity = balanceSheets.length > 0 && balanceSheets[0].totalStockholdersEquity < 0;

  if (hasNegativeEquity) {
    roe = 0; // Will display as N/A in frontend
    logger.debug(`${symbol} ROE: N/A (negative equity: ${(balanceSheets[0].totalStockholdersEquity/1e9).toFixed(2)}B from buybacks)`);
  } else if (latestRatios?.returnOnEquityTTM != null && latestRatios.returnOnEquityTTM !== 0) {
    roe = latestRatios.returnOnEquityTTM * 100;
    logger.debug(`${symbol} ROE from TTM ratio: ${roe.toFixed(1)}%`);
  } else if (latestRatios?.returnOnEquity != null && latestRatios.returnOnEquity !== 0) {
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
  if (Math.abs(roe) > 200) {
    logger.warn(`${symbol} ROE ${roe.toFixed(1)}% exceeds ±200%, treating as unreliable → N/A`);
    roe = 0;
  }
  if (roe === 0 && !hasNegativeEquity) {
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
