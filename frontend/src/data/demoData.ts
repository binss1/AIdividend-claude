// Demo data for landing page preview pages
// Realistic mock data based on actual US dividend stocks and ETFs

import type { ScreenedStock, ScreenedETF } from '@/types';

// Helper to add required fields
function stock(s: Partial<ScreenedStock> & { symbol: string; name: string; currentPrice: number; marketCap: number; overallScore: number; grade: ScreenedStock['grade'] }): ScreenedStock {
  return {
    exchange: 'NYSE', sector: '', industry: '', dividendYield: 0, annualDividend: 0,
    dividendCycle: 'quarterly' as const, payoutRatio: 0, consecutiveDividendYears: 0,
    pe: 0, beta: 0, roe: 0, debtToEquity: 0, isREIT: false,
    scoreBreakdown: { stability: 0, profitability: 0, growth: 0, valuation: 0, dividend: 0 },
    marketCapKRW: s.marketCap * 1500, dividendConsistencyScore: 90,
    eps: s.currentPrice / ((s as any).pe || 15),
    lastUpdated: new Date().toISOString(),
    ...s,
  } as ScreenedStock;
}

export const demoStocks: ScreenedStock[] = [
  stock({
    symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE',
    sector: 'Healthcare', industry: 'Drug Manufacturers',
    currentPrice: 156.42, marketCap: 376800000000,
    dividendYield: 3.21, annualDividend: 5.02, dividendCycle: 'quarterly',
    payoutRatio: 44.2, consecutiveDividendYears: 62,
    pe: 13.8, beta: 0.56, roe: 51.3, debtToEquity: 44.8,
    overallScore: 88, grade: 'A+' as const,
    scoreBreakdown: { stability: 95, profitability: 85, growth: 72, valuation: 82, dividend: 96 },
    isREIT: false,
  }),
  stock({
    symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE',
    sector: 'Consumer Defensive', industry: 'Household Products',
    currentPrice: 165.31, marketCap: 389500000000,
    dividendYield: 2.41, annualDividend: 3.98, dividendCycle: 'quarterly',
    payoutRatio: 62.1, consecutiveDividendYears: 68,
    pe: 25.7, beta: 0.42, roe: 31.2, debtToEquity: 68.3,
    overallScore: 85, grade: 'A' as const,
    scoreBreakdown: { stability: 98, profitability: 78, growth: 65, valuation: 70, dividend: 94 },
    isREIT: false,
  }),
  stock({
    symbol: 'KO', name: 'Coca-Cola Company', exchange: 'NYSE',
    sector: 'Consumer Defensive', industry: 'Beverages',
    currentPrice: 62.18, marketCap: 268900000000,
    dividendYield: 3.05, annualDividend: 1.90, dividendCycle: 'quarterly',
    payoutRatio: 71.4, consecutiveDividendYears: 61,
    pe: 23.4, beta: 0.58, roe: 40.8, debtToEquity: 156.2,
    overallScore: 83, grade: 'A' as const,
    scoreBreakdown: { stability: 96, profitability: 80, growth: 58, valuation: 68, dividend: 92 },
    isREIT: false,
  }),
  stock({
    symbol: 'ABBV', name: 'AbbVie Inc.', exchange: 'NYSE',
    sector: 'Healthcare', industry: 'Drug Manufacturers',
    currentPrice: 178.56, marketCap: 315200000000,
    dividendYield: 3.44, annualDividend: 6.14, dividendCycle: 'quarterly',
    payoutRatio: 52.8, consecutiveDividendYears: 52,
    pe: 15.3, beta: 0.72, roe: 62.4, debtToEquity: 345.8,
    overallScore: 81, grade: 'A' as const,
    scoreBreakdown: { stability: 88, profitability: 82, growth: 70, valuation: 76, dividend: 90 },
    isREIT: false,
  }),
  stock({
    symbol: 'O', name: 'Realty Income Corporation', exchange: 'NYSE',
    sector: 'Real Estate', industry: 'REIT - Retail',
    currentPrice: 57.83, marketCap: 50100000000,
    dividendYield: 5.32, annualDividend: 3.08, dividendCycle: 'monthly',
    payoutRatio: 75.6, consecutiveDividendYears: 28,
    pe: 14.2, beta: 0.68, roe: 3.8, debtToEquity: 72.4,
    overallScore: 79, grade: 'B+' as const,
    scoreBreakdown: { stability: 85, profitability: 60, growth: 55, valuation: 80, dividend: 95 },
    isREIT: true,
  }),
  stock({
    symbol: 'PEP', name: 'PepsiCo, Inc.', exchange: 'NASDAQ',
    sector: 'Consumer Defensive', industry: 'Beverages',
    currentPrice: 148.72, marketCap: 203600000000,
    dividendYield: 3.52, annualDividend: 5.24, dividendCycle: 'quarterly',
    payoutRatio: 68.9, consecutiveDividendYears: 51,
    pe: 19.6, beta: 0.54, roe: 48.2, debtToEquity: 212.5,
    overallScore: 78, grade: 'B+' as const,
    scoreBreakdown: { stability: 94, profitability: 75, growth: 52, valuation: 64, dividend: 91 },
    isREIT: false,
  }),
  stock({
    symbol: 'TROW', name: 'T. Rowe Price Group', exchange: 'NASDAQ',
    sector: 'Financial Services', industry: 'Asset Management',
    currentPrice: 89.91, marketCap: 19600000000,
    dividendYield: 5.78, annualDividend: 5.20, dividendCycle: 'quarterly',
    payoutRatio: 56.3, consecutiveDividendYears: 38,
    pe: 9.7, beta: 1.55, roe: 25.4, debtToEquity: 0.1,
    overallScore: 76, grade: 'B+' as const,
    scoreBreakdown: { stability: 82, profitability: 70, growth: 55, valuation: 78, dividend: 88 },
    isREIT: false,
  }),
  stock({
    symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE',
    sector: 'Energy', industry: 'Oil & Gas Integrated',
    currentPrice: 108.24, marketCap: 452300000000,
    dividendYield: 3.48, annualDividend: 3.76, dividendCycle: 'quarterly',
    payoutRatio: 42.1, consecutiveDividendYears: 41,
    pe: 12.1, beta: 0.87, roe: 18.6, debtToEquity: 22.5,
    overallScore: 74, grade: 'B+' as const,
    scoreBreakdown: { stability: 78, profitability: 72, growth: 68, valuation: 80, dividend: 82 },
    isREIT: false,
  }),
  stock({
    symbol: 'VZ', name: 'Verizon Communications', exchange: 'NYSE',
    sector: 'Communication Services', industry: 'Telecom',
    currentPrice: 42.56, marketCap: 178900000000,
    dividendYield: 6.18, annualDividend: 2.63, dividendCycle: 'quarterly',
    payoutRatio: 56.8, consecutiveDividendYears: 18,
    pe: 9.2, beta: 0.38, roe: 22.1, debtToEquity: 158.4,
    overallScore: 72, grade: 'B+' as const,
    scoreBreakdown: { stability: 80, profitability: 65, growth: 42, valuation: 82, dividend: 86 },
    isREIT: false,
  }),
  stock({
    symbol: 'MMM', name: '3M Company', exchange: 'NYSE',
    sector: 'Industrials', industry: 'Conglomerates',
    currentPrice: 105.32, marketCap: 58200000000,
    dividendYield: 2.38, annualDividend: 2.51, dividendCycle: 'quarterly',
    payoutRatio: 38.5, consecutiveDividendYears: 25,
    pe: 16.2, beta: 1.02, roe: 38.7, debtToEquity: 112.3,
    overallScore: 70, grade: 'B+' as const,
    scoreBreakdown: { stability: 72, profitability: 68, growth: 60, valuation: 72, dividend: 78 },
    isREIT: false,
  }),
];

export const demoETFs: ScreenedETF[] = [
  { symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', price: 82.45, aum: 62800000000, expenseRatio: 0.0006, dividendYield: 0.0348, beta: 0.82, holdingsCount: 103, qualityScore: 92, liquidityScore: 95, exposureScore: 85, dividendScore: 88, totalScore: 90, qualityGrade: 'A+', liquidityGrade: 'A+', exposureGrade: 'A', dividendGrade: 'A', isCoveredCall: false, lastUpdated: '' },
  { symbol: 'VYM', name: 'Vanguard High Dividend Yield ETF', price: 121.32, aum: 55400000000, expenseRatio: 0.0006, dividendYield: 0.0285, beta: 0.78, holdingsCount: 536, qualityScore: 88, liquidityScore: 94, exposureScore: 90, dividendScore: 82, totalScore: 88, qualityGrade: 'A', liquidityGrade: 'A+', exposureGrade: 'A+', dividendGrade: 'A', isCoveredCall: false, lastUpdated: '' },
  { symbol: 'HDV', name: 'iShares Core High Dividend ETF', price: 112.86, aum: 10800000000, expenseRatio: 0.0008, dividendYield: 0.0372, beta: 0.72, holdingsCount: 75, qualityScore: 85, liquidityScore: 88, exposureScore: 78, dividendScore: 90, totalScore: 85, qualityGrade: 'A', liquidityGrade: 'A', exposureGrade: 'B+', dividendGrade: 'A+', isCoveredCall: false, lastUpdated: '' },
  { symbol: 'JEPI', name: 'JPMorgan Equity Premium Income ETF', price: 57.42, aum: 35600000000, expenseRatio: 0.0035, dividendYield: 0.0715, beta: 0.55, holdingsCount: 130, qualityScore: 82, liquidityScore: 92, exposureScore: 72, dividendScore: 95, totalScore: 84, qualityGrade: 'A', liquidityGrade: 'A+', exposureGrade: 'B+', dividendGrade: 'A+', isCoveredCall: true, lastUpdated: '' },
  { symbol: 'DGRO', name: 'iShares Core Dividend Growth ETF', price: 58.92, aum: 27300000000, expenseRatio: 0.0008, dividendYield: 0.0228, beta: 0.85, holdingsCount: 420, qualityScore: 90, liquidityScore: 90, exposureScore: 88, dividendScore: 75, totalScore: 83, qualityGrade: 'A+', liquidityGrade: 'A', exposureGrade: 'A', dividendGrade: 'B+', isCoveredCall: false, lastUpdated: '' },
  { symbol: 'JEPQ', name: 'JPMorgan Nasdaq Equity Premium Income ETF', price: 52.18, aum: 18900000000, expenseRatio: 0.0035, dividendYield: 0.0942, beta: 0.65, holdingsCount: 85, qualityScore: 78, liquidityScore: 88, exposureScore: 68, dividendScore: 96, totalScore: 82, qualityGrade: 'B+', liquidityGrade: 'A', exposureGrade: 'B', dividendGrade: 'A+', isCoveredCall: true, lastUpdated: '' },
  { symbol: 'DIVO', name: 'Amplify CWP Enhanced Dividend Income ETF', price: 36.72, aum: 3500000000, expenseRatio: 0.0055, dividendYield: 0.0465, beta: 0.68, holdingsCount: 25, qualityScore: 80, liquidityScore: 72, exposureScore: 65, dividendScore: 88, totalScore: 76, qualityGrade: 'A', liquidityGrade: 'B+', exposureGrade: 'B', dividendGrade: 'A', isCoveredCall: true, lastUpdated: '' },
  { symbol: 'SPYD', name: 'SPDR Portfolio S&P 500 High Dividend ETF', price: 42.86, aum: 7800000000, expenseRatio: 0.0007, dividendYield: 0.0412, beta: 0.88, holdingsCount: 80, qualityScore: 74, liquidityScore: 85, exposureScore: 82, dividendScore: 85, totalScore: 80, qualityGrade: 'B+', liquidityGrade: 'A', exposureGrade: 'A', dividendGrade: 'A', isCoveredCall: false, lastUpdated: '' },
];

// Helper to compute grade from score
export function gradeFromScore(score: number): string {
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B+';
  if (score >= 55) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}
