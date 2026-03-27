// Frontend types matching backend API responses

export type DividendCycle = 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'unknown';

export type StockGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';

export interface ScoreBreakdown {
  stability: number;
  profitability: number;
  growth: number;
  valuation: number;
  dividend: number;
}

export interface ScreenedStock {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  currentPrice: number;
  marketCap: number;
  marketCapKRW: number;

  dividendYield: number;       // %
  annualDividend: number;
  dividendCycle: DividendCycle;
  payoutRatio: number;         // %
  consecutiveDividendYears: number;
  dividendConsistencyScore: number;
  exDividendDate?: string;
  paymentDate?: string;

  eps: number;
  pe: number;
  pb?: number;
  ps?: number;
  beta: number;
  roe: number;
  debtToEquity: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  fcfPayoutRatio?: number;
  revenueGrowth?: number;
  netIncomeGrowth?: number;

  overallScore: number;
  grade: StockGrade;
  scoreBreakdown: ScoreBreakdown;

  isREIT: boolean;
  lastUpdated: string;
}

export interface ScreenedETF {
  symbol: string;
  name: string;
  price: number;
  aum: number;
  expenseRatio: number;
  dividendYield: number;

  qualityScore: number;
  liquidityScore: number;
  exposureScore: number;
  dividendScore: number;
  totalScore: number;

  qualityGrade: string;
  liquidityGrade: string;
  exposureGrade: string;
  dividendGrade: string;

  holdingsCount?: number;
  top10Concentration?: number;
  dividendGrowth5Y?: number;
  beta?: number;
  isCoveredCall?: boolean;

  lastUpdated: string;
}

export interface ScreeningProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  processedStocks: number;
  totalStocks: number;
  foundStocks: number;
  progress: number;
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

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface PriceDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface DividendHistoryPoint {
  date: string;
  adjDividend: number;
  dividend: number;
  paymentDate?: string;
}
