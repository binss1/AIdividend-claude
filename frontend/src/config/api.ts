// API Configuration for AI Dividend Screener

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
}

export const API_ENDPOINTS = {
  // Stock Screening
  STOCKS_SCREEN: '/screening/stock-screening',
  STOCKS_PROGRESS: '/screening/stock-screening-progress',
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
    throw new ApiError(
      `API request failed: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json() as Promise<T>;
}
