import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';
import {
  ETFScreeningCriteria,
  ScreenedETF,
  ETFScreeningProgress,
} from '../types/index';

const POPULAR_DIVIDEND_ETFS = [
  'VYM', 'SCHD', 'HDV', 'DVY', 'SDY', 'SPYD', 'VIG', 'DGRO', 'NOBL', 'DIVO',
  'JEPI', 'JEPQ', 'SPHD', 'FDL', 'DHS', 'CDC', 'PEY', 'RDIV', 'SDOG', 'DIV',
  'KNG', 'NUSI', 'PFFD', 'QDIV', 'GCOW', 'FDVV', 'XSLV', 'KBWD', 'SDIV', 'WDIV',
  'IDV', 'DWX', 'VYMI', 'FNDE', 'PFF', 'VNQ', 'XLRE', 'REM', 'MORT', 'KBWY',
];

const REQUEST_DELAY_MS = 300;
const BATCH_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fmpGet<T>(path: string, params?: Record<string, any>): Promise<T | null> {
  try {
    const { data } = await axios.get<T>(`${env.FMP_BASE_URL}${path}`, {
      params: { ...params, apikey: env.FMP_API_KEY },
      timeout: 15000,
    });
    return data;
  } catch (err) {
    logger.error(`FMP ETF request failed: ${path}`, (err as Error).message);
    return null;
  }
}

// ==========================================
// ETF List
// ==========================================

interface FMPETFListItem {
  symbol: string;
  name: string;
  price: number;
  exchange: string;
  exchangeShortName: string;
}

export async function getETFList(): Promise<FMPETFListItem[]> {
  const data = await fmpGet<FMPETFListItem[]>('/v3/etf/list');
  if (!data) return [];

  // Filter US-listed ETFs
  return data.filter(etf => {
    const ex = (etf.exchangeShortName || '').toUpperCase();
    return ex === 'NYSE' || ex === 'NASDAQ' || ex === 'AMEX' || ex === 'NYSEArca' ||
      (etf.exchange || '').toUpperCase().includes('ARCA') ||
      (etf.exchange || '').toUpperCase().includes('BATS');
  });
}

// ==========================================
// ETF Profile / Holdings
// ==========================================

interface FMPETFHolding {
  asset: string;
  name: string;
  weightPercentage: number;
}

interface FMPETFProfile {
  symbol: string;
  companyName: string;
  price: number;
  mktCap: number;
  lastDiv: number;
  beta: number;
  isActivelyTrading: boolean;
  isEtf: boolean;
  sector?: string;
  industry?: string;
}

interface FMPETFInfo {
  symbol: string;
  expenseRatio?: number;
  aum?: number;
  avgVolume?: number;
  holdingsCount?: number;
  inceptionDate?: string;
  domicile?: string;
  etfCompany?: string;
}

async function getETFProfile(symbol: string): Promise<FMPETFProfile | null> {
  const data = await fmpGet<FMPETFProfile[]>(`/v3/profile/${symbol}`);
  return data?.[0] ?? null;
}

async function getETFHoldings(symbol: string): Promise<FMPETFHolding[]> {
  const data = await fmpGet<FMPETFHolding[]>(`/v3/etf-holder/${symbol}`);
  return data ?? [];
}

async function getETFInfo(symbol: string): Promise<FMPETFInfo | null> {
  // Try the ETF info endpoint
  const data = await fmpGet<FMPETFInfo[]>(`/v4/etf-info`, { symbol });
  return data?.[0] ?? null;
}

// ==========================================
// Q-LEAD Scoring
// ==========================================

interface QLEADScores {
  qualityScore: number;
  qualityGrade: string;
  liquidityScore: number;
  liquidityGrade: string;
  exposureScore: number;
  exposureGrade: string;
  dividendScore: number;
  dividendGrade: string;
  totalScore: number;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B+';
  if (score >= 45) return 'B';
  if (score >= 30) return 'C';
  return 'D';
}

function calculateQLEAD(
  expenseRatio: number,     // decimal (e.g., 0.005 = 0.5%)
  aum: number,              // USD
  holdings: FMPETFHolding[],
  dividendYield: number,    // decimal
  dividendGrowth5Y?: number // decimal
): QLEADScores {
  // --- Quality (25%): Expense ratio grading ---
  let qualityScore = 0;
  if (expenseRatio <= 0.001) qualityScore = 100;      // <= 0.10%
  else if (expenseRatio <= 0.0025) qualityScore = 85;  // <= 0.25%
  else if (expenseRatio <= 0.005) qualityScore = 65;   // <= 0.50%
  else if (expenseRatio <= 0.01) qualityScore = 40;    // <= 1.00%
  else qualityScore = 20;                              // > 1.00%

  // --- Liquidity (25%): AUM grading ---
  let liquidityScore = 0;
  if (aum >= 10_000_000_000) liquidityScore = 100;      // >= $10B
  else if (aum >= 5_000_000_000) liquidityScore = 85;   // >= $5B
  else if (aum >= 1_000_000_000) liquidityScore = 65;   // >= $1B
  else if (aum >= 500_000_000) liquidityScore = 40;     // >= $500M
  else liquidityScore = 20;

  // --- Exposure (25%): Holdings diversification ---
  let exposureScore = 0;
  {
    // Holdings count factor
    const count = holdings.length;
    let countScore = 0;
    if (count >= 200) countScore = 40;
    else if (count >= 100) countScore = 35;
    else if (count >= 50) countScore = 28;
    else if (count >= 20) countScore = 18;
    else countScore = 8;

    // Concentration factor (top 10 weight)
    const top10 = holdings
      .sort((a, b) => (b.weightPercentage || 0) - (a.weightPercentage || 0))
      .slice(0, 10);
    const top10Weight = top10.reduce((sum, h) => sum + (h.weightPercentage || 0), 0);

    let concScore = 0;
    if (top10Weight <= 20) concScore = 40;
    else if (top10Weight <= 30) concScore = 35;
    else if (top10Weight <= 40) concScore = 28;
    else if (top10Weight <= 50) concScore = 20;
    else if (top10Weight <= 70) concScore = 12;
    else concScore = 5;

    // Sector diversity bonus
    const sectors = new Set(holdings.map(h => h.name?.split(' ')[0] || 'unknown'));
    const diversityBonus = Math.min(sectors.size / 10, 1) * 20;

    exposureScore = Math.min(100, countScore + concScore + diversityBonus);
  }

  // --- Dividend (25%): Yield + growth ---
  let dividendScoreVal = 0;
  {
    // Yield grade
    const yldPct = dividendYield * 100;
    let yieldScore = 0;
    if (yldPct >= 5) yieldScore = 50;
    else if (yldPct >= 4) yieldScore = 45;
    else if (yldPct >= 3) yieldScore = 38;
    else if (yldPct >= 2) yieldScore = 28;
    else if (yldPct >= 1) yieldScore = 18;
    else yieldScore = 5;

    // 5-year growth grade
    let growthScore = 25; // default neutral
    if (dividendGrowth5Y !== undefined) {
      const g = dividendGrowth5Y * 100;
      if (g >= 10) growthScore = 50;
      else if (g >= 7) growthScore = 42;
      else if (g >= 5) growthScore = 35;
      else if (g >= 3) growthScore = 25;
      else if (g >= 0) growthScore = 15;
      else growthScore = 5;
    }

    dividendScoreVal = Math.min(100, yieldScore + growthScore);
  }

  const totalScore = Math.round(
    qualityScore * 0.25 +
    liquidityScore * 0.25 +
    exposureScore * 0.25 +
    dividendScoreVal * 0.25
  );

  return {
    qualityScore: Math.round(qualityScore),
    qualityGrade: gradeFromScore(qualityScore),
    liquidityScore: Math.round(liquidityScore),
    liquidityGrade: gradeFromScore(liquidityScore),
    exposureScore: Math.round(exposureScore),
    exposureGrade: gradeFromScore(exposureScore),
    dividendScore: Math.round(dividendScoreVal),
    dividendGrade: gradeFromScore(dividendScoreVal),
    totalScore: Math.min(100, totalScore),
  };
}

// ==========================================
// ETF Screening
// ==========================================

export async function screenDividendETFs(
  criteria: ETFScreeningCriteria,
  progressCallback?: (progress: ETFScreeningProgress) => void
): Promise<ScreenedETF[]> {
  const results: ScreenedETF[] = [];

  logger.info('═══════════════════════════════════════════════════════');
  logger.info('  📊 ETF 스크리닝 시작');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  📋 필터 조건 (원본):`);
  logger.info(`     • minDividendYield: ${criteria.minDividendYield} (decimal)`);
  logger.info(`     • minAUM: $${(criteria.minAUM / 1e6).toFixed(0)}M`);
  logger.info(`     • maxExpenseRatio: ${criteria.maxExpenseRatio} (decimal)`);
  logger.info(`     • maxETFsToCheck: ${criteria.maxETFsToCheck}`);
  logger.info('───────────────────────────────────────────────────────');

  // Build candidate list: popular ETFs first, then broader list
  const popularSymbols = new Set(POPULAR_DIVIDEND_ETFS);
  let allETFs: { symbol: string; name: string }[] = [];

  // Add popular ETFs first
  for (const sym of POPULAR_DIVIDEND_ETFS) {
    allETFs.push({ symbol: sym, name: sym });
  }

  // Then get broader ETF list
  try {
    const etfList = await getETFList();
    for (const etf of etfList) {
      if (!popularSymbols.has(etf.symbol)) {
        allETFs.push({ symbol: etf.symbol, name: etf.name });
      }
    }
  } catch (err) {
    logger.warn('Failed to get full ETF list, using popular ETFs only');
  }

  const maxToCheck = criteria.maxETFsToCheck || 200;
  allETFs = allETFs.slice(0, maxToCheck);

  logger.info(`ETF universe: ${allETFs.length} (popular: ${POPULAR_DIVIDEND_ETFS.length})`);

  let processedCount = 0;
  const batchSize = 10;

  for (let batchStart = 0; batchStart < allETFs.length; batchStart += batchSize) {
    const batch = allETFs.slice(batchStart, batchStart + batchSize);

    for (const etfItem of batch) {
      processedCount++;
      const { symbol } = etfItem;

      try {
        const etf = await analyzeETF(symbol, criteria);
        if (etf) {
          results.push(etf);
        }
      } catch (err) {
        logger.error(`  ❌ [${processedCount}/${allETFs.length}] ${symbol} ERROR: ${(err as Error).message}`);
      }

      if (progressCallback) {
        progressCallback({
          status: 'running',
          processedETFs: processedCount,
          totalETFs: allETFs.length,
          foundETFs: results.length,
          progress: Math.round((processedCount / allETFs.length) * 100),
          currentSymbol: symbol,
        });
      }

      await delay(REQUEST_DELAY_MS);
    }

    if (batchStart + batchSize < allETFs.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  // Sort by criteria
  const sortBy = criteria.sortBy || 'totalScore';
  results.sort((a, b) => {
    if (sortBy === 'dividendYield') return b.dividendYield - a.dividendYield;
    if (sortBy === 'aum') return b.aum - a.aum;
    return b.totalScore - a.totalScore;
  });

  const limit = criteria.limit || 50;
  const finalResults = results.slice(0, limit);

  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  🏁 ETF 스크리닝 완료`);
  logger.info(`     • 총 분석: ${processedCount}개`);
  logger.info(`     • 통과: ${results.length}개`);
  logger.info(`     • 최종 반환: ${finalResults.length}개 (limit: ${limit})`);
  if (finalResults.length > 0) {
    logger.info(`     • 최고점수: ${finalResults[0].symbol} (Q-LEAD: ${finalResults[0].totalScore})`);
  }
  logger.info('═══════════════════════════════════════════════════════');

  return finalResults;
}

async function analyzeETF(
  symbol: string,
  criteria: ETFScreeningCriteria
): Promise<ScreenedETF | null> {
  const profile = await getETFProfile(symbol);
  if (!profile) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 프로필 없음`);
    return null;
  }

  if (!profile.isActivelyTrading) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 비활성 종목`);
    return null;
  }

  const price = profile.price;
  if (!price || price <= 0) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 가격 없음`);
    return null;
  }

  // Try to get ETF-specific info (expense ratio, AUM)
  const etfInfo = await getETFInfo(symbol);

  // FMP API returns expenseRatio as percentage value (0.06 means 0.06%)
  // We store it as-is (percentage) and convert criteria to match
  const expenseRatioRaw = etfInfo?.expenseRatio ?? 0;
  // Convert to decimal for internal use: 0.06% → 0.0006
  const expenseRatioDecimal = expenseRatioRaw / 100;
  const aum = etfInfo?.aum ?? profile.mktCap ?? 0;

  // Dividend yield (decimal: 0.04 = 4%)
  const annualDiv = profile.lastDiv || 0;
  const dividendYield = price > 0 ? annualDiv / price : 0;

  // Apply filters - criteria values are in decimal form
  // minDividendYield: 0.005 = 0.5%
  // maxExpenseRatio: 0.0095 = 0.95%
  if (dividendYield < criteria.minDividendYield) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 배당수익률 미달 (${(dividendYield * 100).toFixed(2)}% < ${(criteria.minDividendYield * 100).toFixed(2)}%)`);
    return null;
  }
  if (aum < criteria.minAUM) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | AUM 미달 ($${(aum / 1e9).toFixed(2)}B < $${(criteria.minAUM / 1e9).toFixed(2)}B)`);
    return null;
  }
  if (criteria.maxExpenseRatio > 0 && expenseRatioDecimal > criteria.maxExpenseRatio) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 운용보수 초과 (${(expenseRatioDecimal * 100).toFixed(2)}% > ${(criteria.maxExpenseRatio * 100).toFixed(2)}%)`);
    return null;
  }

  // Get holdings for exposure analysis
  const holdings = await getETFHoldings(symbol);

  // Top 10 concentration
  const sortedHoldings = [...holdings].sort((a, b) => (b.weightPercentage || 0) - (a.weightPercentage || 0));
  const top10Concentration = sortedHoldings.slice(0, 10).reduce((sum, h) => sum + (h.weightPercentage || 0), 0);

  // Calculate Q-LEAD scores (expects decimal format)
  const qlead = calculateQLEAD(expenseRatioDecimal, aum, holdings, dividendYield);

  logger.info(`  ✅ ${symbol.padEnd(6)} | 수익률: ${(dividendYield * 100).toFixed(2)}% | 보수: ${(expenseRatioDecimal * 100).toFixed(3)}% | AUM: $${(aum / 1e9).toFixed(1)}B | Q-LEAD: ${qlead.totalScore}`);

  return {
    symbol,
    name: profile.companyName || symbol,
    price,
    aum,
    expenseRatio: expenseRatioDecimal,  // Store as decimal for frontend consistency
    dividendYield,                       // decimal (0.04 = 4%)
    qualityScore: qlead.qualityScore,
    liquidityScore: qlead.liquidityScore,
    exposureScore: qlead.exposureScore,
    dividendScore: qlead.dividendScore,
    totalScore: qlead.totalScore,
    qualityGrade: qlead.qualityGrade,
    liquidityGrade: qlead.liquidityGrade,
    exposureGrade: qlead.exposureGrade,
    dividendGrade: qlead.dividendGrade,
    holdingsCount: holdings.length || etfInfo?.holdingsCount,
    top10Concentration: Math.round(top10Concentration * 100) / 100,
    beta: profile.beta,
    lastUpdated: new Date().toISOString(),
  };
}

// ==========================================
// ETF Detail (single ETF, no filtering)
// ==========================================

export async function getETFDetail(symbol: string): Promise<ScreenedETF | null> {
  const profile = await getETFProfile(symbol);
  if (!profile) return null;

  const price = profile.price;
  if (!price || price <= 0) return null;

  const etfInfo = await getETFInfo(symbol);

  const expenseRatioRaw = etfInfo?.expenseRatio ?? 0;
  const expenseRatioDecimal = expenseRatioRaw / 100;
  const aum = etfInfo?.aum ?? profile.mktCap ?? 0;

  const annualDiv = profile.lastDiv || 0;
  const dividendYield = price > 0 ? annualDiv / price : 0;

  const holdings = await getETFHoldings(symbol);

  const sortedHoldings = [...holdings].sort((a, b) => (b.weightPercentage || 0) - (a.weightPercentage || 0));
  const top10Concentration = sortedHoldings.slice(0, 10).reduce((sum, h) => sum + (h.weightPercentage || 0), 0);

  const qlead = calculateQLEAD(expenseRatioDecimal, aum, holdings, dividendYield);

  return {
    symbol,
    name: profile.companyName || symbol,
    price,
    aum,
    expenseRatio: expenseRatioDecimal,
    dividendYield,
    qualityScore: qlead.qualityScore,
    liquidityScore: qlead.liquidityScore,
    exposureScore: qlead.exposureScore,
    dividendScore: qlead.dividendScore,
    totalScore: qlead.totalScore,
    qualityGrade: qlead.qualityGrade,
    liquidityGrade: qlead.liquidityGrade,
    exposureGrade: qlead.exposureGrade,
    dividendGrade: qlead.dividendGrade,
    holdingsCount: holdings.length || etfInfo?.holdingsCount,
    top10Concentration: Math.round(top10Concentration * 100) / 100,
    beta: profile.beta,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getETFHoldingsData(symbol: string): Promise<FMPETFHolding[]> {
  return getETFHoldings(symbol);
}
