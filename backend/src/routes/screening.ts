import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import {
  screenDividendStocks,
  getStockDetail,
  getDividendHistory,
  getHistoricalPrices,
  getQuote,
  getSP500Constituents,
  getNasdaqConstituents,
  getAllUSDividendStocks,
  fmpClient,
  getDCF,
  getRating,
  getPriceTarget,
  getStockPeers,
  getSectorPerformance,
  getEconomicCalendar,
  getStockNews,
  getInsiderTrading,
  getInstitutionalHolders,
  getSocialSentiment,
  getAnalystEstimates,
} from '../services/fmpService';
import { screenDividendETFs, getETFList } from '../services/etfScreeningService';
import { getExchangeRate } from '../services/exchangeRateService';
import { recommendPortfolio } from '../services/portfolioRecommendService';
import { saveScreeningSession, getSessionList, getSessionDetail, deleteSession } from '../services/dbService';
import { saveScreeningResults, saveETFResults } from '../services/googleSheetsService';
import logger from '../utils/logger';
import {
  StockScreeningCriteria,
  ETFScreeningCriteria,
  ScreeningProgress,
  ETFScreeningProgress,
  ScreenedStock,
  ScreenedETF,
} from '../types/index';

const router = Router();

// ==========================================
// Module-level Progress State
// ==========================================

let stockScreeningProgress: ScreeningProgress = {
  status: 'idle',
  processedStocks: 0,
  totalStocks: 0,
  foundStocks: 0,
  progress: 0,
};

let stockScreeningCancelled = false;
let etfScreeningCancelled = false;

let etfScreeningProgress: ETFScreeningProgress = {
  status: 'idle',
  processedETFs: 0,
  totalETFs: 0,
  foundETFs: 0,
  progress: 0,
};

// ==========================================
// Universe Info (cached for 10 min)
// ==========================================

// Cache keyed by filter params (valid 10 min)
const _universeCache = new Map<string, { stockTotal: number; etfTotal: number; rate: number; fetchedAt: number }>();

router.get('/universe-info', async (req: Request, res: Response) => {
  try {
    const indexOnly = req.query.indexOnly !== 'false';
    const minMarketCapUSD = parseFloat(req.query.minMarketCapUSD as string) || 0;
    const minAUM = parseFloat(req.query.minAUM as string) || 0;
    const now = Date.now();

    const cacheKey = `idx${indexOnly}_mc${minMarketCapUSD}_aum${minAUM}`;
    const cached = _universeCache.get(cacheKey);

    if (cached && now - cached.fetchedAt < 600_000) {
      res.json(cached);
      return;
    }

    let stockTotal: number;

    if (indexOnly) {
      const [sp500, nasdaq] = await Promise.all([
        getSP500Constituents(),
        getNasdaqConstituents(),
      ]);
      const symbolSet = new Set<string>();
      for (const s of sp500) symbolSet.add(s.symbol);
      for (const s of nasdaq) symbolSet.add(s.symbol);
      stockTotal = symbolSet.size;
    } else {
      // Pass minMarketCap to FMP API for pre-filtering
      const allStocks = await getAllUSDividendStocks(
        minMarketCapUSD > 0 ? { minMarketCapUSD } : undefined
      );
      stockTotal = allStocks.length;
    }

    const [etfList, exchangeRateData] = await Promise.all([
      getETFList(minAUM > 0 ? { minAUM } : undefined).catch(() => [] as { symbol: string; name: string }[]),
      getExchangeRate(),
    ]);

    const result = {
      stockTotal,
      etfTotal: etfList.length,
      rate: exchangeRateData.rate,
      fetchedAt: now,
    };

    _universeCache.set(cacheKey, result);

    logger.info(`[API] Universe info (indexOnly=${indexOnly}, mcap≥$${(minMarketCapUSD / 1e9).toFixed(1)}B, aum≥$${(minAUM / 1e6).toFixed(0)}M): stocks=${stockTotal}, ETFs=${etfList.length}, rate=${exchangeRateData.rate}`);
    res.json(result);
  } catch (err) {
    logger.error(`[API] Universe info error: ${(err as Error).message}`);
    res.json({ stockTotal: 3500, etfTotal: 500, rate: 1400, fetchedAt: Date.now() });
  }
});

// ==========================================
// Stock Screening Endpoints
// ==========================================

/**
 * GET /stock-screening
 * Start stock screening (runs async, poll progress with /stock-screening-progress)
 */
router.get('/stock-screening', optionalAuth, async (req: Request, res: Response) => {
  try {
    // Don't start if already running
    if (stockScreeningProgress.status === 'running') {
      res.status(409).json({
        error: 'Stock screening is already in progress.',
        progress: stockScreeningProgress,
      });
      return;
    }

    // Parse criteria from query params
    const criteria: StockScreeningCriteria = {
      minDividendYield: parseFloat(req.query.minDividendYield as string) || 2,
      minMarketCapUSD: parseFloat(req.query.minMarketCapUSD as string) || 1_000_000_000,
      maxPayoutRatio: parseFloat(req.query.maxPayoutRatio as string) || 85,
      minConsecutiveDividendYears: parseInt(req.query.minConsecutiveDividendYears as string, 10) || 3,
      maxStocksToCheck: parseInt(req.query.maxStocksToCheck as string, 10) || 1000,
      batchSize: parseInt(req.query.batchSize as string, 10) || 10,
      indexOnly: req.query.indexOnly !== 'false',  // default true
    };

    // Initialize progress
    stockScreeningProgress = {
      status: 'running',
      processedStocks: 0,
      totalStocks: 0,
      foundStocks: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
    };

    logger.info(`[API] 배당주 스크리닝 요청 - 조건: 수익률≥${criteria.minDividendYield}%, 시총≥$${(criteria.minMarketCapUSD / 1e9).toFixed(1)}B, 성향≤${criteria.maxPayoutRatio}%, 최대${criteria.maxStocksToCheck}종목`);

    stockScreeningCancelled = false;
    // Start screening in background
    (async () => {
      try {
        const { results, skipSummary } = await screenDividendStocks(criteria, (progress) => {
          // Check cancellation
          if (stockScreeningCancelled) {
            throw new Error('CANCELLED');
          }
          stockScreeningProgress = {
            ...stockScreeningProgress,
            ...progress,
          };
        });

        stockScreeningProgress = {
          status: 'completed',
          processedStocks: stockScreeningProgress.processedStocks,
          totalStocks: stockScreeningProgress.totalStocks,
          foundStocks: results.length,
          progress: 100,
          startedAt: stockScreeningProgress.startedAt,
          completedAt: new Date().toISOString(),
          results,
          skipSummary,
        };

        // Save to Google Sheets (non-blocking)
        saveScreeningResults(results).catch(err => {
          logger.error('Background sheets save failed', (err as Error).message);
        });

        // Save to SQLite (non-blocking, include skipSummary in criteria)
        try {
          saveScreeningSession('stock', { ...criteria, skipSummary }, results);
          logger.info(`[DB] 배당주 스크리닝 결과 저장 완료: ${results.length}종목`);
        } catch (dbErr) {
          logger.error('[DB] 배당주 결과 저장 실패', (dbErr as Error).message);
        }

        const elapsed = stockScreeningProgress.startedAt
          ? ((Date.now() - new Date(stockScreeningProgress.startedAt).getTime()) / 1000).toFixed(0)
          : '?';
        logger.info(`[API] 스크리닝 완료: ${results.length}개 종목 발견, 총 ${elapsed}초 소요`);
      } catch (err) {
        const errMsg = (err as Error).message;
        if (errMsg === 'CANCELLED') {
          logger.info('[API] 배당주 스크리닝 중단됨 (사용자 요청)');
          stockScreeningProgress = {
            ...stockScreeningProgress,
            status: 'idle',
            completedAt: new Date().toISOString(),
          };
        } else {
          logger.error('[API] 스크리닝 실패:', errMsg);
          stockScreeningProgress = {
            ...stockScreeningProgress,
            status: 'error',
            error: errMsg,
            completedAt: new Date().toISOString(),
          };
        }
      }
    })();

    res.json({
      message: 'Stock screening started',
      criteria,
      progress: stockScreeningProgress,
    });
  } catch (err) {
    logger.error('Failed to start stock screening', (err as Error).message);
    res.status(500).json({ error: 'Failed to start stock screening' });
  }
});

/**
 * GET /stock-screening-progress
 * Get current stock screening progress and results
 */
router.get('/stock-screening-progress', optionalAuth, (_req: Request, res: Response) => {
  res.json(stockScreeningProgress);
});

/**
 * POST /stock-screening-cancel
 * Cancel running stock screening
 */
router.post('/stock-screening-cancel', optionalAuth, (_req: Request, res: Response) => {
  if (stockScreeningProgress.status !== 'running') {
    res.json({ success: false, message: 'No screening in progress' });
    return;
  }
  stockScreeningCancelled = true;
  logger.info('[API] 배당주 스크리닝 중단 요청');
  res.json({ success: true });
});

/**
 * POST /etf-screening-cancel
 * Cancel running ETF screening
 */
router.post('/etf-screening-cancel', optionalAuth, (_req: Request, res: Response) => {
  if (etfScreeningProgress.status !== 'running') {
    res.json({ success: false, message: 'No ETF screening in progress' });
    return;
  }
  etfScreeningCancelled = true;
  logger.info('[API] ETF 스크리닝 중단 요청');
  res.json({ success: true });
});

// ==========================================
// ETF Screening Endpoints
// ==========================================

/**
 * POST /etf-screening
 * Start ETF screening
 */
router.post('/etf-screening', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (etfScreeningProgress.status === 'running') {
      res.status(409).json({
        error: 'ETF screening is already in progress.',
        progress: etfScreeningProgress,
      });
      return;
    }

    const body = req.body || {};
    const criteria: ETFScreeningCriteria = {
      minDividendYield: body.minDividendYield ?? 0.02,
      minAUM: body.minAUM ?? 100_000_000,
      maxExpenseRatio: body.maxExpenseRatio ?? 0.01,
      maxETFsToCheck: body.maxETFsToCheck ?? 200,
      sortBy: body.sortBy ?? 'totalScore',
      limit: body.limit ?? 50,
    };

    etfScreeningProgress = {
      status: 'running',
      processedETFs: 0,
      totalETFs: 0,
      foundETFs: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
    };

    (async () => {
      try {
        const results = await screenDividendETFs(criteria, (progress) => {
          etfScreeningProgress = {
            ...etfScreeningProgress,
            ...progress,
          };
        });

        etfScreeningProgress = {
          status: 'completed',
          processedETFs: etfScreeningProgress.processedETFs,
          totalETFs: etfScreeningProgress.totalETFs,
          foundETFs: results.length,
          progress: 100,
          startedAt: etfScreeningProgress.startedAt,
          completedAt: new Date().toISOString(),
          results,
        };

        saveETFResults(results).catch(err => {
          logger.error('Background ETF sheets save failed', (err as Error).message);
        });

        // Save to SQLite (non-blocking)
        try {
          saveScreeningSession('etf', criteria, results);
          logger.info(`[DB] ETF 스크리닝 결과 저장 완료: ${results.length}종목`);
        } catch (dbErr) {
          logger.error('[DB] ETF 결과 저장 실패', (dbErr as Error).message);
        }

        logger.info(`ETF screening completed: ${results.length} ETFs found`);
      } catch (err) {
        logger.error('ETF screening failed', (err as Error).message);
        etfScreeningProgress = {
          ...etfScreeningProgress,
          status: 'error',
          error: (err as Error).message,
          completedAt: new Date().toISOString(),
        };
      }
    })();

    res.json({
      message: 'ETF screening started',
      criteria,
      progress: etfScreeningProgress,
    });
  } catch (err) {
    logger.error('Failed to start ETF screening', (err as Error).message);
    res.status(500).json({ error: 'Failed to start ETF screening' });
  }
});

/**
 * GET /etf-screening-progress
 */
router.get('/etf-screening-progress', optionalAuth, (_req: Request, res: Response) => {
  res.json(etfScreeningProgress);
});

// ==========================================
// ETF Detail Endpoints
// ==========================================

import { getETFDetail, getETFHoldingsData } from '../services/etfScreeningService';

/**
 * GET /etf/:symbol
 * Get ETF detail with Q-LEAD scoring
 */
router.get('/etf/:symbol', optionalAuth, async (req: Request, res: Response) => {
  try {
    const symbol = (req.params.symbol as string).toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    const detail = await getETFDetail(symbol);
    if (!detail) {
      res.status(404).json({ error: `ETF ${symbol} not found` });
      return;
    }

    res.json(detail);
  } catch (err) {
    logger.error(`Failed to get ETF detail for ${req.params.symbol}`, (err as Error).message);
    res.status(500).json({ error: 'Failed to get ETF detail' });
  }
});

/**
 * GET /etf/:symbol/holdings
 * Get ETF top holdings
 */
router.get('/etf/:symbol/holdings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const symbol = (req.params.symbol as string).toUpperCase();
    const holdings = await getETFHoldingsData(symbol);
    res.json({ symbol, count: holdings.length, holdings });
  } catch (err) {
    logger.error(`Failed to get ETF holdings for ${req.params.symbol}`, (err as Error).message);
    res.status(500).json({ error: 'Failed to get ETF holdings' });
  }
});

// ==========================================
// Market Insight Endpoints (2단계)
// ==========================================

router.get('/sector-performance', async (_req: Request, res: Response) => {
  try {
    const data = await getSectorPerformance();
    res.json({ sectors: data });
  } catch (err) {
    logger.error('Failed to get sector performance', (err as Error).message);
    res.status(500).json({ error: 'Failed to get sector performance' });
  }
});

router.get('/economic-calendar', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const from = req.query.from as string || now.toISOString().split('T')[0];
    const toDate = new Date(now);
    toDate.setDate(toDate.getDate() + 14);
    const to = req.query.to as string || toDate.toISOString().split('T')[0];
    const data = await getEconomicCalendar(from, to);
    // Filter US events, sort by date ASC, CFTC last within same date
    const usEvents = data
      .filter(e => e.country === 'US')
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        // Same date: non-CFTC first
        const aCftc = a.event.includes('CFTC') ? 1 : 0;
        const bCftc = b.event.includes('CFTC') ? 1 : 0;
        return aCftc - bCftc;
      })
      .slice(0, 40);
    res.json({ events: usEvents, from, to });
  } catch (err) {
    logger.error('Failed to get economic calendar', (err as Error).message);
    res.status(500).json({ error: 'Failed to get economic calendar' });
  }
});

router.get('/stock-news', async (req: Request, res: Response) => {
  try {
    const tickers = req.query.tickers as string || 'AAPL,MSFT';
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await getStockNews(tickers, limit);
    res.json({ news: data });
  } catch (err) {
    logger.error('Failed to get stock news', (err as Error).message);
    res.status(500).json({ error: 'Failed to get stock news' });
  }
});

// ==========================================
// Market Overview Endpoint (must be before /stock/:symbol)
// ==========================================

/**
 * GET /market-overview
 * Get real-time market indices (S&P 500, NASDAQ, 10Y Treasury, VIX)
 */
router.get('/market-overview', async (_req: Request, res: Response) => {
  try {
    const symbols = ['^GSPC', '^IXIC', '^TNX', '^VIX'];
    const labels = ['S&P 500', 'NASDAQ', '미국 10년물 금리', 'VIX'];

    const results = await Promise.allSettled(
      symbols.map(s => getQuote(s))
    );

    const overview = results.map((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        const q = result.value;
        return {
          symbol: symbols[i],
          label: labels[i],
          price: q.price,
          change: q.change,
          changesPercentage: q.changesPercentage,
        };
      }
      return {
        symbol: symbols[i],
        label: labels[i],
        price: null,
        change: null,
        changesPercentage: null,
      };
    });

    res.json(overview);
  } catch (err) {
    logger.error('Failed to get market overview', (err as Error).message);
    res.status(500).json({ error: 'Failed to get market overview' });
  }
});

// ==========================================
// Stock Detail Endpoints
// ==========================================

/**
 * GET /stock/:symbol
 * Get detailed stock information
 */
router.get('/stock/:symbol', optionalAuth, async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    const detail = await getStockDetail(symbol.toUpperCase());
    if (!detail) {
      res.status(404).json({ error: `Stock ${symbol} not found or has no dividend data` });
      return;
    }

    // Fetch valuation + advanced data in parallel (non-blocking, optional)
    const [dcf, rating, priceTarget, peers, insider, institutional, sentiment, estimates] = await Promise.allSettled([
      getDCF(symbol.toUpperCase()),
      getRating(symbol.toUpperCase()),
      getPriceTarget(symbol.toUpperCase()),
      getStockPeers(symbol.toUpperCase()),
      getInsiderTrading(symbol.toUpperCase(), 10),
      getInstitutionalHolders(symbol.toUpperCase()),
      getSocialSentiment(symbol.toUpperCase()),
      getAnalystEstimates(symbol.toUpperCase(), 4),
    ]);

    res.json({
      ...detail,
      dcf: dcf.status === 'fulfilled' ? dcf.value : null,
      rating: rating.status === 'fulfilled' ? rating.value : null,
      priceTarget: priceTarget.status === 'fulfilled' ? priceTarget.value : null,
      peers: peers.status === 'fulfilled' ? peers.value : [],
      insiderTrading: insider.status === 'fulfilled' ? insider.value : [],
      institutionalHolders: institutional.status === 'fulfilled' ? institutional.value : [],
      socialSentiment: sentiment.status === 'fulfilled' ? sentiment.value : [],
      analystEstimates: estimates.status === 'fulfilled' ? estimates.value : [],
    });
  } catch (err) {
    logger.error(`Failed to get stock detail for ${req.params.symbol}`, (err as Error).message);
    res.status(500).json({ error: 'Failed to get stock detail' });
  }
});

/**
 * GET /stock/:symbol/historical
 * Get historical price data
 */
router.get('/stock/:symbol/historical', optionalAuth, async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const from = (req.query.from as string) || getDateNMonthsAgo(12);
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const prices = await getHistoricalPrices(symbol.toUpperCase(), from, to);

    res.json({
      symbol: symbol.toUpperCase(),
      from,
      to,
      count: prices.length,
      prices,
    });
  } catch (err) {
    logger.error(`Failed to get historical prices for ${req.params.symbol}`, (err as Error).message);
    res.status(500).json({ error: 'Failed to get historical prices' });
  }
});

/**
 * GET /stock/:symbol/dividend-history
 * Get dividend payment history
 */
router.get('/stock/:symbol/dividend-history', optionalAuth, async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const allDividends = await getDividendHistory(symbol.toUpperCase());

    // Limit to last 10 years
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const cutoff = tenYearsAgo.toISOString().split('T')[0];
    const dividends = allDividends.filter(d => d.date >= cutoff);

    res.json({
      symbol: symbol.toUpperCase(),
      count: dividends.length,
      dividends,
    });
  } catch (err) {
    logger.error(`Failed to get dividend history for ${req.params.symbol}`, (err as Error).message);
    res.status(500).json({ error: 'Failed to get dividend history' });
  }
});

// ==========================================
// Dividend Calendar
// ==========================================

router.get('/dividend-calendar', optionalAuth, async (req: Request, res: Response) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const toDate = new Date(from);
    toDate.setMonth(toDate.getMonth() + 3);
    const to = (req.query.to as string) || toDate.toISOString().split('T')[0];

    logger.info(`📅 배당 캘린더 조회: ${from} ~ ${to}`);

    const response = await fmpClient.get('/v3/stock_dividend_calendar', {
      params: { from, to },
    });

    const allEvents = response.data || [];

    // Filter: US exchanges only, valid data
    const usExchanges = new Set(['NYSE', 'NASDAQ', 'AMEX']);
    const usSymbols = allEvents.filter((e: any) =>
      e.symbol &&
      !e.symbol.includes('.') &&  // exclude foreign stocks like 0DWV.L, 7279.T
      e.date &&
      e.dividend > 0
    );

    // Get quote data for enrichment (batch by 50)
    const symbols = [...new Set(usSymbols.map((e: any) => e.symbol))].slice(0, 500);
    let quoteMap: Record<string, any> = {};

    // Batch fetch quotes in groups of 50
    for (let i = 0; i < symbols.length; i += 50) {
      const batch = symbols.slice(i, i + 50);
      try {
        const quoteRes = await fmpClient.get('/v3/quote/' + batch.join(','));
        for (const q of (quoteRes.data || [])) {
          quoteMap[q.symbol] = q;
        }
      } catch { /* skip batch on error */ }
    }

    const enriched = usSymbols.map((e: any) => {
      const quote = quoteMap[e.symbol];
      return {
        symbol: e.symbol,
        name: quote?.name || e.symbol,
        exDividendDate: e.date,
        recordDate: e.recordDate || null,
        paymentDate: e.paymentDate || null,
        declarationDate: e.declarationDate || null,
        dividend: e.dividend,
        dividendYield: quote ? (e.dividend * 4 / quote.price * 100) : null,
        price: quote?.price || null,
        exchange: quote?.exchange || null,
      };
    });

    // Sort by ex-dividend date
    enriched.sort((a: any, b: any) => a.exDividendDate.localeCompare(b.exDividendDate));

    logger.info(`📅 배당 캘린더: ${enriched.length}건 반환 (${from} ~ ${to})`);

    res.json({
      from,
      to,
      totalEvents: enriched.length,
      events: enriched,
    });
  } catch (err) {
    logger.error('Failed to get dividend calendar', (err as Error).message);
    res.status(500).json({ error: 'Failed to get dividend calendar' });
  }
});

// ==========================================
// Portfolio Simulator
// ==========================================

router.post('/portfolio-simulate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      stocks,           // [{symbol, shares, avgPrice?}]
      additionalMonthly = 0,
      years = 10,
      dividendReinvest = true,
      dividendGrowthRate = 5, // annual % increase in dividend
      priceGrowthRate = 7,    // annual % price appreciation
    } = req.body;

    if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
      return res.status(400).json({ error: 'stocks array required' });
    }

    logger.info(`💰 포트폴리오 시뮬레이션: ${stocks.length}종목, ${years}년, DRIP=${dividendReinvest}`);

    // Fetch current data for all symbols
    const symbols = stocks.map((s: any) => s.symbol);
    const quoteRes = await fmpClient.get('/v3/quote/' + symbols.join(','));
    const quotes: Record<string, any> = {};
    for (const q of (quoteRes.data || [])) {
      quotes[q.symbol] = q;
    }

    // Fetch dividend history for each stock
    const dividendData: Record<string, { annualDividend: number; frequency: number }> = {};
    for (const s of stocks) {
      try {
        const divRes = await fmpClient.get(`/v3/historical-price-full/stock_dividend/${s.symbol}`);
        const history = divRes.data?.historical || [];

        // Calculate annual dividend from last 12 months
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const recentDivs = history.filter((d: any) => new Date(d.date) >= oneYearAgo);
        const annualDiv = recentDivs.reduce((sum: number, d: any) => sum + (d.dividend || 0), 0);
        const freq = recentDivs.length || 4; // default quarterly

        dividendData[s.symbol] = { annualDividend: annualDiv, frequency: freq };
      } catch {
        dividendData[s.symbol] = { annualDividend: 0, frequency: 4 };
      }
    }

    // Build portfolio holdings
    const holdings = stocks.map((s: any) => {
      const quote = quotes[s.symbol];
      const price = quote?.price || s.avgPrice || 0;
      const shares = s.shares || 0;
      const divInfo = dividendData[s.symbol] || { annualDividend: 0, frequency: 4 };

      return {
        symbol: s.symbol,
        name: quote?.name || s.symbol,
        shares,
        currentPrice: price,
        avgPrice: s.avgPrice || price,
        marketValue: shares * price,
        annualDividend: divInfo.annualDividend,
        dividendYield: price > 0 ? (divInfo.annualDividend / price * 100) : 0,
        frequency: divInfo.frequency,
      };
    });

    // === SIMULATION ENGINE ===
    // Month-by-month simulation with compound growth
    const monthlyDivGrowth = Math.pow(1 + dividendGrowthRate / 100, 1/12);
    const monthlyPriceGrowth = Math.pow(1 + priceGrowthRate / 100, 1/12);
    const totalMonths = years * 12;

    // Track portfolio state
    let totalShares: Record<string, number> = {};
    let sharePrice: Record<string, number> = {};
    let annualDiv: Record<string, number> = {};

    for (const h of holdings) {
      totalShares[h.symbol] = h.shares;
      sharePrice[h.symbol] = h.currentPrice;
      annualDiv[h.symbol] = h.annualDividend;
    }

    const initialInvestment = holdings.reduce((s, h) => s + h.marketValue, 0);
    let totalDividendsReceived = 0;
    let totalAdditionalInvested = 0;

    // Yearly snapshots for chart
    const yearlySnapshots: Array<{
      year: number;
      portfolioValue: number;
      totalDividends: number;
      totalInvested: number;
      annualDividendIncome: number;
      dividendYield: number;
    }> = [];

    // Year 0 snapshot
    yearlySnapshots.push({
      year: 0,
      portfolioValue: initialInvestment,
      totalDividends: 0,
      totalInvested: initialInvestment,
      annualDividendIncome: holdings.reduce((s, h) => s + h.annualDividend * h.shares, 0),
      dividendYield: initialInvestment > 0
        ? (holdings.reduce((s, h) => s + h.annualDividend * h.shares, 0) / initialInvestment * 100)
        : 0,
    });

    for (let month = 1; month <= totalMonths; month++) {
      // 1. Price growth
      for (const sym of symbols) {
        sharePrice[sym] *= monthlyPriceGrowth;
      }

      // 2. Dividend growth (annually, applied in January)
      if (month % 12 === 1 && month > 1) {
        for (const sym of symbols) {
          annualDiv[sym] *= (1 + dividendGrowthRate / 100);
        }
      }

      // 3. Pay dividends (monthly simulation of quarterly/monthly payments)
      let monthlyDividend = 0;
      for (const sym of symbols) {
        const freq = dividendData[sym]?.frequency || 4;
        const divPerPayment = annualDiv[sym] / freq;

        // Simulate payment months based on frequency
        const isPaymentMonth = freq === 12 || // monthly
          (freq === 4 && month % 3 === 0) || // quarterly
          (freq === 2 && month % 6 === 0) || // semi-annual
          (freq === 1 && month % 12 === 0);  // annual

        if (isPaymentMonth) {
          const dividend = divPerPayment * totalShares[sym];
          monthlyDividend += dividend;

          // DRIP: reinvest dividends
          if (dividendReinvest && sharePrice[sym] > 0) {
            const newShares = dividend / sharePrice[sym];
            totalShares[sym] += newShares;
          }
        }
      }
      totalDividendsReceived += monthlyDividend;

      // 4. Additional monthly investment (distribute proportionally)
      if (additionalMonthly > 0) {
        totalAdditionalInvested += additionalMonthly;
        const totalValue = symbols.reduce((s, sym) => s + totalShares[sym] * sharePrice[sym], 0);
        for (const sym of symbols) {
          const weight = totalValue > 0 ? (totalShares[sym] * sharePrice[sym]) / totalValue : 1 / symbols.length;
          const investAmount = additionalMonthly * weight;
          if (sharePrice[sym] > 0) {
            totalShares[sym] += investAmount / sharePrice[sym];
          }
        }
      }

      // 5. Yearly snapshot
      if (month % 12 === 0) {
        const yearNum = month / 12;
        const portfolioValue = symbols.reduce((s, sym) => s + totalShares[sym] * sharePrice[sym], 0);
        const currentAnnualIncome = symbols.reduce((s, sym) => s + annualDiv[sym] * totalShares[sym], 0);
        const totalInvested = initialInvestment + totalAdditionalInvested;

        yearlySnapshots.push({
          year: yearNum,
          portfolioValue,
          totalDividends: totalDividendsReceived,
          totalInvested,
          annualDividendIncome: currentAnnualIncome,
          dividendYield: portfolioValue > 0 ? (currentAnnualIncome / portfolioValue * 100) : 0,
        });
      }
    }

    const finalValue = symbols.reduce((s, sym) => s + totalShares[sym] * sharePrice[sym], 0);
    const totalInvested = initialInvestment + totalAdditionalInvested;
    const finalAnnualIncome = symbols.reduce((s, sym) => s + annualDiv[sym] * totalShares[sym], 0);

    const result = {
      // Input summary
      initialInvestment,
      additionalMonthly,
      years,
      dividendReinvest,
      dividendGrowthRate,
      priceGrowthRate,

      // Holdings detail
      holdings,

      // Final results
      finalPortfolioValue: finalValue,
      totalInvested,
      totalDividendsReceived,
      totalReturn: finalValue - totalInvested + (dividendReinvest ? 0 : totalDividendsReceived),
      totalReturnPercent: totalInvested > 0
        ? ((finalValue - totalInvested + (dividendReinvest ? 0 : totalDividendsReceived)) / totalInvested * 100)
        : 0,
      finalAnnualDividendIncome: finalAnnualIncome,
      finalMonthlyDividendIncome: finalAnnualIncome / 12,
      yieldOnCost: totalInvested > 0 ? (finalAnnualIncome / totalInvested * 100) : 0,

      // Chart data
      yearlySnapshots,
    };

    logger.info(`💰 시뮬레이션 완료: 초기 $${initialInvestment.toFixed(0)} → 최종 $${finalValue.toFixed(0)} (${years}년)`);

    res.json(result);
  } catch (err) {
    logger.error('Portfolio simulation failed', (err as Error).message);
    res.status(500).json({ error: 'Portfolio simulation failed' });
  }
});

// ==========================================
// Screening History (SQLite)
// ==========================================

router.get('/history', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const sessions = getSessionList();
    res.json({ sessions });
  } catch (err) {
    logger.error('Failed to get screening history', (err as Error).message);
    res.status(500).json({ error: 'Failed to get screening history' });
  }
});

router.get('/history/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid session ID' }); return; }
    const detail = getSessionDetail(id);
    if (!detail) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json(detail);
  } catch (err) {
    logger.error('Failed to get session detail', (err as Error).message);
    res.status(500).json({ error: 'Failed to get session detail' });
  }
});

router.delete('/history/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid session ID' }); return; }
    const deleted = deleteSession(id);
    res.json({ success: deleted });
  } catch (err) {
    logger.error('Failed to delete session', (err as Error).message);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ==========================================
// Portfolio Recommendation
// ==========================================

router.post('/portfolio-recommend', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await recommendPortfolio(req.body);
    res.json(result);
  } catch (err) {
    logger.error('Portfolio recommendation failed', (err as Error).message);
    res.status(500).json({ error: 'Portfolio recommendation failed' });
  }
});

// ==========================================
// Helpers
// ==========================================

function getDateNMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

export default router;
