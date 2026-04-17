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

// Known covered call ETFs by ticker
const COVERED_CALL_TICKERS = new Set([
  'JEPI', 'JEPQ', 'XYLD', 'QYLD', 'RYLD', 'DIVO', 'NUSI', 'KNG',
  'HNDL', 'DJIA', 'FTHI', 'SPYI', 'QQQI', 'IWMI', 'GPIQ', 'GPIX',
  'ISPY', 'QQQY', 'XDTE', 'OARK', 'TSLY', 'NVDY', 'CONY', 'MSFO',
  'AMZY', 'APLY', 'FBY', 'GOOY', 'BALI', 'YMAX', 'YMAG',
]);

// Covered call detection keywords in ETF name
const COVERED_CALL_KEYWORDS = [
  'covered call', 'buy-write', 'buywrite', 'option income',
  'premium income', 'option overlay', 'call writing',
  'option strategy', 'equity premium',
];

function isCoveredCallETF(symbol: string, name: string): boolean {
  if (COVERED_CALL_TICKERS.has(symbol.toUpperCase())) return true;
  const lower = name.toLowerCase();
  return COVERED_CALL_KEYWORDS.some(kw => lower.includes(kw));
}

// ==========================================
// Non-Dividend ETF Exclusion
// ==========================================

// ──────────────────────────────────────────────
// 비배당 ETF 필터: API assetClass 기반 (1차) + description 보조 (2차)
// ──────────────────────────────────────────────
// 설계 원칙:
//   1차: FMP etf-info.assetClass 필드로 판별 (가장 신뢰)
//   2차: assetClass가 Equity인 레버리지/인버스는 description으로 보조 판별
//   3차: 위 모두 불가 시에만 알려진 티커 목록으로 판별 (최소한만 유지)
//   → 종목명 키워드 매칭은 사용하지 않음 (false positive 위험)
// ──────────────────────────────────────────────

// assetClass 값 중 비배당 ETF에 해당하는 것
const EXCLUDED_ASSET_CLASSES = new Set([
  'commodities',
  'alternatives',
]);

// description에서 레버리지/인버스를 탐지하는 패턴
// (FMP가 이들을 assetClass="Equity"로 분류하므로 추가 판별 필요)
const LEVERAGED_INVERSE_DESC_PATTERNS: RegExp[] = [
  /\b(?:two|three|2|3)\s*(?:times|x)\b/i,       // "three times", "2x", "3x"
  /\b[23]00%\b/,                                  // "300%", "200%"
  /\bdaily\s+investment\s+results\b/i,            // 레버리지/인버스 ETF 공통 문구
  /\b(?:ultra(?:pro|short)?|direxion\s+daily)\b/i, // ProShares Ultra*, Direxion Daily
];

// 최소한의 알려진 비배당 티커 (assetClass 미분류 대비 안전장치)
const NON_DIVIDEND_TICKERS_FALLBACK = new Set([
  // assetClass가 부정확할 수 있는 원자재
  'GLD', 'IAU', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT', 'SOYB',
  // VIX/Volatility
  'VXX', 'VIXY', 'UVXY', 'SVXY', 'SVOL',
]);

function isNonDividendETF(
  symbol: string,
  _name: string,  // 더 이상 종목명 매칭에 사용하지 않음
  assetClass?: string,
  description?: string
): boolean {
  // 1차: assetClass 기반 (가장 신뢰)
  if (assetClass) {
    const ac = assetClass.toLowerCase().trim();
    if (EXCLUDED_ASSET_CLASSES.has(ac)) return true;
  }

  // 2차: description 기반 레버리지/인버스 탐지
  if (description) {
    if (LEVERAGED_INVERSE_DESC_PATTERNS.some(p => p.test(description))) return true;
  }

  // 3차: 알려진 티커 안전장치 (assetClass 미분류 대비)
  if (NON_DIVIDEND_TICKERS_FALLBACK.has(symbol.toUpperCase())) return true;

  return false;
}

// ==========================================
// ETF Asset Type Classification
// ==========================================

type ETFAssetType = 'equity' | 'bond' | 'preferred' | 'covered_call' | 'reit' | 'mixed';

function classifyETFAssetType(symbol: string, name: string, assetClass?: string): ETFAssetType {
  // 1. 커버드콜은 항상 최우선 (이름/티커 기반 — 알려진 목록)
  if (isCoveredCallETF(symbol, name)) return 'covered_call';

  // 2. FMP assetClass 기반 분류 (가장 신뢰)
  if (assetClass) {
    const ac = assetClass.toLowerCase();
    if (ac.includes('real estate') || ac.includes('reit')) return 'reit';
    if (ac.includes('fixed income')) return 'bond';
  }

  // 3. 종목명 보조 분류 (assetClass로 구분 불가한 경우만)
  const lower = (name || '').toLowerCase();
  if (/\bpreferred\b|\bpfd\b/i.test(lower)) return 'preferred';
  if (/\bbond\b|\bhigh yield\b|\btreasury\b|\bcorporate\b|\bmortgage\b|\bmbs\b|\bfallen angel\b|\bfloating rate\b/i.test(lower)) return 'bond';

  // 4. assetClass에 Equity 포함 시 주식형
  if (assetClass) {
    const ac = assetClass.toLowerCase();
    if (ac.includes('equity')) return 'equity';
  }

  return 'mixed';
}

const REQUEST_DELAY_MS = 200;  // 종목 간 대기 (배당주 250ms보다 짧게 — ETF는 종목당 호출 수가 적음)
const BATCH_DELAY_MS = 500;    // 배치 간 대기 (배당주 800ms와 유사)

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

export interface ETFUniverseFilter {
  minAUM?: number;  // absolute USD, e.g. 100_000_000
}

// In-memory cache keyed by filter params (valid 30 min)
const _etfListCache = new Map<string, { data: FMPETFListItem[]; fetchedAt: number }>();

export async function getETFList(filter?: ETFUniverseFilter): Promise<FMPETFListItem[]> {
  const aumFilter = filter?.minAUM ?? 0;
  const cacheKey = `aum${aumFilter}`;

  const cached = _etfListCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 1800_000) {
    logger.info(`[ETF] 유니버스 캐시 반환: ${cached.data.length}개 (key: ${cacheKey})`);
    return cached.data;
  }

  // Use stock-screener with isEtf=true for pre-filtering
  if (aumFilter > 0) {
    logger.info(`[ETF] 사전 필터 적용: FMP stock-screener (isEtf=true, marketCap≥$${(aumFilter / 1e6).toFixed(0)}M, dividend>0)`);

    const exchanges = ['NYSE', 'NASDAQ', 'AMEX'];
    const allETFs: FMPETFListItem[] = [];
    const seen = new Set<string>();

    for (const exchange of exchanges) {
      try {
        const data = await fmpGet<any[]>('/v3/stock-screener', {
          exchange,
          isEtf: true,
          isActivelyTrading: true,
          dividendMoreThan: 0,
          marketCapMoreThan: aumFilter,
          limit: 5000,
        });
        if (data) {
          for (const item of data) {
            if (!seen.has(item.symbol)) {
              seen.add(item.symbol);
              allETFs.push({
                symbol: item.symbol,
                name: item.companyName || item.symbol,
                price: item.price || 0,
                exchange: exchange,
                exchangeShortName: exchange,
              });
            }
          }
        }
        logger.info(`  ✅ ${exchange} ETF (사전필터): ${data?.length ?? 0}개`);
      } catch (err) {
        logger.error(`  ❌ ${exchange} ETF 조회 실패: ${(err as Error).message}`);
      }
    }

    logger.info(`[ETF] 사전 필터 결과: ${allETFs.length}개 (AUM≥$${(aumFilter / 1e6).toFixed(0)}M + 배당지급)`);
    _etfListCache.set(cacheKey, { data: allETFs, fetchedAt: Date.now() });
    return allETFs;
  }

  // No filter: use original /v3/etf/list
  const data = await fmpGet<FMPETFListItem[]>('/v3/etf/list');
  if (!data) return [];

  const filtered = data.filter(etf => {
    const ex = (etf.exchangeShortName || '').toUpperCase();
    return ex === 'NYSE' || ex === 'NASDAQ' || ex === 'AMEX' || ex === 'NYSEArca' ||
      (etf.exchange || '').toUpperCase().includes('ARCA') ||
      (etf.exchange || '').toUpperCase().includes('BATS');
  });

  _etfListCache.set(cacheKey, { data: filtered, fetchedAt: Date.now() });
  return filtered;
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
  assetClass?: string;      // "Equity", "Fixed Income", "Commodities", "Alternatives", etc.
  description?: string;     // ETF description text
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
): Promise<{ results: ScreenedETF[]; skipSummary: Record<string, number> }> {
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

  // Build candidate list with pre-filtering via FMP API
  const minAUM = criteria.minAUM || 100_000_000;  // Use user's AUM filter for pre-filtering

  logger.info(`  🔧 사전 필터: AUM≥$${(minAUM / 1e6).toFixed(0)}M + 배당지급 ETF`);

  const popularSymbols = new Set(POPULAR_DIVIDEND_ETFS);
  let allETFs: { symbol: string; name: string }[] = [];

  // Add popular ETFs first (always included regardless of filter)
  for (const sym of POPULAR_DIVIDEND_ETFS) {
    allETFs.push({ symbol: sym, name: sym });
  }

  // Then get pre-filtered ETF list from FMP
  try {
    const etfList = await getETFList({ minAUM });
    for (const etf of etfList) {
      if (!popularSymbols.has(etf.symbol)) {
        allETFs.push({ symbol: etf.symbol, name: etf.name });
      }
    }
    logger.info(`  📊 유니버스 구성: 큐레이션 ${POPULAR_DIVIDEND_ETFS.length}개 + 사전필터 ${etfList.length}개 = 총 ${allETFs.length}개 (중복제거)`);
  } catch (err) {
    logger.warn('Failed to get ETF list, using popular ETFs only');
  }

  const maxToCheck = criteria.maxETFsToCheck || 200;
  allETFs = allETFs.slice(0, maxToCheck);

  logger.info(`  🎯 분석 대상: ${allETFs.length}개 (최대 ${maxToCheck}개 제한)`);

  let processedCount = 0;
  let skippedCount = 0;
  const skipReasons: Record<string, number> = {};
  const batchSize = 10;

  for (let batchStart = 0; batchStart < allETFs.length; batchStart += batchSize) {
    const batch = allETFs.slice(batchStart, batchStart + batchSize);

    for (const etfItem of batch) {
      processedCount++;
      const { symbol } = etfItem;

      try {
        const result = await analyzeETF(symbol, criteria);
        if (result.etf) {
          results.push(result.etf);
        } else {
          skippedCount++;
          const reason = result.skipReason || '기타';
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        }
      } catch (err) {
        skippedCount++;
        skipReasons['오류'] = (skipReasons['오류'] || 0) + 1;
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
  logger.info(`     • 스킵/필터링: ${skippedCount}개`);
  logger.info(`     • 최종 반환: ${finalResults.length}개 (limit: ${limit})`);
  if (Object.keys(skipReasons).length > 0) {
    logger.info('     • 탈락 사유:');
    Object.entries(skipReasons).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
      logger.info(`       - ${reason}: ${count}건`);
    });
  }
  if (finalResults.length > 0) {
    logger.info(`     • 최고점수: ${finalResults[0].symbol} (Q-LEAD: ${finalResults[0].totalScore})`);
  }
  logger.info('═══════════════════════════════════════════════════════');

  return { results: finalResults, skipSummary: skipReasons };
}

type ETFAnalysisResult =
  | { etf: ScreenedETF; skipReason?: undefined }
  | { etf?: undefined; skipReason: string };

async function analyzeETF(
  symbol: string,
  criteria: ETFScreeningCriteria
): Promise<ETFAnalysisResult> {
  // ⚡ 1단계: profile + etfInfo 병렬 호출 (서로 독립)
  const [profile, etfInfo] = await Promise.all([
    getETFProfile(symbol),
    getETFInfo(symbol),
  ]);

  if (!profile) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 프로필 없음`);
    return { skipReason: '프로필 없음' };
  }

  if (!profile.isActivelyTrading) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 비활성 종목`);
    return { skipReason: '비활성 종목' };
  }

  const price = profile.price;
  if (!price || price <= 0) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 가격 없음`);
    return { skipReason: '가격 없음' };
  }

  // 🔴 비배당 ETF 제외: assetClass 기반 1차 → description 보조 2차 → 티커 안전장치 3차
  if (isNonDividendETF(symbol, profile.companyName || '', etfInfo?.assetClass, etfInfo?.description)) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 비배당 ETF 제외 (assetClass: ${etfInfo?.assetClass || 'N/A'})`);
    return { skipReason: '비배당 ETF 제외' };
  }

  // FMP API returns expenseRatio as percentage value (0.06 means 0.06%)
  const expenseRatioRaw = etfInfo?.expenseRatio ?? 0;
  const expenseRatioDecimal = expenseRatioRaw / 100;
  const aum = etfInfo?.aum ?? profile.mktCap ?? 0;

  // Dividend yield (decimal: 0.04 = 4%)
  const annualDiv = profile.lastDiv || 0;
  const dividendYield = price > 0 ? annualDiv / price : 0;

  // Apply filters (빠른 필터 — 추가 API 호출 전에 탈락시킴)
  if (dividendYield < criteria.minDividendYield) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 배당수익률 미달 (${(dividendYield * 100).toFixed(2)}% < ${(criteria.minDividendYield * 100).toFixed(2)}%)`);
    return { skipReason: '수익률 미달' };
  }
  if (aum < criteria.minAUM) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | AUM 미달 ($${(aum / 1e9).toFixed(2)}B < $${(criteria.minAUM / 1e9).toFixed(2)}B)`);
    return { skipReason: 'AUM 미달' };
  }
  if (criteria.maxExpenseRatio > 0 && expenseRatioDecimal > criteria.maxExpenseRatio) {
    logger.info(`  ⏭️  ${symbol.padEnd(6)} | 운용보수 초과 (${(expenseRatioDecimal * 100).toFixed(2)}% > ${(criteria.maxExpenseRatio * 100).toFixed(2)}%)`);
    return { skipReason: '운용보수 초과' };
  }

  // ⚡ 2단계: 필터 통과한 종목만 holdings + 배당성장 병렬 호출
  const [holdings, dividendGrowth5Y] = await Promise.all([
    getETFHoldings(symbol),
    calculateDividendGrowth5Y(symbol),
  ]);

  // Top 10 concentration (FMP returns weightPercentage as % value, e.g. 1.374 = 1.374%)
  const sortedHoldings = [...holdings].sort((a, b) => (b.weightPercentage || 0) - (a.weightPercentage || 0));
  const top10Concentration = sortedHoldings.slice(0, 10).reduce((sum, h) => sum + (h.weightPercentage || 0), 0);

  // 🔴 커버드콜 감지
  const coveredCall = isCoveredCallETF(symbol, profile.companyName || symbol);

  // 🔴 커버드콜 수익률 보정: 옵션 프리미엄이 포함된 수익률을 30% 할인하여 점수 산정
  const adjustedYieldForScoring = coveredCall ? dividendYield * 0.7 : dividendYield;

  // Calculate Q-LEAD scores (보정된 수익률 사용)
  const qlead = calculateQLEAD(expenseRatioDecimal, aum, holdings, adjustedYieldForScoring, dividendGrowth5Y ?? undefined);

  // 🔴 Exposure 최소 기준: 30점 미만 시 총점 페널티
  let adjustedTotalScore = qlead.totalScore;
  if (qlead.exposureScore < 30) {
    const exposurePenalty = Math.round((30 - qlead.exposureScore) * 0.3); // 최대 -9점
    adjustedTotalScore = Math.max(0, adjustedTotalScore - exposurePenalty);
    logger.debug(`  ${symbol}: Exposure 페널티 -${exposurePenalty}점 (Exposure=${qlead.exposureScore})`);
  }

  // 자산유형 분류
  const assetType = classifyETFAssetType(symbol, profile.companyName || '', etfInfo?.assetClass);

  logger.info(`  ✅ ${symbol.padEnd(6)} | 수익률: ${(dividendYield * 100).toFixed(2)}%${coveredCall ? '(CC)' : ''} | 보수: ${(expenseRatioDecimal * 100).toFixed(3)}% | AUM: $${(aum / 1e9).toFixed(1)}B | Q-LEAD: ${adjustedTotalScore} | ${assetType}`);

  return {
    etf: {
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
      totalScore: adjustedTotalScore,
      qualityGrade: qlead.qualityGrade,
      liquidityGrade: qlead.liquidityGrade,
      exposureGrade: qlead.exposureGrade,
      dividendGrade: qlead.dividendGrade,
      holdingsCount: holdings.length || etfInfo?.holdingsCount,
      top10Concentration: Math.round(top10Concentration * 100) / 100,
      dividendGrowth5Y: dividendGrowth5Y ?? undefined,
      beta: profile.beta,
      isCoveredCall: coveredCall,
      assetType,
      lastUpdated: new Date().toISOString(),
    },
  };
}

// ==========================================
// 5Y Dividend Growth Calculation
// ==========================================

async function calculateDividendGrowth5Y(symbol: string): Promise<number | null> {
  try {
    const data = await fmpGet<{ historical: Array<{ date: string; dividend: number }> }>(
      `/v3/historical-price-full/stock_dividend/${symbol}`
    );
    if (!data?.historical || data.historical.length < 4) return null;

    const divs = data.historical
      .filter(d => d.dividend > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (divs.length < 4) return null;

    // 최근 1년 배당 합계
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentDivs = divs.filter(d => new Date(d.date) >= oneYearAgo);
    const recentTotal = recentDivs.reduce((sum, d) => sum + d.dividend, 0);

    // 5년 전 1년간 배당 합계
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const sixYearsAgo = new Date();
    sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);
    const oldDivs = divs.filter(d => {
      const dt = new Date(d.date);
      return dt >= sixYearsAgo && dt < fiveYearsAgo;
    });
    const oldTotal = oldDivs.reduce((sum, d) => sum + d.dividend, 0);

    if (oldTotal <= 0 || recentTotal <= 0) return null;

    // 5Y CAGR (decimal: 0.05 = 5%)
    const cagr = Math.pow(recentTotal / oldTotal, 1 / 5) - 1;
    return Math.round(cagr * 10000) / 10000; // 소수점 4자리
  } catch {
    return null;
  }
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

  const dividendGrowth5Y = await calculateDividendGrowth5Y(symbol);
  const coveredCall = isCoveredCallETF(symbol, profile.companyName || symbol);
  const adjustedYield = coveredCall ? dividendYield * 0.7 : dividendYield;
  const qlead = calculateQLEAD(expenseRatioDecimal, aum, holdings, adjustedYield, dividendGrowth5Y ?? undefined);
  const assetType = classifyETFAssetType(symbol, profile.companyName || '', etfInfo?.assetClass);

  let adjustedTotalScore = qlead.totalScore;
  if (qlead.exposureScore < 30) {
    const exposurePenalty = Math.round((30 - qlead.exposureScore) * 0.3);
    adjustedTotalScore = Math.max(0, adjustedTotalScore - exposurePenalty);
  }

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
    totalScore: adjustedTotalScore,
    qualityGrade: qlead.qualityGrade,
    liquidityGrade: qlead.liquidityGrade,
    exposureGrade: qlead.exposureGrade,
    dividendGrade: qlead.dividendGrade,
    holdingsCount: holdings.length || etfInfo?.holdingsCount,
    top10Concentration: Math.round(top10Concentration * 100) / 100,
    dividendGrowth5Y: dividendGrowth5Y ?? undefined,
    beta: profile.beta,
    isCoveredCall: coveredCall,
    assetType,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getETFHoldingsData(symbol: string): Promise<FMPETFHolding[]> {
  return getETFHoldings(symbol);
}
