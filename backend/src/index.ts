import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { env } from './config/env';
import logger from './utils/logger';
import screeningRouter from './routes/screening';
import exchangeRateRouter from './routes/exchangeRate';
import paymentsRouter from './routes/payments';
import creditsRouter from './routes/credits';
import adminRouter from './routes/admin';
import portfolioRouter from './routes/portfolio';
import { initDB } from './services/dbService';
import { runMonthlyReset } from './services/monthlyResetService';

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
app.use('/api/portfolio', portfolioRouter);

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

  // ==========================================
  // Cron Jobs
  // ==========================================

  // 월간 크레딧 자동 리셋 - 매월 1일 00:00 KST (= UTC 15:00)
  // cron 형식: 초(선택) 분 시 일 월 요일
  cron.schedule('0 15 1 * *', async () => {
    logger.info('[Cron] 월간 크레딧 리셋 Job 시작');
    try {
      const result = await runMonthlyReset();
      logger.info(
        `[Cron] 월간 크레딧 리셋 완료 - 성공: ${result.success}, 스킵: ${result.skipped}, 실패: ${result.failed}`
      );
    } catch (err) {
      logger.error(`[Cron] 월간 크레딧 리셋 오류: ${(err as Error).message}`);
    }
  }, {
    timezone: 'UTC',
  });

  logger.info('[Cron] 월간 크레딧 리셋 스케줄 등록 완료 (매월 1일 00:00 KST)');
});

export default app;
