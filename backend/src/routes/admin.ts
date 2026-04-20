import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  getSupabaseAdmin,
  getUserProfile,
  updateUserProfile,
  getAllPlans,
  getActiveSubscription,
  createSubscription,
} from '../services/supabaseService';
import { chargeCredits } from '../services/creditService';
import { runMonthlyReset } from '../services/monthlyResetService';
import logger from '../utils/logger';

const router = Router();

// 모든 admin 라우트에 인증 + admin 권한 체크
router.use(authenticateToken, requireAdmin);

// ==========================================
// 헬퍼: auth.users 목록 조회
// ==========================================
async function listAuthUsers() {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  // Supabase admin auth API로 전체 사용자 목록 조회
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    logger.error(`[Admin] auth.admin.listUsers 실패: ${error.message}`);
    return [];
  }
  return data.users || [];
}

// ==========================================
// GET /api/admin/users
// 전체 회원 목록 (프로필 + 구독 포함)
// ==========================================
router.get('/users', async (req: Request, res: Response) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) {
      res.status(503).json({ error: 'Supabase 미설정' });
      return;
    }

    // 1. auth.users 목록
    const authUsers = await listAuthUsers();

    // 2. user_profiles 전체 조회
    const { data: profiles, error: profilesError } = await sb
      .from('user_profiles')
      .select('*');
    if (profilesError) throw new Error(profilesError.message);

    // 3. subscriptions 전체 조회 (active만)
    const { data: subs, error: subsError } = await sb
      .from('subscriptions')
      .select('*')
      .eq('status', 'active');
    if (subsError) throw new Error(subsError.message);

    // 4. plans
    const plans = await getAllPlans();

    // 5. 데이터 병합
    const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.id, p]));
    const subsMap = new Map((subs || []).map((s: Record<string, unknown>) => [s.user_id, s]));
    const planMap = new Map(plans.map(p => [p.id, p]));

    const users = authUsers.map(u => {
      const profile = profileMap.get(u.id) as Record<string, unknown> | undefined;
      const sub = subsMap.get(u.id) as Record<string, unknown> | undefined;
      const planId = (profile?.plan_id as string) || 'free';
      const plan = planMap.get(planId);

      return {
        id: u.id,
        email: u.email || profile?.email || '',
        display_name: profile?.display_name || u.user_metadata?.name || u.user_metadata?.full_name || '',
        avatar_url: profile?.avatar_url || u.user_metadata?.avatar_url || null,
        plan_id: planId,
        plan_name: plan?.name || planId,
        credit_balance: (profile?.credit_balance as number) ?? 0,
        total_credits_used: (profile?.total_credits_used as number) ?? 0,
        is_admin: (profile?.is_admin as boolean) ?? false,
        providers: (u.identities || []).map((i: { provider: string }) => i.provider).filter((p: string) => p !== 'email'),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        subscription: sub
          ? {
              id: sub.id,
              plan_id: sub.plan_id,
              billing_period: sub.billing_period,
              status: sub.status,
              expires_at: sub.expires_at,
              started_at: sub.started_at,
            }
          : null,
      };
    });

    // 가입일 최신순 정렬
    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ users, total: users.length, plans });
  } catch (err) {
    logger.error(`[Admin] 회원 목록 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '회원 목록 조회 실패' });
  }
});

// ==========================================
// GET /api/admin/users/:id
// 특정 회원 상세 정보
// ==========================================
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const [profile, subscription, plans] = await Promise.all([
      getUserProfile(id),
      getActiveSubscription(id),
      getAllPlans(),
    ]);

    // 크레딧 이력 최근 20건
    const { data: history } = await sb
      .from('credit_transactions')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    // 결제 이력 최근 10건
    const { data: payments } = await sb
      .from('payments')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({ profile, subscription, plans, history: history || [], payments: payments || [] });
  } catch (err) {
    logger.error(`[Admin] 회원 상세 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '회원 상세 조회 실패' });
  }
});

// ==========================================
// PATCH /api/admin/users/:id/credits
// 크레딧 조정 (설정/추가/차감)
// Body: { action: 'set'|'add'|'subtract', amount: number, reason?: string }
// ==========================================
router.patch('/users/:id/credits', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { action, amount, reason } = req.body as {
      action: 'set' | 'add' | 'subtract';
      amount: number;
      reason?: string;
    };

    if (!action || typeof amount !== 'number' || amount < 0) {
      res.status(400).json({ error: '잘못된 요청입니다. action과 amount(>=0)가 필요합니다.' });
      return;
    }

    const profile = await getUserProfile(id);
    if (!profile) { res.status(404).json({ error: '사용자를 찾을 수 없습니다.' }); return; }

    let newBalance: number;
    let delta: number;

    if (action === 'set') {
      newBalance = amount;
      delta = amount - profile.credit_balance;
    } else if (action === 'add') {
      newBalance = profile.credit_balance + amount;
      delta = amount;
    } else {
      // subtract
      newBalance = Math.max(0, profile.credit_balance - amount);
      delta = newBalance - profile.credit_balance;
    }

    // 잔액 업데이트
    await updateUserProfile(id, { credit_balance: newBalance });

    // 트랜잭션 기록
    const sb = getSupabaseAdmin()!;
    await sb.from('credit_transactions').insert({
      user_id: id,
      type: delta >= 0 ? 'bonus' : 'use',
      amount: delta,
      balance_after: newBalance,
      description: reason || `관리자 크레딧 ${action === 'set' ? '설정' : action === 'add' ? '추가' : '차감'} (${delta >= 0 ? '+' : ''}${delta})`,
    });

    logger.info(`[Admin] 크레딧 조정: user=${id}, action=${action}, amount=${amount}, newBalance=${newBalance}, by=${req.user!.email}`);
    res.json({ success: true, balance: newBalance, delta });
  } catch (err) {
    logger.error(`[Admin] 크레딧 조정 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '크레딧 조정 실패' });
  }
});

// ==========================================
// PATCH /api/admin/users/:id/plan
// 플랜 변경 + 구독 생성/업데이트
// Body: { plan_id: string, billing_period?: 'monthly'|'annual', expires_at?: string }
// ==========================================
router.patch('/users/:id/plan', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { plan_id, billing_period = 'monthly', expires_at } = req.body as {
      plan_id: string;
      billing_period?: 'monthly' | 'annual';
      expires_at?: string;
    };

    if (!plan_id) {
      res.status(400).json({ error: 'plan_id가 필요합니다.' });
      return;
    }

    const sb = getSupabaseAdmin()!;
    const plans = await getAllPlans();
    const plan = plans.find(p => p.id === plan_id);
    if (!plan) { res.status(400).json({ error: '유효하지 않은 플랜입니다.' }); return; }

    // 1. user_profiles.plan_id 업데이트
    await updateUserProfile(id, { plan_id });

    // 2. 기존 active 구독 만료 처리
    await sb
      .from('subscriptions')
      .update({ status: 'expired', cancelled_at: new Date().toISOString() })
      .eq('user_id', id)
      .eq('status', 'active');

    // free 플랜이면 구독 생성 안 함
    if (plan_id !== 'free') {
      const expiresAt = expires_at
        ? new Date(expires_at).toISOString()
        : (() => {
            const d = new Date();
            if (billing_period === 'annual') d.setFullYear(d.getFullYear() + 1);
            else d.setMonth(d.getMonth() + 1);
            return d.toISOString();
          })();

      await sb.from('subscriptions').insert({
        user_id: id,
        plan_id,
        billing_period,
        status: 'active',
        expires_at: expiresAt,
      });
    }

    // 3. 플랜 변경에 따른 크레딧 조정 (월간 크레딧이 있는 경우 추가 지급)
    if (plan_id !== 'free' && plan.monthly_credits > 0) {
      const profile = await getUserProfile(id);
      if (profile) {
        await chargeCredits({
          userId: id,
          amount: plan.monthly_credits,
          type: 'monthly_reset',
          description: `${plan.name} 플랜 변경 (관리자) - 크레딧 지급`,
        });
      }
    }

    logger.info(`[Admin] 플랜 변경: user=${id}, plan=${plan_id}, by=${req.user!.email}`);
    res.json({ success: true, plan_id, plan_name: plan.name });
  } catch (err) {
    logger.error(`[Admin] 플랜 변경 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '플랜 변경 실패' });
  }
});

// ==========================================
// PATCH /api/admin/users/:id/subscription
// 구독 만료일/상태 수정
// Body: { expires_at?: string, status?: string }
// ==========================================
router.patch('/users/:id/subscription', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { expires_at, status } = req.body as {
      expires_at?: string;
      status?: 'active' | 'cancelled' | 'expired' | 'past_due';
    };

    const sb = getSupabaseAdmin()!;

    const updates: Record<string, unknown> = {};
    if (expires_at !== undefined) updates.expires_at = expires_at ? new Date(expires_at).toISOString() : null;
    if (status) updates.status = status;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'expires_at 또는 status가 필요합니다.' });
      return;
    }

    // 현재 active 구독 업데이트
    const { data, error } = await sb
      .from('subscriptions')
      .update(updates)
      .eq('user_id', id)
      .eq('status', status === 'active' ? 'active' : 'active') // 현재 active 구독 찾기
      .order('created_at', { ascending: false })
      .limit(1)
      .select();

    if (error) throw new Error(error.message);

    logger.info(`[Admin] 구독 수정: user=${id}, updates=${JSON.stringify(updates)}, by=${req.user!.email}`);
    res.json({ success: true, updated: data });
  } catch (err) {
    logger.error(`[Admin] 구독 수정 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '구독 수정 실패' });
  }
});

// ==========================================
// PATCH /api/admin/users/:id/toggle-admin
// Admin 권한 토글
// ==========================================
router.patch('/users/:id/toggle-admin', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const adminId = req.user!.id;

    // 자기 자신의 admin 권한은 제거 불가
    if (id === adminId) {
      res.status(400).json({ error: '자신의 Admin 권한은 변경할 수 없습니다.' });
      return;
    }

    const profile = await getUserProfile(id);
    if (!profile) { res.status(404).json({ error: '사용자를 찾을 수 없습니다.' }); return; }

    const newIsAdmin = !profile.is_admin;
    await updateUserProfile(id, { is_admin: newIsAdmin } as Parameters<typeof updateUserProfile>[1]);

    logger.info(`[Admin] Admin 토글: user=${id}, is_admin=${newIsAdmin}, by=${req.user!.email}`);
    res.json({ success: true, is_admin: newIsAdmin });
  } catch (err) {
    logger.error(`[Admin] Admin 토글 실패: ${(err as Error).message}`);
    res.status(500).json({ error: 'Admin 권한 변경 실패' });
  }
});

// ==========================================
// GET /api/admin/stats
// 대시보드 통계
// ==========================================
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const [authUsers, { data: profiles }, { data: subs }, plans] = await Promise.all([
      listAuthUsers(),
      sb.from('user_profiles').select('plan_id, is_admin, credit_balance'),
      sb.from('subscriptions').select('plan_id, status').eq('status', 'active'),
      getAllPlans(),
    ]);

    const planMap = new Map(plans.map(p => [p.id, p.name]));

    // 플랜별 사용자 수
    const planCounts: Record<string, number> = {};
    (profiles || []).forEach((p: { plan_id: string }) => {
      planCounts[p.plan_id] = (planCounts[p.plan_id] || 0) + 1;
    });

    const totalCredits = (profiles || []).reduce((sum: number, p: { credit_balance: number }) => sum + (p.credit_balance || 0), 0);
    const adminCount = (profiles || []).filter((p: { is_admin: boolean }) => p.is_admin).length;

    res.json({
      total_users: authUsers.length,
      admin_count: adminCount,
      active_subscriptions: (subs || []).length,
      total_credits_held: totalCredits,
      plan_distribution: Object.entries(planCounts).map(([plan_id, count]) => ({
        plan_id,
        plan_name: planMap.get(plan_id) || plan_id,
        count,
      })),
    });
  } catch (err) {
    logger.error(`[Admin] 통계 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

// ==========================================
// POST /api/admin/cron/monthly-reset
// 월간 크레딧 리셋 수동 실행 (테스트 / 긴급 재실행)
// ==========================================
router.post('/cron/monthly-reset', async (req: Request, res: Response) => {
  try {
    logger.info(`[Admin] 월간 크레딧 리셋 수동 실행: by=${req.user!.email}`);
    const result = await runMonthlyReset();
    res.json({ success: true, result });
  } catch (err) {
    logger.error(`[Admin] 월간 크레딧 리셋 수동 실행 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '월간 크레딧 리셋 실패' });
  }
});

// ==========================================
// GET /api/admin/cron/reset-history
// 최근 월간 리셋 이력 조회 (credit_transactions)
// ==========================================
router.get('/cron/reset-history', async (_req: Request, res: Response) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const { data, error } = await sb
      .from('credit_transactions')
      .select('user_id, amount, balance_after, description, created_at')
      .eq('type', 'monthly_reset')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    res.json({ history: data || [] });
  } catch (err) {
    logger.error(`[Admin] 리셋 이력 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '리셋 이력 조회 실패' });
  }
});

export default router;
