import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import logger from './utils/logger';
import screeningRouter from './routes/screening';
import exchangeRateRouter from './routes/exchangeRate';
import paymentsRouter from './routes/payments';
import creditsRouter from './routes/credits';
import adminRouter from './routes/admin';
import { initDB } from './services/dbService';

const app = express();

// ==========================================
// Middleware
// ==========================================

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (dev)
if (env.isDev()) {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// ==========================================
// Routes
// ==========================================

app.use('/api/screening', screeningRouter);
app.use('/api/exchange-rate', exchangeRateRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    fmpConfigured: !!env.FMP_API_KEY,
    supabaseConfigured: !!env.SUPABASE_URL,
    sheetsConfigured: !!env.GOOGLE_SPREADSHEET_ID,
  });
});

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ==========================================
// Error Handler
// ==========================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({
    error: env.isDev() ? err.message : 'Internal server error',
  });
});

// ==========================================
// Start Server
// ==========================================

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} (${env.NODE_ENV})`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);

  // Initialize SQLite database
  try { initDB(); } catch (e) { logger.error('DB init failed', (e as Error).message); }

  if (!env.FMP_API_KEY) {
    logger.warn('FMP_API_KEY is not set. Stock screening will not work.');
  }
});

export default app;
