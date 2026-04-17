import {
  RebalanceRequest,
  RebalanceResponse,
  RebalanceScenario,
  RebalanceHoldingAnalysis,
  NewBuyRecommendation,
  RebalanceMetrics,
  RebalanceAction,
  UserHolding,
  ScreenedStock,
  ScreenedETF,
  InvestmentTendency,
} from '../types/index.js';
import { getQuote, getDividendHistory, fmpClient } from './fmpService.js';
import { getSessionDetail } from './dbService.js';
import logger from '../utils/logger.js';

// ==========================================
// Constants
// ==========================================

const US_DIVIDEND_TAX_RATE = 0.15;
const REQUEST_DELAY = 300; // ms between FMP API calls

// Score thresholds for action decisions
const SCORE_THRESHOLDS = {
  conservative: { sell: 40, reduce: 55, keep: 65, increase: 75 },
  balanced:     { sell: 35, reduce: 50, keep: 60, increase: 70 },
  growth:       { sell: 30, reduce: 45, keep: 55, increase: 65 },
  aggressive:   { sell: 25, reduce: 40, keep: 50, increase: 60 },
};

// ==========================================
// Helpers
// ==========================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getYieldPct(asset: ScreenedStock | ScreenedETF, assetType: string): number {
  if (assetType === 'etf') return ((asset as ScreenedETF).dividendYield || 0) * 100;
  return (asset as ScreenedStock).dividendYield || 0;
}

function getAssetScore(asset: ScreenedStock | ScreenedETF, assetType: string): number {
  if (assetType === 'etf') return (asset as ScreenedETF).totalScore || 0;
  return (asset as ScreenedStock).overallScore || 0;
}

function getAssetGrade(asset: ScreenedStock | ScreenedETF, assetType: string): string {
  if (assetType === 'etf') {
    const s = (asset as ScreenedETF).totalScore || 0;
    if (s >= 85) return 'A+';
    if (s >= 75) return 'A';
    if (s >= 65) return 'B+';
    if (s >= 55) return 'B';
    if (s >= 40) return 'C';
    return 'D';
  }
  return (asset as ScreenedStock).grade || 'C';
}

function getAssetPrice(asset: ScreenedStock | ScreenedETF, assetType: string): number {
  if (assetType === 'etf') return (asset as ScreenedETF).price || 0;
  return (asset as ScreenedStock).currentPrice || 0;
}

function getAssetBeta(asset: ScreenedStock | ScreenedETF, assetType: string): number {
  if (assetType === 'etf') return (asset as ScreenedETF).beta ?? 1.0;
  return (asset as ScreenedStock).beta ?? 1.0;
}

/** Detect per-asset type: ETF has 'totalScore', Stock has 'overallScore' */
function detectAssetType(asset: ScreenedStock | ScreenedETF): 'stock' | 'etf' {
  if ('totalScore' in asset && (asset as ScreenedETF).totalScore !== undefined) return 'etf';
  if ('overallScore' in asset && (asset as ScreenedStock).overallScore !== undefined) return 'stock';
  // Fallback: ETF has 'price', Stock has 'currentPrice'
  if ('expenseRatio' in asset) return 'etf';
  return 'stock';
}

function classifyAsset(asset: ScreenedStock | ScreenedETF, assetType: string): string {
  if (assetType === 'etf') {
    const etf = asset as ScreenedETF;
    if (etf.isCoveredCall) return 'covered-call';
    const at = (etf.assetType || '').toLowerCase();
    if (at === 'bond' || at === 'preferred') return 'bond-income';
    if (at === 'reit') return 'reit';
    return 'equity-dividend';
  }
  const stock = asset as ScreenedStock;
  const beta = stock.beta ?? 1.0;
  if (beta < 0.8) return 'low-risk';
  if (beta <= 1.2) return 'medium-risk';
  return 'high-risk';
}

// ==========================================
// Fetch Current Data for User Holdings
// ==========================================

interface HoldingLiveData {
  symbol: string;
  name: string;
  currentPrice: number;
  annualDividend: number;
  dividendYield: number;
  beta: number;
  found: boolean;
}

async function fetchHoldingData(symbols: string[]): Promise<Map<string, HoldingLiveData>> {
  const result = new Map<string, HoldingLiveData>();

  // Batch fetch quotes (up to 50 at a time)
  for (let i = 0; i < symbols.length; i += 50) {
    const batch = symbols.slice(i, i + 50);
    try {
      const quoteRes = await fmpClient.get('/v3/quote/' + batch.join(','));
      for (const q of (quoteRes.data || [])) {
        result.set(q.symbol, {
          symbol: q.symbol,
          name: q.name || q.symbol,
          currentPrice: q.price || 0,
          annualDividend: 0,  // will be filled below
          dividendYield: 0,
          beta: 1.0,
          found: true,
        });
      }
    } catch (err) {
      logger.error(`[Rebalance] Quote batch failed: ${(err as Error).message}`);
    }
    if (i + 50 < symbols.length) await delay(REQUEST_DELAY);
  }

  // Fetch dividend data for each found symbol
  for (const sym of result.keys()) {
    try {
      const history = await getDividendHistory(sym);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoff = oneYearAgo.toISOString().split('T')[0];
      const recentDivs = history.filter(d => d.date >= cutoff);
      const annualDiv = recentDivs.reduce((sum, d) => sum + (d.adjDividend || d.dividend || 0), 0);

      const data = result.get(sym)!;
      data.annualDividend = annualDiv;
      data.dividendYield = data.currentPrice > 0 ? (annualDiv / data.currentPrice) * 100 : 0;
    } catch {
      // keep default 0
    }
    await delay(REQUEST_DELAY);
  }

  // Mark unfound symbols
  for (const sym of symbols) {
    if (!result.has(sym)) {
      result.set(sym, {
        symbol: sym,
        name: sym,
        currentPrice: 0,
        annualDividend: 0,
        dividendYield: 0,
        beta: 1.0,
        found: false,
      });
    }
  }

  return result;
}

// ==========================================
// Analyze Existing Holdings
// ==========================================

function analyzeExistingHoldings(
  holdings: UserHolding[],
  liveData: Map<string, HoldingLiveData>,
  screeningMap: Map<string, ScreenedStock | ScreenedETF>,
  assetType: string,
  currentPortfolioValue: number,   // value of existing holdings ONLY (no additional cash)
  totalPortfolioValue: number,     // includes additional investment
  thresholds: { sell: number; reduce: number; keep: number; increase: number },
  aggressiveness: 'minimal' | 'balanced' | 'aggressive',
): RebalanceHoldingAnalysis[] {
  const analyses: RebalanceHoldingAnalysis[] = [];

  // Pre-calculate: ideal weight per holding in current portfolio
  const holdingCount = holdings.filter(h => liveData.get(h.symbol.toUpperCase())?.found).length;
  const avgWeight = holdingCount > 0 ? 100 / holdingCount : 10;

  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const live = liveData.get(sym);
    if (!live || !live.found) continue;

    const marketValue = h.shares * live.currentPrice;
    // Weight relative to current holdings only (not inflated by additional investment)
    const weight = currentPortfolioValue > 0 ? (marketValue / currentPortfolioValue) * 100 : 0;

    const screenedAsset = screeningMap.get(sym);
    const inScreening = !!screenedAsset;
    const resolvedType = screenedAsset ? detectAssetType(screenedAsset) : assetType;
    const rawScore = screenedAsset ? getAssetScore(screenedAsset, resolvedType) : null;
    const score = rawScore !== null ? Math.round(rawScore * 100) / 100 : null;
    const grade = screenedAsset ? getAssetGrade(screenedAsset, resolvedType) : null;

    let action: RebalanceAction;
    let reason: string;
    let targetShares = h.shares;  // default: keep current shares

    if (!inScreening) {
      // ====== NOT in screening results → exclude ======
      if (aggressiveness === 'minimal') {
        action = 'keep';
        reason = '스크리닝 미포함 종목이나, 최소 변경 전략으로 유지합니다.';
      } else {
        action = 'exclude';
        reason = '최신 스크리닝 기준에 포함되지 않는 종목입니다. 포트폴리오에서 제외를 권장합니다.';
        targetShares = 0;
      }
    } else if (score !== null) {
      if (score >= thresholds.increase) {
        // ====== High score → keep or increase ======
        action = aggressiveness === 'minimal' ? 'keep' : 'increase';
        if (aggressiveness !== 'minimal') {
          // Increase: add shares using additional investment proportionally
          const idealValue = marketValue * 1.3;
          targetShares = live.currentPrice > 0 ? Math.floor(idealValue / live.currentPrice) : h.shares;
          reason = `스크리닝 상위 종목 (${grade}, ${score}점). 비중 확대를 권장합니다.`;
        } else {
          reason = `스크리닝 상위 종목 (${grade}, ${score}점). 현재 비중 유지.`;
        }
      } else if (score >= thresholds.keep) {
        // ====== Good score → keep ======
        action = 'keep';
        reason = `양호한 점수 (${grade}, ${score}점). 현재 비중을 유지합니다.`;
      } else if (score >= thresholds.reduce) {
        // ====== Moderate score → reduce only if overweight ======
        if (aggressiveness === 'minimal') {
          action = 'keep';
          reason = `보통 점수 (${grade}, ${score}점). 최소 변경 전략으로 유지합니다.`;
        } else {
          // Check if actually overweight relative to fair share
          const isOverweight = weight > avgWeight * 1.5;
          if (isOverweight) {
            action = 'reduce';
            // Reduce to average weight level, based on CURRENT portfolio
            const reduceTarget = currentPortfolioValue * (avgWeight / 100);
            targetShares = live.currentPrice > 0 ? Math.floor(reduceTarget / live.currentPrice) : h.shares;
            // Safety: ensure we actually reduce
            if (targetShares >= h.shares) targetShares = Math.floor(h.shares * 0.7);
            const reduceDelta = h.shares - targetShares;
            reason = `보통 이하 점수 (${grade}, ${score}점)이며 비중 과다(${weight.toFixed(1)}%). ${reduceDelta}주 축소를 권장합니다.`;
          } else {
            action = 'keep';
            reason = `보통 점수 (${grade}, ${score}점). 비중이 적정 수준이므로 유지합니다.`;
          }
        }
      } else {
        // ====== Low score → exclude or reduce ======
        if (aggressiveness === 'minimal') {
          // Minimal: reduce only if overweight
          const isOverweight = weight > avgWeight;
          if (isOverweight) {
            action = 'reduce';
            targetShares = Math.floor(h.shares * 0.5);
            if (targetShares < 1) targetShares = 0;
            const reduceDelta = h.shares - targetShares;
            reason = `낮은 점수 (${grade}, ${score}점). ${reduceDelta}주 축소를 권장합니다.`;
          } else {
            action = 'keep';
            reason = `낮은 점수 (${grade}, ${score}점)이나 비중이 작아 최소 변경 전략으로 유지합니다.`;
          }
        } else {
          action = 'exclude';
          reason = `낮은 점수 (${grade}, ${score}점). 포트폴리오에서 제외 후 상위 종목으로 교체를 권장합니다.`;
          targetShares = 0;
        }
      }
    } else {
      action = 'keep';
      reason = '점수 데이터 없음. 현재 비중을 유지합니다.';
    }

    // Final safety: reduce action must always have fewer shares
    if (action === 'reduce' && targetShares >= h.shares) {
      action = 'keep';
      reason = reason.replace('비중 축소를 권장합니다.', '현재 비중을 유지합니다.');
    }

    const shareDelta = targetShares - h.shares;
    const amountDelta = shareDelta * live.currentPrice;
    const targetWeight = totalPortfolioValue > 0
      ? (targetShares * live.currentPrice / totalPortfolioValue) * 100
      : 0;

    analyses.push({
      symbol: sym,
      name: live.name,
      shares: h.shares,
      currentPrice: live.currentPrice,
      avgPrice: h.avgPrice,
      marketValue,
      weight: Math.round(weight * 100) / 100,
      annualDividend: live.annualDividend,
      dividendYield: Math.round(live.dividendYield * 100) / 100,
      inScreeningResult: inScreening,
      score,
      grade,
      action,
      reason,
      targetWeight: Math.round(targetWeight * 100) / 100,
      targetShares,
      shareDelta,
      amountDelta: Math.round(amountDelta * 100) / 100,
    });
  }

  return analyses;
}

// ==========================================
// Recommend New Buys
// ==========================================

function recommendNewBuys(
  screeningResults: (ScreenedStock | ScreenedETF)[],
  existingSymbols: Set<string>,
  assetType: string,
  availableCash: number,
  maxNew: number,
  tendency: InvestmentTendency,
): NewBuyRecommendation[] {
  // Filter: not already held, sort by score descending
  const candidates = screeningResults
    .filter(a => !existingSymbols.has(a.symbol))
    .map(a => {
      const aType = assetType === 'mixed' ? detectAssetType(a) : assetType;
      return {
        asset: a,
        score: getAssetScore(a, aType),
        yield: getYieldPct(a, aType),
        price: getAssetPrice(a, aType),
        grade: getAssetGrade(a, aType),
        category: classifyAsset(a, aType),
      };
    })
    .filter(c => c.price > 0)
    .sort((a, b) => {
      // Growth tendency → favor higher score; conservative → favor higher yield
      if (tendency === 'conservative' || tendency === 'balanced') {
        return (b.yield * 0.5 + b.score * 0.5) - (a.yield * 0.5 + a.score * 0.5);
      }
      return b.score - a.score;
    })
    .slice(0, maxNew);

  if (candidates.length === 0 || availableCash <= 0) return [];

  // Distribute available cash equally among new buys
  const perAsset = availableCash / candidates.length;

  return candidates.map(c => {
    const shares = Math.floor(perAsset / c.price);
    const amount = shares * c.price;
    const suggestedWeight = availableCash > 0 ? (amount / availableCash) * 100 : 0;

    return {
      symbol: c.asset.symbol,
      name: c.asset.name || c.asset.symbol,
      currentPrice: c.price,
      dividendYield: Math.round(c.yield * 100) / 100,
      score: Math.round(c.score * 100) / 100,
      grade: c.grade,
      category: c.category,
      reason: `스크리닝 상위 종목 (${c.grade}, ${Math.round(c.score * 100) / 100}점, 배당률 ${c.yield.toFixed(1)}%). 포트폴리오 편입을 권장합니다.`,
      suggestedWeight: Math.round(suggestedWeight * 100) / 100,
      suggestedShares: shares,
      suggestedAmount: Math.round(amount * 100) / 100,
    };
  });
}

// ==========================================
// Calculate Portfolio Metrics
// ==========================================

function calculatePortfolioMetrics(
  holdingAnalyses: RebalanceHoldingAnalysis[],
  newBuys: NewBuyRecommendation[],
  isBefore: boolean,
): RebalanceMetrics {
  if (isBefore) {
    // Before rebalancing: use current state
    const totalValue = holdingAnalyses.reduce((s, h) => s + h.marketValue, 0);
    const totalAnnualDiv = holdingAnalyses.reduce((s, h) => s + h.annualDividend * h.shares, 0);
    const weightedYield = totalValue > 0 ? (totalAnnualDiv / totalValue) * 100 : 0;
    const avgScore = holdingAnalyses.filter(h => h.score !== null).length > 0
      ? holdingAnalyses.filter(h => h.score !== null).reduce((s, h) => s + (h.score || 0), 0)
        / holdingAnalyses.filter(h => h.score !== null).length
      : 0;

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      weightedYield: Math.round(weightedYield * 100) / 100,
      expectedAnnualDividend: Math.round(totalAnnualDiv * 100) / 100,
      expectedMonthlyDividendPostTax: Math.round((totalAnnualDiv / 12) * (1 - US_DIVIDEND_TAX_RATE) * 100) / 100,
      avgScore: Math.round(avgScore * 10) / 10,
      holdingsCount: holdingAnalyses.length,
    };
  }

  // After rebalancing: use target shares
  let totalValue = 0;
  let totalAnnualDiv = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const h of holdingAnalyses) {
    if (h.action === 'sell' || h.action === 'exclude') continue;
    const shares = h.targetShares ?? h.shares;
    const value = shares * h.currentPrice;
    totalValue += value;
    totalAnnualDiv += h.annualDividend * shares;
    if (h.score !== null) {
      scoreSum += h.score;
      scoreCount++;
    }
  }

  // Add new buys
  for (const nb of newBuys) {
    totalValue += nb.suggestedAmount;
    totalAnnualDiv += (nb.currentPrice * nb.dividendYield / 100) * nb.suggestedShares;
    scoreSum += nb.score;
    scoreCount++;
  }

  const weightedYield = totalValue > 0 ? (totalAnnualDiv / totalValue) * 100 : 0;
  const avgScore = scoreCount > 0 ? scoreSum / scoreCount : 0;
  const holdingsCount = holdingAnalyses.filter(h => h.action !== 'sell' && h.action !== 'exclude').length + newBuys.length;

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    weightedYield: Math.round(weightedYield * 100) / 100,
    expectedAnnualDividend: Math.round(totalAnnualDiv * 100) / 100,
    expectedMonthlyDividendPostTax: Math.round((totalAnnualDiv / 12) * (1 - US_DIVIDEND_TAX_RATE) * 100) / 100,
    avgScore: Math.round(avgScore * 10) / 10,
    holdingsCount,
  };
}

// ==========================================
// Main Entry Point
// ==========================================

export async function analyzeRebalance(request: RebalanceRequest): Promise<RebalanceResponse> {
  const { holdings, sessionId, sessionIds, preferences, exchangeRate } = request;
  const {
    additionalInvestment,
    investmentTendency,
    targetMonthlyDividend,
    maxNewHoldings,
    sellThreshold,
  } = preferences;

  // Resolve session IDs: support both single and multi-session
  const resolvedIds: number[] = sessionIds && sessionIds.length > 0
    ? sessionIds
    : sessionId ? [sessionId] : [];

  if (resolvedIds.length === 0) {
    throw new Error('기준 스크리닝 세션 ID가 필요합니다.');
  }

  logger.info(`[Rebalance] 리밸런싱 분석 시작: ${holdings.length}종목, 세션 [${resolvedIds.join(',')}], 추가투자 $${additionalInvestment}`);

  // 1. Load and merge screening sessions
  const screeningMap = new Map<string, ScreenedStock | ScreenedETF>();
  const sessionInfoList: { id: number; assetType: string; date: string; resultCount: number }[] = [];
  let primaryAssetType = 'stock';  // default, used for scoring helpers

  for (const sid of resolvedIds) {
    const session = getSessionDetail(sid);
    if (!session) {
      throw new Error(`스크리닝 세션 #${sid}를 찾을 수 없습니다.`);
    }

    const results = session.results as (ScreenedStock | ScreenedETF)[];
    const aType = session.session.asset_type;

    for (const r of results) {
      // If same symbol exists, keep the one with higher score
      const existing = screeningMap.get(r.symbol);
      if (!existing) {
        screeningMap.set(r.symbol, r);
      }
    }

    sessionInfoList.push({
      id: session.session.id,
      assetType: aType,
      date: session.session.session_date,
      resultCount: session.session.result_count,
    });

    // Use the first session's type as primary, unless mixed
    if (sessionInfoList.length === 1) {
      primaryAssetType = aType;
    }
  }

  const assetType = sessionInfoList.length > 1 ? 'mixed' : primaryAssetType;
  const screeningResults = [...screeningMap.values()];

  // 2. Fetch live data for user holdings
  const userSymbols = holdings.map(h => h.symbol.toUpperCase());
  const liveData = await fetchHoldingData(userSymbols);

  // Identify unmatched symbols
  const unmatchedSymbols = userSymbols.filter(s => !liveData.get(s)?.found);

  // 3. Calculate total portfolio value (current holdings + additional cash)
  let currentPortfolioValue = 0;
  for (const h of holdings) {
    const live = liveData.get(h.symbol.toUpperCase());
    if (live?.found) {
      currentPortfolioValue += h.shares * live.currentPrice;
    }
  }
  const totalPortfolioValue = currentPortfolioValue + additionalInvestment;

  logger.info(`[Rebalance] 현재 포트폴리오: $${currentPortfolioValue.toFixed(0)}, 추가투자 포함: $${totalPortfolioValue.toFixed(0)}`);

  // 4. Get thresholds based on tendency
  const thresholds = SCORE_THRESHOLDS[investmentTendency];

  // 5. Generate 3 scenarios
  const scenarioConfigs: { name: string; description: string; aggressiveness: 'minimal' | 'balanced' | 'aggressive'; newBuyRatio: number }[] = [
    {
      name: '최소 변경형',
      description: '기존 포트폴리오를 최대한 유지하면서 위험 종목만 조정합니다. 거래 비용을 최소화합니다.',
      aggressiveness: 'minimal',
      newBuyRatio: 0.3,  // 추가 투자금의 30%만 신규 매수
    },
    {
      name: '균형 조정형',
      description: '스크리닝 결과를 반영하여 적절히 비중을 조정합니다. 하위 종목은 비중을 줄이고 상위 종목을 추가합니다.',
      aggressiveness: 'balanced',
      newBuyRatio: 0.6,
    },
    {
      name: '적극 재구성형',
      description: '스크리닝 결과를 기반으로 포트폴리오를 대폭 재구성합니다. 미달 종목은 매도하고 상위 종목으로 교체합니다.',
      aggressiveness: 'aggressive',
      newBuyRatio: 1.0,
    },
  ];

  const scenarios: RebalanceScenario[] = [];

  for (const config of scenarioConfigs) {
    const existingAnalysis = analyzeExistingHoldings(
      holdings,
      liveData,
      screeningMap,
      assetType,
      currentPortfolioValue,
      totalPortfolioValue,
      thresholds,
      config.aggressiveness,
    );

    // Calculate freed cash from sells/reductions + additional investment
    const sellProceeds = existingAnalysis
      .filter(h => h.amountDelta !== undefined && h.amountDelta < 0)
      .reduce((s, h) => s + Math.abs(h.amountDelta!), 0);

    const availableCash = (additionalInvestment + sellProceeds) * config.newBuyRatio;

    // Existing symbols (exclude removed ones so they can be re-recommended)
    const existingSymbols = new Set(
      existingAnalysis
        .filter(h => h.action !== 'exclude' && h.action !== 'sell')
        .map(h => h.symbol)
    );

    const newBuys = recommendNewBuys(
      screeningResults,
      existingSymbols,
      assetType,
      availableCash,
      maxNewHoldings,
      investmentTendency,
    );

    const beforeMetrics = calculatePortfolioMetrics(existingAnalysis, [], true);
    const afterMetrics = calculatePortfolioMetrics(existingAnalysis, newBuys, false);

    scenarios.push({
      name: config.name,
      description: config.description,
      existingAnalysis,
      newBuys,
      beforeMetrics,
      afterMetrics,
    });
  }

  logger.info(`[Rebalance] 리밸런싱 분석 완료: ${scenarios.length}개 시나리오 생성`);

  return {
    scenarios,
    unmatchedSymbols,
    sessionInfo: sessionInfoList,
  };
}
