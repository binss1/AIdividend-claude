'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getApiBaseUrl } from '@/config/api';

// ============================================================
// Types
// ============================================================

interface Plan {
  id: string;
  name: string;
  monthly_credits: number;
  monthly_price: number;
}

interface Subscription {
  id: number;
  plan_id: string;
  billing_period: string;
  status: string;
  expires_at: string | null;
  started_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  plan_id: string;
  plan_name: string;
  credit_balance: number;
  total_credits_used: number;
  is_admin: boolean;
  providers: string[];
  created_at: string;
  last_sign_in_at: string | null;
  subscription: Subscription | null;
}

interface Stats {
  total_users: number;
  admin_count: number;
  active_subscriptions: number;
  total_credits_held: number;
  plan_distribution: { plan_id: string; plan_name: string; count: number }[];
}

// ============================================================
// Modal Types
// ============================================================
type ModalType = 'credits' | 'plan' | 'subscription' | null;

interface ModalState {
  type: ModalType;
  user: AdminUser | null;
}

// ============================================================
// Helpers
// ============================================================
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function formatDateTime(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-700 text-gray-300',
  starter: 'bg-blue-500/15 text-blue-400',
  pro: 'bg-emerald-500/15 text-emerald-400',
  premium: 'bg-amber-500/15 text-amber-400',
  enterprise: 'bg-violet-500/15 text-violet-400',
};

function PlanBadge({ planId, planName }: { planId: string; planName: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-lg font-medium ${PLAN_COLORS[planId] || 'bg-gray-700 text-gray-300'}`}>
      {planName}
    </span>
  );
}

// ============================================================
// Credit Modal
// ============================================================
function CreditModal({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: (action: 'set' | 'add' | 'subtract', amount: number, reason: string) => Promise<void>;
}) {
  const [action, setAction] = useState<'set' | 'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const n = parseInt(amount);
    if (isNaN(n) || n < 0) { setError('0 이상의 숫자를 입력하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(action, n, reason);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const preview = (() => {
    const n = parseInt(amount) || 0;
    if (action === 'set') return n;
    if (action === 'add') return user.credit_balance + n;
    return Math.max(0, user.credit_balance - n);
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-1">크레딧 조정</h3>
        <p className="text-sm text-gray-400 mb-5">{user.email}</p>

        <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4 mb-5 flex items-center justify-between">
          <span className="text-sm text-gray-400">현재 잔액</span>
          <span className="text-xl font-bold text-emerald-400">{user.credit_balance.toLocaleString()} 크레딧</span>
        </div>

        <div className="space-y-4">
          {/* Action 선택 */}
          <div className="grid grid-cols-3 gap-2">
            {(['add', 'subtract', 'set'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`py-2 text-sm rounded-xl border transition-colors ${
                  action === a
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {a === 'add' ? '추가' : a === 'subtract' ? '차감' : '직접 설정'}
              </button>
            ))}
          </div>

          {/* 금액 입력 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              {action === 'set' ? '설정할 크레딧 수' : action === 'add' ? '추가할 크레딧 수' : '차감할 크레딧 수'}
            </label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {/* 사유 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">사유 (선택)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="조정 사유를 입력하세요"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {/* 미리보기 */}
          {amount !== '' && (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">변경 후 잔액</span>
              <span className="text-base font-bold text-emerald-400">{preview.toLocaleString()} 크레딧</span>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || amount === ''}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Plan Modal
// ============================================================
function PlanModal({
  user,
  plans,
  onClose,
  onSave,
}: {
  user: AdminUser;
  plans: Plan[];
  onClose: () => void;
  onSave: (planId: string, billingPeriod: string, expiresAt: string) => Promise<void>;
}) {
  const [planId, setPlanId] = useState(user.plan_id);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>(
    (user.subscription?.billing_period as 'monthly' | 'annual') || 'monthly'
  );
  const [expiresAt, setExpiresAt] = useState(() => {
    if (user.subscription?.expires_at) {
      return new Date(user.subscription.expires_at).toISOString().slice(0, 10);
    }
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setSaving(true);
    setError('');
    try {
      await onSave(planId, billingPeriod, expiresAt);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const selectedPlan = plans.find(p => p.id === planId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-1">플랜 변경</h3>
        <p className="text-sm text-gray-400 mb-5">{user.email}</p>

        <div className="space-y-4">
          {/* 플랜 선택 */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">플랜</label>
            <div className="grid grid-cols-1 gap-2">
              {plans.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                    planId === p.id
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PlanBadge planId={p.id} planName={p.name} />
                    <span className="text-xs text-gray-500">
                      {p.monthly_credits === -1 ? '무제한' : `${p.monthly_credits.toLocaleString()} 크레딧/월`}
                    </span>
                  </div>
                  {p.monthly_price > 0 && (
                    <span className="text-xs text-gray-500">₩{p.monthly_price.toLocaleString()}/월</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 결제 주기 (Free 제외) */}
          {planId !== 'free' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">결제 주기</label>
              <div className="grid grid-cols-2 gap-2">
                {(['monthly', 'annual'] as const).map(bp => (
                  <button
                    key={bp}
                    onClick={() => setBillingPeriod(bp)}
                    className={`py-2 text-sm rounded-xl border transition-colors ${
                      billingPeriod === bp
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {bp === 'monthly' ? '월간' : '연간'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 만료일 (Free 제외) */}
          {planId !== 'free' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">구독 만료일</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
          )}

          {/* 크레딧 지급 안내 */}
          {planId !== 'free' && selectedPlan && selectedPlan.monthly_credits > 0 && (
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3 text-sm text-blue-400">
              ℹ️ 플랜 변경 시 {selectedPlan.monthly_credits.toLocaleString()} 크레딧이 즉시 지급됩니다.
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-sm transition-colors"
          >
            {saving ? '저장 중...' : '변경'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Subscription Modal
// ============================================================
function SubscriptionModal({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: (expiresAt: string, status: string) => Promise<void>;
}) {
  const [expiresAt, setExpiresAt] = useState(() => {
    if (user.subscription?.expires_at) {
      return new Date(user.subscription.expires_at).toISOString().slice(0, 10);
    }
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [status, setStatus] = useState(user.subscription?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setSaving(true);
    setError('');
    try {
      await onSave(expiresAt, status);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-1">구독 수정</h3>
        <p className="text-sm text-gray-400 mb-5">{user.email}</p>

        {!user.subscription ? (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 text-sm text-amber-400 mb-5">
            현재 활성 구독이 없습니다. 플랜 변경을 통해 구독을 생성하세요.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">만료일</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">상태</label>
              <div className="grid grid-cols-2 gap-2">
                {(['active', 'cancelled', 'expired', 'past_due'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`py-2 text-sm rounded-xl border transition-colors ${
                      status === s
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {s === 'active' ? '활성' : s === 'cancelled' ? '취소됨' : s === 'expired' ? '만료됨' : '연체'}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors">
            취소
          </button>
          {user.subscription && (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-sm transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Admin Page
// ============================================================
export default function AdminPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [modal, setModal] = useState<ModalState>({ type: null, user: null });
  const [toast, setToast] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const apiHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    const base = getApiBaseUrl();
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch(`${base}/admin/users`, { headers: apiHeaders() }),
        fetch(`${base}/admin/stats`, { headers: apiHeaders() }),
      ]);
      if (usersRes.status === 403) {
        router.push('/');
        return;
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
        setPlans(data.plans || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, apiHeaders, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchData();
  }, [authLoading, user, router, fetchData]);

  // ── 크레딧 조정 ──
  async function handleCreditSave(action: 'set' | 'add' | 'subtract', amount: number, reason: string) {
    const u = modal.user!;
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/admin/users/${u.id}/credits`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ action, amount, reason }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || '크레딧 조정 실패');
    }
    const { balance } = await res.json();
    setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, credit_balance: balance } : usr));
    showToast(`${u.email} 크레딧이 ${balance.toLocaleString()}으로 변경되었습니다.`);
  }

  // ── 플랜 변경 ──
  async function handlePlanSave(planId: string, billingPeriod: string, expiresAt: string) {
    const u = modal.user!;
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/admin/users/${u.id}/plan`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ plan_id: planId, billing_period: billingPeriod, expires_at: expiresAt }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || '플랜 변경 실패');
    }
    const plan = plans.find(p => p.id === planId);
    setUsers(prev => prev.map(usr => usr.id === u.id
      ? {
          ...usr,
          plan_id: planId,
          plan_name: plan?.name || planId,
          subscription: planId === 'free' ? null : {
            ...usr.subscription,
            id: usr.subscription?.id || 0,
            plan_id: planId,
            billing_period: billingPeriod,
            status: 'active',
            expires_at: expiresAt,
            started_at: usr.subscription?.started_at || new Date().toISOString(),
          },
        }
      : usr
    ));
    showToast(`${u.email} 플랜이 ${plan?.name || planId}으로 변경되었습니다.`);
    // 크레딧도 다시 조회
    fetchData();
  }

  // ── 구독 수정 ──
  async function handleSubSave(expiresAt: string, status: string) {
    const u = modal.user!;
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/admin/users/${u.id}/subscription`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ expires_at: expiresAt, status }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || '구독 수정 실패');
    }
    setUsers(prev => prev.map(usr =>
      usr.id === u.id && usr.subscription
        ? { ...usr, subscription: { ...usr.subscription, expires_at: expiresAt, status } }
        : usr
    ));
    showToast(`${u.email} 구독이 수정되었습니다.`);
  }

  // ── 월간 크레딧 리셋 수동 실행 ──
  async function handleMonthlyReset() {
    if (!confirm('활성 구독 사용자의 크레딧을 플랜 기본값으로 초기화합니다.\n계속하시겠습니까?')) return;
    setResetLoading(true);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/admin/cron/monthly-reset`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '리셋 실패');
      const r = data.result;
      showToast(`월간 리셋 완료 — 성공 ${r.success}명, 스킵 ${r.skipped}명, 실패 ${r.failed}명`);
      fetchData();
    } catch (e) {
      showToast(`오류: ${(e as Error).message}`);
    } finally {
      setResetLoading(false);
    }
  }

  // ── Admin 토글 ──
  async function handleToggleAdmin(u: AdminUser) {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/admin/users/${u.id}/toggle-admin`, {
      method: 'PATCH',
      headers: apiHeaders(),
    });
    if (!res.ok) {
      const d = await res.json();
      showToast(`오류: ${d.error}`);
      return;
    }
    const { is_admin } = await res.json();
    setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, is_admin } : usr));
    showToast(`${u.email} Admin 권한이 ${is_admin ? '부여' : '제거'}되었습니다.`);
  }

  // ── 필터링 ──
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q);
    const matchPlan = !planFilter || u.plan_id === planFilter;
    return matchSearch && matchPlan;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-black text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Modals */}
      {modal.type === 'credits' && modal.user && (
        <CreditModal user={modal.user} onClose={() => setModal({ type: null, user: null })} onSave={handleCreditSave} />
      )}
      {modal.type === 'plan' && modal.user && (
        <PlanModal user={modal.user} plans={plans} onClose={() => setModal({ type: null, user: null })} onSave={handlePlanSave} />
      )}
      {modal.type === 'subscription' && modal.user && (
        <SubscriptionModal user={modal.user} onClose={() => setModal({ type: null, user: null })} onSave={handleSubSave} />
      )}

      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-violet-400">⚡</span> 관리자 페이지
            </h1>
            <p className="text-sm text-gray-500 mt-1">회원 크레딧, 플랜, 구독 관리</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMonthlyReset}
              disabled={resetLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {resetLoading ? (
                <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              월간 크레딧 리셋
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">{error}</div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: '전체 회원', value: stats.total_users.toLocaleString(), color: 'text-white' },
              { label: '관리자', value: stats.admin_count.toLocaleString(), color: 'text-violet-400' },
              { label: '활성 구독', value: stats.active_subscriptions.toLocaleString(), color: 'text-emerald-400' },
              { label: '전체 크레딧 보유량', value: stats.total_credits_held.toLocaleString(), color: 'text-amber-400' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 플랜 분포 */}
        {stats && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">플랜별 회원 수</h2>
            <div className="flex flex-wrap gap-3">
              {stats.plan_distribution.map(d => (
                <div key={d.plan_id} className="flex items-center gap-2 rounded-xl bg-gray-800/50 border border-gray-700/30 px-3 py-2">
                  <PlanBadge planId={d.plan_id} planName={d.plan_name} />
                  <span className="text-sm font-semibold text-white">{d.count}명</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 검색 & 필터 */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="이메일 또는 이름 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">전체 플랜</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-600 mt-3">총 {filtered.length}명 표시 중</p>
        </div>

        {/* 회원 목록 */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 whitespace-nowrap">회원</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 whitespace-nowrap">플랜</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 whitespace-nowrap">크레딧</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 whitespace-nowrap hidden md:table-cell">만료일</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 whitespace-nowrap hidden lg:table-cell">가입일</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 whitespace-nowrap hidden lg:table-cell">최근 로그인</th>
                  <th className="py-3 px-4 text-xs font-medium text-gray-500 text-center whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* 회원 정보 */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-black">
                          {(u.display_name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white text-sm font-medium truncate max-w-[140px]">
                              {u.display_name || u.email.split('@')[0]}
                            </span>
                            {u.is_admin && (
                              <span className="inline-block px-1.5 py-0.5 text-[10px] rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/20 font-semibold">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate max-w-[160px]">{u.email}</p>
                          {u.providers.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {u.providers.map(p => (
                                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-400">
                                  {p === 'google' ? 'G' : p === 'kakao' ? 'K' : p[0].toUpperCase()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 플랜 */}
                    <td className="py-3 px-4">
                      <PlanBadge planId={u.plan_id} planName={u.plan_name} />
                    </td>

                    {/* 크레딧 */}
                    <td className="py-3 px-4 text-right">
                      <span className="text-emerald-400 font-semibold">{u.credit_balance.toLocaleString()}</span>
                      <span className="text-gray-600 text-xs ml-1">/{u.total_credits_used.toLocaleString()} 사용</span>
                    </td>

                    {/* 만료일 */}
                    <td className="py-3 px-4 hidden md:table-cell">
                      {u.subscription?.expires_at ? (
                        <span className={`text-sm ${
                          new Date(u.subscription.expires_at) < new Date()
                            ? 'text-red-400'
                            : new Date(u.subscription.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                            ? 'text-amber-400'
                            : 'text-gray-400'
                        }`}>
                          {formatDate(u.subscription.expires_at)}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>

                    {/* 가입일 */}
                    <td className="py-3 px-4 text-gray-500 hidden lg:table-cell text-xs">
                      {formatDate(u.created_at)}
                    </td>

                    {/* 최근 로그인 */}
                    <td className="py-3 px-4 text-gray-500 hidden lg:table-cell text-xs">
                      {formatDateTime(u.last_sign_in_at)}
                    </td>

                    {/* 관리 버튼 */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* 크레딧 */}
                        <button
                          onClick={() => setModal({ type: 'credits', user: u })}
                          title="크레딧 조정"
                          className="px-2.5 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                        >
                          💰 크레딧
                        </button>

                        {/* 플랜 */}
                        <button
                          onClick={() => setModal({ type: 'plan', user: u })}
                          title="플랜 변경"
                          className="px-2.5 py-1.5 text-xs rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                        >
                          📋 플랜
                        </button>

                        {/* 구독 만료일 */}
                        <button
                          onClick={() => setModal({ type: 'subscription', user: u })}
                          title="구독 수정"
                          className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap ${
                            u.subscription
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                              : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed opacity-50'
                          }`}
                          disabled={!u.subscription}
                        >
                          📅 구독
                        </button>

                        {/* Admin 토글 */}
                        <button
                          onClick={() => handleToggleAdmin(u)}
                          title={u.is_admin ? 'Admin 해제' : 'Admin 부여'}
                          className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap ${
                            u.is_admin
                              ? 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                              : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/20'
                          }`}
                        >
                          ⚡ {u.is_admin ? 'Admin 해제' : 'Admin 부여'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-600 text-sm">
                      {search || planFilter ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
