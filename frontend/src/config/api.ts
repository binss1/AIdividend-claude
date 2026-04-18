// API Configuration for AI Dividend Screener

import { triggerCreditToast } from '@/components/CreditToast';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
}

export const API_ENDPOINTS = {
  // Stock Screening
  STOCKS_SCREEN: '/screening/stock-screening',
  STOCKS_PROGRESS: '/screening/stock-screening-progress',
  STOCKS_CANCEL: '/screening/stock-screening-cancel',
  ETFS_CANCEL: '/screening/etf-screening-cancel',
  STOCKS_DETAIL: (symbol: string) => `/screening/stock/${symbol}`,
  STOCKS_HISTORICAL: (symbol: string) => `/screening/stock/${symbol}/historical`,
  STOCKS_DIVIDEND_HISTORY: (symbol: string) => `/screening/stock/${symbol}/dividend-history`,

  // ETF Screening
  ETFS_SCREEN: '/screening/etf-screening',
  ETFS_PROGRESS: '/screening/etf-screening-progress',

  // Universe Info (stock/etf counts + exchange rate)
  UNIVERSE_INFO: '/screening/universe-info',

  // Dividend Calendar
  DIVIDEND_CALENDAR: '/screening/dividend-calendar',

  // Portfolio Simulator
  PORTFOLIO_SIMULATE: '/screening/portfolio-simulate',

  // Portfolio Recommendation
  PORTFOLIO_RECOMMEND: '/screening/portfolio-recommend',

  // Portfolio Rebalancing
  PORTFOLIO_REBALANCE: '/screening/portfolio-rebalance',

  // Screening History
  SCREENING_HISTORY: '/screening/history',
  SCREENING_HISTORY_DETAIL: (id: number) => `/screening/history/${id}`,

  // Market Insights
  SECTOR_PERFORMANCE: '/screening/sector-performance',
  ECONOMIC_CALENDAR: '/screening/economic-calendar',
  STOCK_NEWS: '/screening/stock-news',

  // Payments
  PAYMENT_CONFIRM: '/payments/confirm',

  // Exchange Rate
  EXCHANGE_RATE: '/exchange-rate',

  // Health
  HEALTH: '/health',
} as const;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    // 402: 크레딧 부족 처리
    if (response.status === 402) {
      const msg =
        (errorData && typeof errorData === 'object' && 'message' in errorData
          ? (errorData as { message?: string }).message
          : undefined) || '크레딧이 부족합니다. 충전 후 다시 시도해주세요.';
      if (typeof window !== 'undefined') {
        triggerCreditToast(msg);
      }
    }

    throw new ApiError(
      `API request failed: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json() as Promise<T>;
}
