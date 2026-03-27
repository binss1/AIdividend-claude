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
} from '../services/fmpService';
import { screenDividendETFs, getETFList } from '../services/etfScreeningService';
import { getExchangeRate } from '../services/exchangeRateService';
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

// Cache separately for index-only vs full
let cachedUniverseIndex: { stockTotal: number; etfTotal: number; rate: number; fetchedAt: number } | null = null;
let cachedUniverseFull: { stockTotal: number; etfTotal: number; rate: number; fetchedAt: number } | null = null;

router.get('/universe-info', async (req: Request, res: Response) => {
  try {
    const indexOnly = req.query.indexOnly !== 'false';
    const now = Date.now();
    const cached = indexOnly ? cachedUniverseIndex : cachedUniverseFull;

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
      const allStocks = await getAllUSDividendStocks();
      stockTotal = allStocks.length;
    }

    const [etfList, exchangeRateData] = await Promise.all([
      getETFList().catch(() => [] as { symbol: string; name: string }[]),
      getExchangeRate(),
    ]);

    const result = {
      stockTotal,
      etfTotal: etfList.length,
      rate: exchangeRateData.rate,
      fetchedAt: now,
    };

    if (indexOnly) {
      cachedUniverseIndex = result;
    } else {
      cachedUniverseFull = result;
    }

    logger.info(`[API] Universe info (indexOnly=${indexOnly}): stocks=${stockTotal}, ETFs=${etfList.length}, rate=${exchangeRateData.rate}`);
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

    // Start screening in background
    (async () => {
      try {
        const results = await screenDividendStocks(criteria, (progress) => {
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
        };

        // Save to Google Sheets (non-blocking)
        saveScreeningResults(results).catch(err => {
          logger.error('Background sheets save failed', (err as Error).message);
        });

        const elapsed = stockScreeningProgress.startedAt
          ? ((Date.now() - new Date(stockScreeningProgress.startedAt).getTime()) / 1000).toFixed(0)
          : '?';
        logger.info(`[API] 스크리닝 완료: ${results.length}개 종목 발견, 총 ${elapsed}초 소요`);
      } catch (err) {
        logger.error('[API] 스크리닝 실패:', (err as Error).message);
        stockScreeningProgress = {
          ...stockScreeningProgress,
          status: 'error',
          error: (err as Error).message,
          completedAt: new Date().toISOString(),
        };
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

    res.json(detail);
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
    const dividends = await getDividendHistory(symbol.toUpperCase());

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
// Helpers
// ==========================================

function getDateNMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

export default router;
