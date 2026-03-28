// ==========================================
// Stock Screening Types
// ==========================================

export interface StockScreeningCriteria {
  minDividendYield: number;    // % (e.g., 2 = 2%)
  minMarketCapUSD: number;     // USD (e.g., 1_000_000_000 = $1B)
  maxPayoutRatio: number;      // % (e.g., 80 = 80%)
  minConsecutiveDividendYears: number;
  maxStocksToCheck: number;
  batchSize: number;
  indexOnly?: boolean;         // true = S&P500+NASDAQ100 only, false = all US dividend stocks
}

export interface ScreenedStock {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  currentPrice: number;
  marketCap: number;           // USD
  marketCapKRW: number;        // KRW (환율 적용)

  // Dividend Data
  dividendYield: number;       // % (e.g., 3.5 = 3.5%)
  annualDividend: number;      // USD per share
  dividendCycle: DividendCycle;
  payoutRatio: number;         // %
  consecutiveDividendYears: number;
  dividendConsistencyScore: number; // 0-100
  exDividendDate?: string;
  paymentDate?: string;

  // Financials
  eps: number;
  pe: number;
  pb?: number;
  ps?: number;
  beta: number;
  roe: number;                 // %
  debtToEquity: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  fcfPayoutRatio?: number;     // %
  revenueGrowth?: number;      // %
  netIncomeGrowth?: number;    // %

  // Scoring
  overallScore: number;        // 0-100
  grade: StockGrade;
  scoreBreakdown: ScoreBreakdown;

  // Metadata
  isREIT: boolean;
  lastUpdated: string;
}

export type DividendCycle = 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'unknown';
export type StockGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';

export interface ScoreBreakdown {
  stability: number;           // 0-100
  profitability: number;       // 0-100
  growth: number;              // 0-100
  valuation: number;           // 0-100
  dividend: number;            // 0-100
}

// ==========================================
// ETF Screening Types
// ==========================================

export interface ETFScreeningCriteria {
  minDividendYield: number;    // decimal (0.02 = 2%)
  minAUM: number;              // USD
  maxExpenseRatio: number;     // decimal (0.005 = 0.5%)
  maxETFsToCheck: number;
  sortBy: 'totalScore' | 'dividendYield' | 'aum';
  limit: number;
}

export interface ScreenedETF {
  symbol: string;
  name: string;
  price: number;
  aum: number;                 // USD
  expenseRatio: number;        // decimal
  dividendYield: number;       // decimal

  // Q-LEAD Scores
  qualityScore: number;        // 0-100
  liquidityScore: number;      // 0-100
  exposureScore: number;       // 0-100
  dividendScore: number;       // 0-100
  totalScore: number;          // 0-100

  // Q-LEAD Grades
  qualityGrade: string;
  liquidityGrade: string;
  exposureGrade: string;
  dividendGrade: string;

  // Additional
  holdingsCount?: number;
  top10Concentration?: number; // %
  dividendGrowth5Y?: number;   // %
  beta?: number;
  isCoveredCall?: boolean;     // covered call ETF

  lastUpdated: string;
}

// ==========================================
// Progress Tracking
// ==========================================

export interface ScreeningProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  processedStocks: number;
  totalStocks: number;
  foundStocks: number;
  progress: number;            // 0-100
  currentSymbol?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;  // seconds
  averageTimePerStock?: number;     // seconds
  skippedStocks?: number;
  screeningOrder?: string;          // 종목 검색 순서 설명
  error?: string;
  results?: ScreenedStock[];
}

export interface ETFScreeningProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  processedETFs: number;
  totalETFs: number;
  foundETFs: number;
  progress: number;
  currentSymbol?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  results?: ScreenedETF[];
}

// ==========================================
// FMP API Response Types
// ==========================================

export interface FMPCompanyProfile {
  symbol: string;
  companyName: string;
  exchange: string;
  exchangeShortName: string;
  sector: string;
  industry: string;
  mktCap: number;
  price: number;
  beta: number;
  lastDiv: number;
  isEtf: boolean;
  isActivelyTrading: boolean;
  description?: string;
  website?: string;
  image?: string;
  country?: string;
}

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  exchange: string;
  pe: number;
  eps: number;
  earningsAnnouncement?: string;
  sharesOutstanding: number;
}

export interface FMPDividendHistorical {
  date: string;
  label: string;
  adjDividend: number;
  dividend: number;
  recordDate?: string;
  paymentDate?: string;
  declarationDate?: string;
}

export interface FMPIncomeStatement {
  date: string;
  revenue: number;
  netIncome: number;
  eps: number;
  epsdiluted: number;
  operatingIncome: number;
  grossProfit: number;
  weightedAverageShsOut: number;
}

export interface FMPBalanceSheet {
  date: string;
  totalDebt: number;
  totalStockholdersEquity: number;
  totalAssets: number;
}

export interface FMPCashFlow {
  date: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  dividendsPaid: number;
  depreciationAndAmortization: number;
}

export interface FMPFinancialRatios {
  date: string;
  dividendYielTTM?: number;
  dividendYielPercentageTTM?: number;
  payoutRatioTTM?: number;
  returnOnEquityTTM?: number;
  returnOnEquity?: number;
  debtEquityRatioTTM?: number;
  debtEquityRatio?: number;
  priceEarningsRatioTTM?: number;
  priceEarningsRatio?: number;
  priceToBookRatioTTM?: number;
  priceToBookRatio?: number;
  priceToSalesRatioTTM?: number;
  priceToSalesRatio?: number;
  [key: string]: unknown;  // FMP returns many extra fields
}

export interface FMPHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

// ==========================================
// Exchange Rate
// ==========================================

export interface ExchangeRateData {
  rate: number;
  source: string;
  lastUpdated: string;
}

// ==========================================
// Portfolio Recommendation
// ==========================================

export type InvestmentTendency = 'conservative' | 'balanced' | 'growth' | 'aggressive';
export type SectorConcentration = 'low' | 'medium' | 'high';
export type DividendFrequencyPref = 'monthly' | 'quarterly' | 'any';

export interface PortfolioRecommendRequest {
  assetType: 'stock' | 'etf';
  assets: ScreenedStock[] | ScreenedETF[];
  preferences: {
    totalInvestment: number;
    targetMonthlyDividend: number;
    monthlyAdditionalInvestment: number;
    reinvestDividends: boolean;
    investmentTendency: InvestmentTendency;
    maxHoldings: number;
    sectorConcentration: SectorConcentration;
    dividendFrequency: DividendFrequencyPref;
    investmentYears: number;
  };
  exchangeRate: number;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  weight: number;
  amount: number;
  shares: number;
  currentPrice: number;
  annualDividend: number;
  monthlyDividend: number;
  dividendYield: number;
  score: number;
  grade: string;
  category: string;
}

export interface PortfolioMetrics {
  totalInvestment: number;
  weightedYield: number;
  expectedAnnualDividend: number;
  expectedMonthlyDividendPreTax: number;
  expectedMonthlyDividendPostTax: number;
  portfolioBeta: number;
  avgExpenseRatio?: number;
  avgScore: number;
  sectorDistribution: Record<string, number>;
  dividendCalendar: number[];
}

export interface PortfolioProjection {
  years: number[];
  portfolioValues: number[];
  monthlyDividends: number[];
  totalDividends: number[];
}

export interface PortfolioVariant {
  name: string;
  description: string;
  holdings: PortfolioHolding[];
  metrics: PortfolioMetrics;
  projection: PortfolioProjection;
}

export interface Achievability {
  isAchievable: boolean;
  currentMonthlyDividend: number;
  targetMonthlyDividend: number;
  gap: number;
  monthsToTarget: number | null;
  yearsToTarget: number | null;
}

export interface PortfolioRecommendResponse {
  portfolios: PortfolioVariant[];
  achievability: Achievability;
}
