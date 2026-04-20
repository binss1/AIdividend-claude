import { getSupabaseAdmin } from './supabaseService';
import { getUserProfile, updateUserProfile, getPlan } from './supabaseService';
import logger from '../utils/logger';

// ==========================================
// Credit Service - 크레딧 차감/충전/조회
// ==========================================

export type CreditTransactionType = 'use' | 'charge' | 'refund' | 'monthly_reset' | 'bonus' | 'addon';

export interface CreditTransaction {
  id: number;
  user_id: string;
  type: CreditTransactionType;
  amount: number;
  balance_after: number;
  feature: string | null;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

// 기능별 크레딧 비용 정의
export const FEATURE_COSTS: Record<string, number> = {
  stock_screening: 5,    // 배당주 스크리닝 1회
  etf_screening: 5,      // ETF 스크리닝 1회
  stock_detail: 1,       // 종목 상세 조회
  etf_detail: 1,         // ETF 상세 조회
  portfolio_simulate: 3, // 포트폴리오 시뮬레이션
  portfolio_recommend: 3, // 포트폴리오 추천
  portfolio_rebalance: 3, // 리밸런싱
  portfolio_refresh: 2,  // 포트폴리오 실시간 가격 업데이트
};

/**
 * 크레딧 잔액 조회
 */
export async function getCreditBalance(userId: string): Promise<{
  balance: number;
  plan_id: string;
  total_used: number;
} | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;

  return {
    balance: profile.credit_balance,
    plan_id: profile.plan_id,
    total_used: profile.total_credits_used,
  };
}

/**
 * 크레딧 사용 가능 여부 확인
 */
export async function canUseCredits(userId: string, feature: string): Promise<{
  allowed: boolean;
  balance: number;
  cost: number;
  isUnlimited: boolean;
  reason?: string;
}> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    return { allowed: false, balance: 0, cost: 0, isUnlimited: false, reason: '사용자를 찾을 수 없습니다.' };
  }

  const plan = await getPlan(profile.plan_id);
  const cost = FEATURE_COSTS[feature] || 1;

  // 무제한 플랜 체크 (monthly_credits === -1)
  if (plan && plan.monthly_credits === -1) {
    return { allowed: true, balance: profile.credit_balance, cost, isUnlimited: true };
  }

  if (profile.credit_balance < cost) {
    return {
      allowed: false,
      balance: profile.credit_balance,
      cost,
      isUnlimited: false,
      reason: `크레딧이 부족합니다. (잔액: ${profile.credit_balance}, 필요: ${cost})`,
    };
  }

  return { allowed: true, balance: profile.credit_balance, cost, isUnlimited: false };
}

/**
 * 크레딧 차감
 */
export async function deductCredits(
  userId: string,
  feature: string,
  description?: string
): Promise<{
  success: boolean;
  balance: number;
  cost: number;
  error?: string;
}> {
  const check = await canUseCredits(userId, feature);
  if (!check.allowed) {
    return { success: false, balance: check.balance, cost: check.cost, error: check.reason };
  }

  // 무제한 플랜은 트랜잭션만 기록하고 잔액 차감 안 함
  if (check.isUnlimited) {
    await recordTransaction({
      user_id: userId,
      type: 'use',
      amount: 0, // 무제한은 0으로 기록
      balance_after: check.balance,
      feature,
      description: description || `${feature} (무제한 플랜)`,
    });

    // total_credits_used는 카운트
    await updateUserProfile(userId, {
      total_credits_used: (await getUserProfile(userId))!.total_credits_used + 1,
    });

    return { success: true, balance: check.balance, cost: 0 };
  }

  const cost = check.cost;
  const newBalance = check.balance - cost;

  // 잔액 업데이트
  const updated = await updateUserProfile(userId, {
    credit_balance: newBalance,
    total_credits_used: (await getUserProfile(userId))!.total_credits_used + cost,
  });

  if (!updated) {
    return { success: false, balance: check.balance, cost, error: '크레딧 차감 실패' };
  }

  // 트랜잭션 기록
  await recordTransaction({
    user_id: userId,
    type: 'use',
    amount: -cost,
    balance_after: newBalance,
    feature,
    description: description || `${feature} 사용`,
  });

  logger.info(`[Credit] 차감: user=${userId}, feature=${feature}, cost=${cost}, balance=${newBalance}`);

  return { success: true, balance: newBalance, cost };
}

/**
 * 크레딧 충전 (구독/추가구매/보너스)
 */
export async function chargeCredits(params: {
  userId: string;
  amount: number;
  type: CreditTransactionType;
  description?: string;
  referenceId?: string;
}): Promise<{
  success: boolean;
  balance: number;
  error?: string;
}> {
  const profile = await getUserProfile(params.userId);
  if (!profile) {
    return { success: false, balance: 0, error: '사용자를 찾을 수 없습니다.' };
  }

  const newBalance = profile.credit_balance + params.amount;

  const updated = await updateUserProfile(params.userId, {
    credit_balance: newBalance,
  });

  if (!updated) {
    return { success: false, balance: profile.credit_balance, error: '크레딧 충전 실패' };
  }

  await recordTransaction({
    user_id: params.userId,
    type: params.type,
    amount: params.amount,
    balance_after: newBalance,
    description: params.description || `크레딧 ${params.amount} 충전`,
    reference_id: params.referenceId,
  });

  logger.info(`[Credit] 충전: user=${params.userId}, amount=${params.amount}, type=${params.type}, balance=${newBalance}`);

  return { success: true, balance: newBalance };
}

/**
 * 크레딧 트랜잭션 기록
 */
async function recordTransaction(params: {
  user_id: string;
  type: CreditTransactionType;
  amount: number;
  balance_after: number;
  feature?: string;
  description?: string;
  reference_id?: string;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const { error } = await sb.from('credit_transactions').insert({
    user_id: params.user_id,
    type: params.type,
    amount: params.amount,
    balance_after: params.balance_after,
    feature: params.feature || null,
    description: params.description || null,
    reference_id: params.reference_id || null,
  });

  if (error) {
    logger.error(`[Credit] 트랜잭션 기록 실패: ${error.message}`);
  }
}

/**
 * 크레딧 사용 이력 조회
 */
export async function getCreditHistory(
  userId: string,
  limit = 50
): Promise<CreditTransaction[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(`[Credit] 이력 조회 실패: ${error.message}`);
    return [];
  }

  return (data || []) as CreditTransaction[];
}

/**
 * 월간 크레딧 리셋 (구독 플랜에 따라)
 */
export async function resetMonthlyCredits(userId: string): Promise<{
  success: boolean;
  newBalance: number;
}> {
  const profile = await getUserProfile(userId);
  if (!profile) return { success: false, newBalance: 0 };

  const plan = await getPlan(profile.plan_id);
  if (!plan) return { success: false, newBalance: profile.credit_balance };

  // 무제한 플랜은 리셋 불필요
  if (plan.monthly_credits === -1) {
    return { success: true, newBalance: profile.credit_balance };
  }

  const newBalance = plan.monthly_credits;

  await updateUserProfile(userId, { credit_balance: newBalance });

  await recordTransaction({
    user_id: userId,
    type: 'monthly_reset',
    amount: newBalance - profile.credit_balance,
    balance_after: newBalance,
    description: `${plan.name} 플랜 월간 크레딧 리셋 (${newBalance})`,
  });

  logger.info(`[Credit] 월간 리셋: user=${userId}, plan=${plan.id}, newBalance=${newBalance}`);

  return { success: true, newBalance };
}
