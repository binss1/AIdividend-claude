import { getSupabaseAdmin, getUserProfile, updateUserProfile, getPlan } from './supabaseService';
import logger from '../utils/logger';

// ==========================================
// Monthly Credit Reset Service
// 매월 1일 00:00 (KST) - 활성 구독 사용자 크레딧 리셋
// ==========================================

export interface MonthlyResetResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  details: Array<{
    userId: string;
    email: string;
    planId: string;
    prevBalance: number;
    newBalance: number;
    status: 'reset' | 'skipped' | 'failed';
    reason?: string;
  }>;
  executedAt: string;
}

/**
 * 전체 활성 구독 사용자 월간 크레딧 리셋
 * - active 상태 구독이 있는 유료 플랜 사용자 대상
 * - free 플랜은 별도 처리 없음 (월간 크레딧 0)
 * - 무제한 플랜(monthly_credits === -1)은 스킵
 */
export async function runMonthlyReset(): Promise<MonthlyResetResult> {
  const result: MonthlyResetResult = {
    total: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    details: [],
    executedAt: new Date().toISOString(),
  };

  logger.info('[MonthlyReset] 월간 크레딧 리셋 시작');

  const sb = getSupabaseAdmin();
  if (!sb) {
    logger.error('[MonthlyReset] Supabase 미설정 - 리셋 중단');
    return result;
  }

  try {
    // 1. 활성 구독 사용자 목록 조회 (free 제외)
    const { data: activeSubs, error: subsError } = await sb
      .from('subscriptions')
      .select('user_id, plan_id')
      .eq('status', 'active')
      .neq('plan_id', 'free');

    if (subsError) {
      logger.error(`[MonthlyReset] 구독 목록 조회 실패: ${subsError.message}`);
      return result;
    }

    if (!activeSubs || activeSubs.length === 0) {
      logger.info('[MonthlyReset] 활성 구독 사용자 없음 - 종료');
      return result;
    }

    result.total = activeSubs.length;
    logger.info(`[MonthlyReset] 대상 사용자: ${result.total}명`);

    // 2. 중복 제거 (한 유저에 여러 구독이 있을 수 있음)
    const uniqueUsers = new Map<string, string>();
    for (const sub of activeSubs) {
      if (!uniqueUsers.has(sub.user_id)) {
        uniqueUsers.set(sub.user_id, sub.plan_id);
      }
    }

    // 3. 각 사용자 크레딧 리셋
    for (const [userId, planId] of uniqueUsers) {
      try {
        const [profile, plan] = await Promise.all([
          getUserProfile(userId),
          getPlan(planId),
        ]);

        if (!profile || !plan) {
          result.failed++;
          result.details.push({
            userId,
            email: '',
            planId,
            prevBalance: 0,
            newBalance: 0,
            status: 'failed',
            reason: '프로필 또는 플랜 정보 없음',
          });
          continue;
        }

        // 무제한 플랜 스킵
        if (plan.monthly_credits === -1) {
          result.skipped++;
          result.details.push({
            userId,
            email: profile.email || '',
            planId,
            prevBalance: profile.credit_balance,
            newBalance: profile.credit_balance,
            status: 'skipped',
            reason: '무제한 플랜',
          });
          continue;
        }

        // monthly_credits 가 0 이면 리셋 불필요
        if (plan.monthly_credits === 0) {
          result.skipped++;
          result.details.push({
            userId,
            email: profile.email || '',
            planId,
            prevBalance: profile.credit_balance,
            newBalance: profile.credit_balance,
            status: 'skipped',
            reason: '월간 크레딧 0 플랜',
          });
          continue;
        }

        const prevBalance = profile.credit_balance;
        const newBalance = plan.monthly_credits;

        // 잔액 업데이트
        await updateUserProfile(userId, { credit_balance: newBalance });

        // 트랜잭션 기록
        const delta = newBalance - prevBalance;
        await sb.from('credit_transactions').insert({
          user_id: userId,
          type: 'monthly_reset',
          amount: delta,
          balance_after: newBalance,
          description: `${plan.name} 플랜 월간 크레딧 자동 리셋 → ${newBalance}크레딧`,
        });

        result.success++;
        result.details.push({
          userId,
          email: profile.email || '',
          planId,
          prevBalance,
          newBalance,
          status: 'reset',
        });

        logger.info(
          `[MonthlyReset] 완료: user=${userId}, plan=${planId}, ${prevBalance} → ${newBalance}`
        );
      } catch (userErr) {
        result.failed++;
        result.details.push({
          userId,
          email: '',
          planId,
          prevBalance: 0,
          newBalance: 0,
          status: 'failed',
          reason: (userErr as Error).message,
        });
        logger.error(`[MonthlyReset] 사용자 처리 실패: user=${userId}, ${(userErr as Error).message}`);
      }
    }

    logger.info(
      `[MonthlyReset] 완료 - 성공: ${result.success}, 스킵: ${result.skipped}, 실패: ${result.failed}`
    );
  } catch (err) {
    logger.error(`[MonthlyReset] 전체 처리 오류: ${(err as Error).message}`);
  }

  return result;
}
