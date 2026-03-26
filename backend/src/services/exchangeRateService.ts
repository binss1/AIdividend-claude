import axios from 'axios';
import NodeCache from 'node-cache';
import { ExchangeRateData } from '../types/index';
import logger from '../utils/logger';

const cache = new NodeCache({ stdTTL: 3600 }); // 1-hour cache
const CACHE_KEY = 'usd_krw_rate';
const FALLBACK_RATE = 1350;

export async function getExchangeRate(): Promise<ExchangeRateData> {
  const cached = cache.get<ExchangeRateData>(CACHE_KEY);
  if (cached) {
    logger.debug('Exchange rate cache hit', cached.rate);
    return cached;
  }

  // Try primary API
  try {
    const response = await axios.get(
      'https://open.er-api.com/v6/latest/USD',
      { timeout: 5000 }
    );
    const rate = response.data?.rates?.KRW;
    if (rate && typeof rate === 'number' && rate > 0) {
      const data: ExchangeRateData = {
        rate,
        source: 'exchangerate-api.com',
        lastUpdated: new Date().toISOString(),
      };
      cache.set(CACHE_KEY, data);
      logger.info(`Exchange rate fetched: 1 USD = ${rate} KRW`);
      return data;
    }
  } catch (err) {
    logger.warn('Primary exchange rate API failed', (err as Error).message);
  }

  // Try secondary API
  try {
    const response = await axios.get(
      'https://api.exchangerate-api.com/v4/latest/USD',
      { timeout: 5000 }
    );
    const rate = response.data?.rates?.KRW;
    if (rate && typeof rate === 'number' && rate > 0) {
      const data: ExchangeRateData = {
        rate,
        source: 'exchangerate-api.com/v4',
        lastUpdated: new Date().toISOString(),
      };
      cache.set(CACHE_KEY, data);
      logger.info(`Exchange rate fetched (secondary): 1 USD = ${rate} KRW`);
      return data;
    }
  } catch (err) {
    logger.warn('Secondary exchange rate API failed', (err as Error).message);
  }

  // Fallback
  logger.warn(`Using fallback exchange rate: ${FALLBACK_RATE} KRW/USD`);
  const fallback: ExchangeRateData = {
    rate: FALLBACK_RATE,
    source: 'fallback',
    lastUpdated: new Date().toISOString(),
  };
  cache.set(CACHE_KEY, fallback, 300); // cache fallback for 5 min only
  return fallback;
}
