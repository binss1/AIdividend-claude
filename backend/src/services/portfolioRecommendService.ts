import {
  ScreenedStock,
  ScreenedETF,
  InvestmentTendency,
  SectorConcentration,
  DividendFrequencyPref,
  PortfolioRecommendRequest,
  PortfolioRecommendResponse,
  PortfolioVariant,
  PortfolioHolding,
  PortfolioMetrics,
  PortfolioProjection,
  Achievability,
} from '../types/index.js';

// ==========================================
// Constants
// ==========================================

const US_DIVIDEND_TAX_RATE = 0.15;
const DEFAULT_DIVIDEND_GROWTH = 0.05;
const DEFAULT_PRICE_GROWTH = 0.07;

// ETF classification keywords
const BOND_KEYWORDS = ['bond', 'treasury', 'fixed income', 'aggregate', 'corporate', 'high yield', 'debt', 'income fund'];
const COVERED_CALL_KEYWORDS = ['covered call', 'buy-write', 'premium income', 'option income'];
const COVERED_CALL_TICKERS = ['JEPI', 'JEPQ', 'QYLD', 'XYLD', 'RYLD', 'DIVO', 'NUSI', 'FTHI', 'SPYI', 'QQQY', 'IWMY'];
const REIT_KEYWORDS = ['reit', 'real estate', 'mortgage'];
const INTL_KEYWORDS = ['international', 'emerging', 'global', 'world', 'eafe', 'ex-us', 'foreign'];

// Allocation templates per tendency
const ETF_ALLOCATIONS: Record<InvestmentTendency, Record<string, number>> = {
  conservative: { 'bond-income': 0.35, 'covered-call': 0.30, 'equity-dividend': 0.25, reit: 0.10, international: 0 },
  balanced:     { 'bond-income': 0.20, 'covered-call': 0.25, 'equity-dividend': 0.35, reit: 0.15, international: 0.05 },
  growth:       { 'bond-income': 0.10, 'covered-call': 0.20, 'equity-dividend': 0.45, reit: 0.15, international: 0.10 },
  aggressive:   { 'bond-income': 0.05, 'covered-call': 0.15, 'equity-dividend': 0.50, reit: 0.15, international: 0.15 },
};

const STOCK_ALLOCATIONS: Record<InvestmentTendency, Record<string, number>> = {
  conservative: { 'low-risk': 0.55, 'medium-risk': 0.35, 'high-risk': 0.10 },
  balanced:     { 'low-risk': 0.35, 'medium-risk': 0.40, 'high-risk': 0.25 },
  growth:       { 'low-risk': 0.20, 'medium-risk': 0.40, 'high-risk': 0.40 },
  aggressive:   { 'low-risk': 0.10, 'medium-risk': 0.30, 'high-risk': 0.60 },
};

const SECTOR_LIMITS: Record<SectorConcentration, number> = {
  low: 0.20,
  medium: 0.35,
  high: 0.50,
};

const TENDENCY_ORDER: InvestmentTendency[] = ['conservative', 'balanced', 'growth', 'aggressive'];

// ==========================================
// Classification
// ==========================================

function classifyETF(etf: ScreenedETF): string {
  const name = (etf.name || '').toLowerCase();
  const symbol = (etf.symbol || '').toUpperCase();

  if (COVERED_CALL_TICKERS.includes(symbol) || (etf as any).isCoveredCall) return 'covered-call';
  if (COVERED_CALL_KEYWORDS.some(k => name.includes(k))) return 'covered-call';
  if (REIT_KEYWORDS.some(k => name.includes(k))) return 'reit';
  if (INTL_KEYWORDS.some(k => name.includes(k))) return 'international';
  if (BOND_KEYWORDS.some(k => name.includes(k))) return 'bond-income';
  return 'equity-dividend';
}

function classifyStock(stock: ScreenedStock): string {
  const beta = stock.beta ?? 1.0;
  if (beta < 0.8) return 'low-risk';
  if (beta <= 1.2) return 'medium-risk';
  return 'high-risk';
}

// ==========================================
// Normalization helpers
// ==========================================

function getYieldPercent(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): number {
  if (assetType === 'etf') {
    // ETF dividendYield is decimal (0.035 = 3.5%)
    return ((asset as ScreenedETF).dividendYield || 0) * 100;
  }
  // Stock dividendYield is already percentage (3.5 = 3.5%)
  return (asset as ScreenedStock).dividendYield || 0;
}

function getScore(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): number {
  if (assetType === 'etf') return (asset as ScreenedETF).totalScore || 0;
  return (asset as ScreenedStock).overallScore || 0;
}

function getGrade(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): string {
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

function getPrice(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): number {
  if (assetType === 'etf') return (asset as ScreenedETF).price || 0;
  return (asset as ScreenedStock).currentPrice || 0;
}

function getBeta(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): number {
  if (assetType === 'etf') return (asset as ScreenedETF).beta ?? 1.0;
  return (asset as ScreenedStock).beta ?? 1.0;
}

function getAnnualDivPerShare(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): number {
  const price = getPrice(asset, assetType);
  const yieldPct = getYieldPercent(asset, assetType);
  if (assetType === 'stock') return (asset as ScreenedStock).annualDividend || (price * yieldPct / 100);
  return price * yieldPct / 100;
}

function getSector(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): string {
  if (assetType === 'stock') return (asset as ScreenedStock).sector || 'Unknown';
  return classifyETF(asset as ScreenedETF);
}

function getDividendCycle(asset: ScreenedStock | ScreenedETF, assetType: 'stock' | 'etf'): string {
  if (assetType === 'stock') return (asset as ScreenedStock).dividendCycle || 'quarterly';
  // Most ETFs pay monthly or quarterly; covered-call ETFs tend to be monthly
  if (assetType === 'etf') {
    const etf = asset as ScreenedETF;
    if ((etf as any).isCoveredCall || COVERED_CALL_TICKERS.includes(etf.symbol?.toUpperCase())) return 'monthly';
  }
  return 'quarterly';
}

// ==========================================
// Fitness Scoring
// ==========================================

interface ScoredAsset {
  asset: ScreenedStock | ScreenedETF;
  category: string;
  fitnessScore: number;
  yieldPct: number;
  qualityScore: number;
  price: number;
  beta: number;
  annualDivPerShare: number;
  sector: string;
  dividendCycle: string;
  grade: string;
}

function scoreAssets(
  assets: (ScreenedStock | ScreenedETF)[],
  assetType: 'stock' | 'etf',
  tendency: InvestmentTendency,
  divFreqPref: DividendFrequencyPref,
  targetYieldPct: number,
): ScoredAsset[] {
  const scored: ScoredAsset[] = [];

  for (const asset of assets) {
    const category = assetType === 'etf' ? classifyETF(asset as ScreenedETF) : classifyStock(asset as ScreenedStock);
    const yieldPct = getYieldPercent(asset, assetType);
    const qualityScore = getScore(asset, assetType);
    const price = getPrice(asset, assetType);
    const beta = getBeta(asset, assetType);
    const annualDivPerShare = getAnnualDivPerShare(asset, assetType);
    const sector = getSector(asset, assetType);
    const dividendCycle = getDividendCycle(asset, assetType);
    const grade = getGrade(asset, assetType);

    if (price <= 0) continue;

    // 1. Yield contribution (30%)
    const yieldScore = targetYieldPct > 0
      ? Math.min(yieldPct / targetYieldPct, 2) * 50
      : Math.min(yieldPct / 5, 1) * 100;

    // 2. Quality score (25%)
    const qualityComponent = qualityScore;

    // 3. Cost efficiency / Dividend safety (15%)
    let efficiencyScore: number;
    if (assetType === 'etf') {
      const er = (asset as ScreenedETF).expenseRatio || 0.01;
      efficiencyScore = Math.max(0, 100 - er * 10000); // Lower expense ratio = higher score
    } else {
      const pr = (asset as ScreenedStock).payoutRatio || 50;
      // Optimal payout ratio: 30-60%
      if (pr >= 30 && pr <= 60) efficiencyScore = 100;
      else if (pr < 30) efficiencyScore = 60 + (pr / 30) * 40;
      else if (pr <= 85) efficiencyScore = 100 - ((pr - 60) / 25) * 60;
      else efficiencyScore = Math.max(10, 40 - (pr - 85));
    }

    // 4. Diversification (15%) - will be adjusted during selection
    const diversificationScore = 70; // Base score, adjusted during optimization

    // 5. Risk alignment (15%)
    const tendencyIdx = TENDENCY_ORDER.indexOf(tendency);
    const idealBeta = 0.6 + tendencyIdx * 0.3; // conservative=0.6, aggressive=1.5
    const betaDiff = Math.abs(beta - idealBeta);
    const riskScore = Math.max(0, 100 - betaDiff * 80);

    let fitnessScore = (
      yieldScore * 0.30 +
      qualityComponent * 0.25 +
      efficiencyScore * 0.15 +
      diversificationScore * 0.15 +
      riskScore * 0.15
    );

    // Dividend frequency bonus
    if (divFreqPref === 'monthly' && dividendCycle === 'monthly') fitnessScore *= 1.20;
    if (divFreqPref === 'quarterly' && dividendCycle === 'quarterly') fitnessScore *= 1.10;

    scored.push({
      asset,
      category,
      fitnessScore: Math.min(fitnessScore, 100),
      yieldPct,
      qualityScore,
      price,
      beta,
      annualDivPerShare,
      sector,
      dividendCycle,
      grade,
    });
  }

  return scored.sort((a, b) => b.fitnessScore - a.fitnessScore);
}

// ==========================================
// Portfolio Construction
// ==========================================

function buildPortfolio(
  scoredAssets: ScoredAsset[],
  allocation: Record<string, number>,
  totalInvestment: number,
  maxHoldings: number,
  sectorLimit: number,
  assetType: 'stock' | 'etf',
): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
  const sectorWeights: Record<string, number> = {};

  // Group assets by category
  const byCategory: Record<string, ScoredAsset[]> = {};
  for (const sa of scoredAssets) {
    if (!byCategory[sa.category]) byCategory[sa.category] = [];
    byCategory[sa.category].push(sa);
  }

  // Allocate holdings per category
  const categories = Object.keys(allocation).filter(c => allocation[c] > 0);
  const holdingsPerCategory: Record<string, number> = {};
  let remainingSlots = maxHoldings;

  for (const cat of categories) {
    const catWeight = allocation[cat];
    const slots = Math.max(1, Math.round(maxHoldings * catWeight));
    holdingsPerCategory[cat] = Math.min(slots, remainingSlots);
    remainingSlots -= holdingsPerCategory[cat];
    if (remainingSlots <= 0) break;
  }

  // Select top assets per category
  for (const cat of categories) {
    const available = byCategory[cat] || [];
    const slots = holdingsPerCategory[cat] || 0;
    const targetWeight = allocation[cat];

    if (slots === 0 || available.length === 0) continue;

    const selected = available.slice(0, slots);
    const weightPerAsset = targetWeight / selected.length;

    for (const sa of selected) {
      const sector = sa.sector;
      const currentSectorWeight = sectorWeights[sector] || 0;

      // Apply sector concentration limit
      let adjustedWeight = weightPerAsset;
      if (currentSectorWeight + adjustedWeight > sectorLimit) {
        adjustedWeight = Math.max(0.05, sectorLimit - currentSectorWeight);
      }

      // Enforce min 5%, max 30% per holding
      adjustedWeight = Math.max(0.05, Math.min(0.30, adjustedWeight));

      const amount = totalInvestment * adjustedWeight;
      const shares = Math.floor(amount / sa.price);
      if (shares <= 0) continue;

      const actualAmount = shares * sa.price;
      const annualDiv = shares * sa.annualDivPerShare;

      sectorWeights[sector] = (sectorWeights[sector] || 0) + adjustedWeight;

      holdings.push({
        symbol: sa.asset.symbol,
        name: sa.asset.name || sa.asset.symbol,
        weight: adjustedWeight * 100,
        amount: actualAmount,
        shares,
        currentPrice: sa.price,
        annualDividend: annualDiv,
        monthlyDividend: annualDiv / 12,
        dividendYield: sa.yieldPct,
        score: sa.qualityScore,
        grade: sa.grade,
        category: cat,
        dividendCycle: sa.dividendCycle,
      });
    }
  }

  // Normalize weights to 100%
  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  if (totalWeight > 0 && Math.abs(totalWeight - 100) > 0.1) {
    const factor = 100 / totalWeight;
    for (const h of holdings) {
      h.weight = Math.round(h.weight * factor * 10) / 10;
      h.amount = totalInvestment * h.weight / 100;
      h.shares = Math.floor(h.amount / h.currentPrice);
      h.amount = h.shares * h.currentPrice;
      h.annualDividend = h.shares * (h.currentPrice * h.dividendYield / 100);
      h.monthlyDividend = h.annualDividend / 12;
    }
  }

  return holdings.sort((a, b) => b.weight - a.weight);
}

// ==========================================
// Metrics Calculation
// ==========================================

function calculateMetrics(
  holdings: PortfolioHolding[],
  totalInvestment: number,
  scoredAssets: ScoredAsset[],
  assetType: 'stock' | 'etf',
): PortfolioMetrics {
  const totalActualInvestment = holdings.reduce((s, h) => s + h.amount, 0);
  const totalAnnualDiv = holdings.reduce((s, h) => s + h.annualDividend, 0);
  const weightedYield = totalActualInvestment > 0 ? (totalAnnualDiv / totalActualInvestment) * 100 : 0;

  // Beta
  let weightedBeta = 0;
  for (const h of holdings) {
    const sa = scoredAssets.find(s => s.asset.symbol === h.symbol);
    weightedBeta += (h.weight / 100) * (sa?.beta || 1.0);
  }

  // Expense ratio (ETF only)
  let avgExpenseRatio: number | undefined;
  if (assetType === 'etf') {
    let weightedER = 0;
    for (const h of holdings) {
      const sa = scoredAssets.find(s => s.asset.symbol === h.symbol);
      weightedER += (h.weight / 100) * ((sa?.asset as ScreenedETF).expenseRatio || 0);
    }
    avgExpenseRatio = weightedER;
  }

  // Average score
  const avgScore = holdings.length > 0
    ? holdings.reduce((s, h) => s + h.score * h.weight / 100, 0)
    : 0;

  // Sector distribution
  const sectorDistribution: Record<string, number> = {};
  for (const h of holdings) {
    sectorDistribution[h.category] = (sectorDistribution[h.category] || 0) + h.weight;
  }

  // Dividend calendar (12 months)
  const calendar = new Array(12).fill(0);
  for (const h of holdings) {
    const sa = scoredAssets.find(s => s.asset.symbol === h.symbol);
    const cycle = sa?.dividendCycle || 'quarterly';
    if (cycle === 'monthly') {
      for (let m = 0; m < 12; m++) calendar[m] += h.monthlyDividend;
    } else if (cycle === 'quarterly') {
      for (let m = 2; m < 12; m += 3) calendar[m] += h.annualDividend / 4;
    } else if (cycle === 'semi-annual') {
      calendar[5] += h.annualDividend / 2;
      calendar[11] += h.annualDividend / 2;
    } else {
      calendar[11] += h.annualDividend;
    }
  }

  return {
    totalInvestment: totalActualInvestment,
    weightedYield,
    expectedAnnualDividend: totalAnnualDiv,
    expectedMonthlyDividendPreTax: totalAnnualDiv / 12,
    expectedMonthlyDividendPostTax: (totalAnnualDiv / 12) * (1 - US_DIVIDEND_TAX_RATE),
    portfolioBeta: Math.round(weightedBeta * 100) / 100,
    avgExpenseRatio,
    avgScore: Math.round(avgScore * 10) / 10,
    sectorDistribution,
    dividendCalendar: calendar.map(v => Math.round(v * 100) / 100),
  };
}

// ==========================================
// Projection
// ==========================================

function calculateProjection(
  metrics: PortfolioMetrics,
  monthlyAdditional: number,
  reinvestDividends: boolean,
  investmentYears: number,
): PortfolioProjection {
  const projYears: number[] = [];
  const projValues: number[] = [];
  const projDividends: number[] = [];
  const projTotalDividends: number[] = [];

  let portfolioValue = metrics.totalInvestment;
  let currentAnnualDiv = metrics.expectedAnnualDividend;
  let totalDividends = 0;

  for (let y = 1; y <= Math.min(investmentYears, 30); y++) {
    // Additional investment
    portfolioValue += monthlyAdditional * 12;

    // Dividend reinvestment
    if (reinvestDividends) {
      portfolioValue += currentAnnualDiv;
    }
    totalDividends += currentAnnualDiv;

    // Growth
    portfolioValue *= (1 + DEFAULT_PRICE_GROWTH);
    currentAnnualDiv = portfolioValue * (metrics.weightedYield / 100);
    currentAnnualDiv *= (1 + DEFAULT_DIVIDEND_GROWTH);

    projYears.push(y);
    projValues.push(Math.round(portfolioValue));
    projDividends.push(Math.round(currentAnnualDiv / 12));
    projTotalDividends.push(Math.round(totalDividends));
  }

  return {
    years: projYears,
    portfolioValues: projValues,
    monthlyDividends: projDividends,
    totalDividends: projTotalDividends,
  };
}

// ==========================================
// Achievability Analysis
// ==========================================

function analyzeAchievability(
  balancedMetrics: PortfolioMetrics,
  targetMonthlyPostTax: number,
  monthlyAdditional: number,
  reinvest: boolean,
): Achievability {
  const current = balancedMetrics.expectedMonthlyDividendPostTax;
  const gap = targetMonthlyPostTax - current;

  if (current >= targetMonthlyPostTax) {
    return {
      isAchievable: true,
      currentMonthlyDividend: Math.round(current * 100) / 100,
      targetMonthlyDividend: targetMonthlyPostTax,
      gap: 0,
      monthsToTarget: 0,
      yearsToTarget: 0,
    };
  }

  // Simulate month-by-month to find when target is reached
  let portfolioValue = balancedMetrics.totalInvestment;
  let monthlyDiv = current;
  let months = 0;
  const maxMonths = 360; // 30 years max

  while (monthlyDiv < targetMonthlyPostTax && months < maxMonths) {
    months++;
    portfolioValue += monthlyAdditional;
    if (reinvest) portfolioValue += monthlyDiv / (1 - US_DIVIDEND_TAX_RATE); // Pre-tax reinvest

    // Monthly growth
    portfolioValue *= (1 + DEFAULT_PRICE_GROWTH / 12);
    const annualDiv = portfolioValue * (balancedMetrics.weightedYield / 100);
    monthlyDiv = (annualDiv / 12) * (1 - US_DIVIDEND_TAX_RATE);

    // Annual dividend growth adjustment
    if (months % 12 === 0) {
      monthlyDiv *= (1 + DEFAULT_DIVIDEND_GROWTH);
    }
  }

  return {
    isAchievable: months < maxMonths,
    currentMonthlyDividend: Math.round(current * 100) / 100,
    targetMonthlyDividend: targetMonthlyPostTax,
    gap: Math.round(gap * 100) / 100,
    monthsToTarget: months < maxMonths ? months : null,
    yearsToTarget: months < maxMonths ? Math.round(months / 12 * 10) / 10 : null,
  };
}

// ==========================================
// Main Entry Point
// ==========================================

export async function recommendPortfolio(request: PortfolioRecommendRequest): Promise<PortfolioRecommendResponse> {
  const { assetType, assets, preferences, exchangeRate } = request;
  const {
    totalInvestment,
    targetMonthlyDividend,
    monthlyAdditionalInvestment,
    reinvestDividends,
    investmentTendency,
    maxHoldings,
    sectorConcentration,
    dividendFrequency,
    investmentYears,
  } = preferences;

  if (!assets || assets.length === 0) {
    throw new Error('No assets provided for portfolio recommendation');
  }

  const sectorLimit = SECTOR_LIMITS[sectorConcentration];

  // Required yield to meet target
  const targetPreTax = targetMonthlyDividend / (1 - US_DIVIDEND_TAX_RATE);
  const targetAnnual = targetPreTax * 12;
  const targetYieldPct = totalInvestment > 0 ? (targetAnnual / totalInvestment) * 100 : 5;

  // Generate 3 portfolio variants
  const tendencyIdx = TENDENCY_ORDER.indexOf(investmentTendency);
  const tendencies: { name: string; tendency: InvestmentTendency; description: string }[] = [
    {
      name: '안정형',
      tendency: TENDENCY_ORDER[Math.max(0, tendencyIdx - 1)],
      description: '낮은 변동성과 안정적인 배당 수입을 우선합니다. 채권/커버드콜 ETF 비중이 높습니다.',
    },
    {
      name: '균형형',
      tendency: investmentTendency,
      description: '배당 수입과 자본 성장의 균형을 추구합니다. 다양한 자산에 분산 투자합니다.',
    },
    {
      name: '성장형',
      tendency: TENDENCY_ORDER[Math.min(TENDENCY_ORDER.length - 1, tendencyIdx + 1)],
      description: '장기 자본 성장을 우선하며 배당 성장 잠재력이 높은 종목에 집중합니다.',
    },
  ];

  // Adjust descriptions for stocks
  if (assetType === 'stock') {
    tendencies[0].description = '낮은 베타의 안정적인 배당주를 중심으로 구성합니다. 변동성을 최소화합니다.';
    tendencies[1].description = '배당 수입과 성장성의 균형을 추구합니다. 다양한 섹터에 분산합니다.';
    tendencies[2].description = '높은 배당 성장 잠재력을 가진 종목에 집중합니다. 변동성이 다소 높을 수 있습니다.';
  }

  const portfolios: PortfolioVariant[] = [];

  for (const variant of tendencies) {
    const allocation = assetType === 'etf'
      ? ETF_ALLOCATIONS[variant.tendency]
      : STOCK_ALLOCATIONS[variant.tendency];

    const scored = scoreAssets(
      assets as (ScreenedStock | ScreenedETF)[],
      assetType,
      variant.tendency,
      dividendFrequency,
      targetYieldPct,
    );

    const holdings = buildPortfolio(
      scored,
      allocation,
      totalInvestment,
      maxHoldings,
      sectorLimit,
      assetType,
    );

    const metrics = calculateMetrics(holdings, totalInvestment, scored, assetType);
    const projection = calculateProjection(metrics, monthlyAdditionalInvestment, reinvestDividends, investmentYears);

    portfolios.push({
      name: variant.name,
      description: variant.description,
      holdings,
      metrics,
      projection,
    });
  }

  // Achievability based on balanced portfolio
  const balancedMetrics = portfolios[1]?.metrics || portfolios[0]?.metrics;
  const achievability = analyzeAchievability(
    balancedMetrics,
    targetMonthlyDividend,
    monthlyAdditionalInvestment,
    reinvestDividends,
  );

  return { portfolios, achievability };
}
