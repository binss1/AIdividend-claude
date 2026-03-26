import { google, sheets_v4 } from 'googleapis';
import { env } from '../config/env';
import logger from '../utils/logger';
import { ScreenedStock, ScreenedETF } from '../types/index';

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets | null {
  if (sheetsClient) return sheetsClient;

  if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_SPREADSHEET_ID) {
    logger.warn('Google Sheets credentials not configured. Skipping sheets integration.');
    return null;
  }

  try {
    const auth = new google.auth.JWT(
      env.GOOGLE_CLIENT_EMAIL,
      undefined,
      env.GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
  } catch (err) {
    logger.error('Failed to initialize Google Sheets client', (err as Error).message);
    return null;
  }
}

// ==========================================
// Save Stock Screening Results
// ==========================================

export async function saveScreeningResults(stocks: ScreenedStock[]): Promise<boolean> {
  const client = getSheetsClient();
  if (!client) {
    logger.info('Google Sheets not configured, skipping save.');
    return false;
  }

  try {
    const sheetName = 'Stock Screening';
    const timestamp = new Date().toISOString().split('T')[0];

    // Header row
    const headers = [
      'Symbol', 'Name', 'Exchange', 'Sector', 'Industry',
      'Price (USD)', 'Market Cap (USD)', 'Market Cap (KRW)',
      'Dividend Yield (%)', 'Annual Dividend (USD)', 'Dividend Cycle',
      'Payout Ratio (%)', 'Consecutive Div Years', 'Consistency Score',
      'Ex-Dividend Date', 'Payment Date',
      'EPS', 'P/E', 'P/B', 'Beta', 'ROE (%)', 'D/E Ratio',
      'Operating CF', 'Free CF', 'FCF Payout (%)',
      'Revenue Growth (%)', 'NI Growth (%)',
      'Overall Score', 'Grade', 'REIT',
      'Stability', 'Profitability', 'Growth', 'Valuation', 'Dividend Score',
      'Last Updated',
    ];

    // Data rows
    const rows = stocks.map(s => [
      s.symbol, s.name, s.exchange, s.sector, s.industry,
      s.currentPrice, s.marketCap, s.marketCapKRW,
      s.dividendYield, s.annualDividend, s.dividendCycle,
      s.payoutRatio, s.consecutiveDividendYears, s.dividendConsistencyScore,
      s.exDividendDate || '', s.paymentDate || '',
      s.eps, s.pe, s.pb ?? '', s.beta, s.roe, s.debtToEquity,
      s.operatingCashFlow ?? '', s.freeCashFlow ?? '', s.fcfPayoutRatio ?? '',
      s.revenueGrowth ?? '', s.netIncomeGrowth ?? '',
      s.overallScore, s.grade, s.isREIT ? 'Yes' : 'No',
      s.scoreBreakdown.stability, s.scoreBreakdown.profitability,
      s.scoreBreakdown.growth, s.scoreBreakdown.valuation, s.scoreBreakdown.dividend,
      s.lastUpdated,
    ]);

    // Clear existing data and write new
    await client.spreadsheets.values.clear({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      range: `${sheetName}!A:AJ`,
    });

    await client.spreadsheets.values.update({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers, ...rows],
      },
    });

    logger.info(`Saved ${stocks.length} stocks to Google Sheets (${sheetName})`);
    return true;
  } catch (err) {
    logger.error('Failed to save stock results to Google Sheets', (err as Error).message);
    return false;
  }
}

// ==========================================
// Save ETF Screening Results
// ==========================================

export async function saveETFResults(etfs: ScreenedETF[]): Promise<boolean> {
  const client = getSheetsClient();
  if (!client) {
    logger.info('Google Sheets not configured, skipping ETF save.');
    return false;
  }

  try {
    const sheetName = 'ETF Screening';

    const headers = [
      'Symbol', 'Name', 'Price (USD)', 'AUM (USD)', 'Expense Ratio',
      'Dividend Yield (%)', 'Holdings Count', 'Top 10 Concentration (%)',
      'Beta', 'Dividend Growth 5Y (%)',
      'Quality Score', 'Quality Grade',
      'Liquidity Score', 'Liquidity Grade',
      'Exposure Score', 'Exposure Grade',
      'Dividend Score', 'Dividend Grade',
      'Total Q-LEAD Score',
      'Last Updated',
    ];

    const rows = etfs.map(e => [
      e.symbol, e.name, e.price, e.aum, e.expenseRatio,
      (e.dividendYield * 100).toFixed(2), e.holdingsCount ?? '', e.top10Concentration ?? '',
      e.beta ?? '', e.dividendGrowth5Y !== undefined ? (e.dividendGrowth5Y * 100).toFixed(2) : '',
      e.qualityScore, e.qualityGrade,
      e.liquidityScore, e.liquidityGrade,
      e.exposureScore, e.exposureGrade,
      e.dividendScore, e.dividendGrade,
      e.totalScore,
      e.lastUpdated,
    ]);

    await client.spreadsheets.values.clear({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      range: `${sheetName}!A:T`,
    });

    await client.spreadsheets.values.update({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers, ...rows],
      },
    });

    logger.info(`Saved ${etfs.length} ETFs to Google Sheets (${sheetName})`);
    return true;
  } catch (err) {
    logger.error('Failed to save ETF results to Google Sheets', (err as Error).message);
    return false;
  }
}
