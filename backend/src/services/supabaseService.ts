import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import logger from '../utils/logger';

// ==========================================
// Supabase Admin Client (service_role)
// RLS를 우회하여 백엔드에서 직접 CRUD
// ==========================================

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('[Supabase] URL 또는 SERVICE_ROLE_KEY 미설정 - Supabase 기능 비활성화');
    return null;
  }

  supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  logger.info('[Supabase] Admin 클라이언트 초기화 완료');
  return supabaseAdmin;
}

// ==========================================
// User Profile
// ==========================================

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan_id: string;
  credit_balance: number;
  total_credits_used: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    logger.error(`[Supabase] getUserProfile 실패: ${error.message}`);
    return null;
  }
  return data as UserProfile;
}

/**
 * 프로필 조회 + 없으면 Free 플랜으로 자동 생성
 * SQL 마이그레이션 전에 가입한 사용자 대응
 */
export async function getOrCreateUserProfile(
  userId: string,
  email?: string
): Promise<UserProfile | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  // 기존 프로필 조회
  const existing = await getUserProfile(userId);
  if (existing) return existing;

  // 없으면 Free 플랜으로 신규 생성
  logger.info(`[Supabase] 프로필 없음 → 자동 생성: userId=${userId}`);
  const { data, error } = await sb
    .from('user_profiles')
    .upsert({
      id: userId,
      email: email || null,
      plan_id: 'free',
      credit_balance: 50,
      total_credits_used: 0,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    logger.error(`[Supabase] getOrCreateUserProfile 실패: ${error.message}`);
    return null;
  }
  return data as UserProfile;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'plan_id' | 'credit_balance' | 'total_credits_used' | 'display_name' | 'avatar_url'>>
): Promise<UserProfile | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    logger.error(`[Supabase] updateUserProfile 실패: ${error.message}`);
    return null;
  }
  return data as UserProfile;
}

// ==========================================
// Plans
// ==========================================

export interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  monthly_credits: number;
  max_screening_results: number;
  max_scenarios: number;
  history_retention_days: number;
  excel_export: boolean;
  realtime_alerts: boolean;
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    logger.error(`[Supabase] getPlan 실패: ${error.message}`);
    return null;
  }
  return data as Plan;
}

export async function getAllPlans(): Promise<Plan[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb.from('plans').select('*').order('monthly_price');

  if (error) {
    logger.error(`[Supabase] getAllPlans 실패: ${error.message}`);
    return [];
  }
  return (data || []) as Plan[];
}

// ==========================================
// Subscriptions
// ==========================================

export interface Subscription {
  id: number;
  user_id: string;
  plan_id: string;
  billing_period: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error(`[Supabase] getActiveSubscription 실패: ${error.message}`);
    return null;
  }
  return data as Subscription | null;
}

export async function createSubscription(params: {
  user_id: string;
  plan_id: string;
  billing_period: 'monthly' | 'annual';
}): Promise<Subscription | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  // 기존 active 구독 만료 처리
  await sb
    .from('subscriptions')
    .update({ status: 'expired', cancelled_at: new Date().toISOString() })
    .eq('user_id', params.user_id)
    .eq('status', 'active');

  // 만료일 계산
  const expiresAt = new Date();
  if (params.billing_period === 'annual') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const { data, error } = await sb
    .from('subscriptions')
    .insert({
      user_id: params.user_id,
      plan_id: params.plan_id,
      billing_period: params.billing_period,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error(`[Supabase] createSubscription 실패: ${error.message}`);
    return null;
  }
  return data as Subscription;
}

// ==========================================
// Payments
// ==========================================

export interface Payment {
  id: number;
  user_id: string;
  toss_payment_key: string | null;
  order_id: string;
  amount: number;
  status: 'pending' | 'done' | 'cancelled' | 'failed';
  plan_id: string | null;
  credit_amount: number | null;
  method: string | null;
  billing_period: string | null;
  toss_response: Record<string, unknown> | null;
  created_at: string;
  confirmed_at: string | null;
}

export async function createPayment(params: {
  user_id: string;
  order_id: string;
  amount: number;
  plan_id?: string;
  credit_amount?: number;
  billing_period?: string;
  toss_payment_key?: string;
  method?: string;
  status?: string;
  toss_response?: Record<string, unknown>;
}): Promise<Payment | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('payments')
    .insert({
      user_id: params.user_id,
      order_id: params.order_id,
      amount: params.amount,
      plan_id: params.plan_id || null,
      credit_amount: params.credit_amount || null,
      billing_period: params.billing_period || null,
      toss_payment_key: params.toss_payment_key || null,
      method: params.method || null,
      status: params.status || 'pending',
      toss_response: params.toss_response || null,
      confirmed_at: params.status === 'done' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    logger.error(`[Supabase] createPayment 실패: ${error.message}`);
    return null;
  }
  return data as Payment;
}

export async function updatePaymentStatus(
  orderId: string,
  status: string,
  tossResponse?: Record<string, unknown>,
  tossPaymentKey?: string,
  method?: string
): Promise<Payment | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const updates: Record<string, unknown> = { status };
  if (tossResponse) updates.toss_response = tossResponse;
  if (tossPaymentKey) updates.toss_payment_key = tossPaymentKey;
  if (method) updates.method = method;
  if (status === 'done') updates.confirmed_at = new Date().toISOString();

  const { data, error } = await sb
    .from('payments')
    .update(updates)
    .eq('order_id', orderId)
    .select()
    .single();

  if (error) {
    logger.error(`[Supabase] updatePaymentStatus 실패: ${error.message}`);
    return null;
  }
  return data as Payment;
}
