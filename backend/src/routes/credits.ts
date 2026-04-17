import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getCreditBalance, getCreditHistory, FEATURE_COSTS } from '../services/creditService';
import { getUserProfile } from '../services/supabaseService';
import { getActiveSubscription, getAllPlans } from '../services/supabaseService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /balance
 * 현재 크레딧 잔액 조회
 */
router.get('/balance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const balance = await getCreditBalance(userId);

    if (!balance) {
      res.status(404).json({ error: '사용자 정보를 찾을 수 없습니다.' });
      return;
    }

    res.json({
      balance: balance.balance,
      plan_id: balance.plan_id,
      total_used: balance.total_used,
    });
  } catch (err) {
    logger.error(`[Credits] 잔액 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '크레딧 잔액 조회 실패' });
  }
});

/**
 * GET /history
 * 크레딧 사용 이력 조회
 */
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await getCreditHistory(userId, limit);

    res.json({ transactions: history });
  } catch (err) {
    logger.error(`[Credits] 이력 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '크레딧 이력 조회 실패' });
  }
});

/**
 * GET /costs
 * 기능별 크레딧 비용 조회
 */
router.get('/costs', (_req: Request, res: Response) => {
  res.json({ costs: FEATURE_COSTS });
});

/**
 * GET /profile
 * 사용자 프로필 + 구독 정보 조회
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [profile, subscription, plans] = await Promise.all([
      getUserProfile(userId),
      getActiveSubscription(userId),
      getAllPlans(),
    ]);

    if (!profile) {
      res.status(404).json({ error: '프로필을 찾을 수 없습니다.' });
      return;
    }

    const currentPlan = plans.find(p => p.id === profile.plan_id);

    res.json({
      profile: {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        plan_id: profile.plan_id,
        credit_balance: profile.credit_balance,
        total_credits_used: profile.total_credits_used,
        created_at: profile.created_at,
      },
      plan: currentPlan || null,
      subscription: subscription || null,
      plans,
    });
  } catch (err) {
    logger.error(`[Credits] 프로필 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '프로필 조회 실패' });
  }
});

export default router;
