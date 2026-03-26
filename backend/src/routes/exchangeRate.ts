import { Router, Request, Response } from 'express';
import { getExchangeRate } from '../services/exchangeRateService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /
 * Returns the current USD/KRW exchange rate
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rateData = await getExchangeRate();
    res.json(rateData);
  } catch (err) {
    logger.error('Failed to get exchange rate', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch exchange rate' });
  }
});

export default router;
