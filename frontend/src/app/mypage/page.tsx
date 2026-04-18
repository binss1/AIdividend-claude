'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getApiBaseUrl } from '@/config/api';

interface CreditProfile {
  credit_balance: number;
  plan_id: string;
  total_credits_used: number;
  is_admin: boolean;
}

interface Plan {
  name: string;
  monthly_credits: number;
}

interface Subscription {
  status: string;
  current_period_end?: string;
  billing_cycle?: string;
}

interface ProfileData {
  profile: CreditProfile;
  plan: Plan;
  subscription: Subscription | null;
}

interface CreditHistoryItem {
  id: number;
  created_at: string;
  type: string;
  amount: number;
  description: string;
  balance_after: number;
}

const TYPE_LABELS: Record<string, string> = {
  usage: '사용',
  purchase: '충전',
  monthly_grant: '월간 지급',
  refund: '환불',
  bonus: '보너스',
  adjustment: '조정',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MyPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    const apiBase = getApiBaseUrl();
    const headers = { Authorization: `Bearer ${session.access_token}` };

    try {
      const [profileRes, historyRes] = await Promise.all([
        fetch(`${apiBase}/credits/profile`, { headers }),
        fetch(`${apiBase}/credits/history`, { headers }),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfileData(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history || []);
      }
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [authLoading, user, router, fetchData]);

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

  const profile = profileData?.profile;
  const plan = profileData?.plan;
  const subscription = profileData?.subscription;
  const usagePercent = profile && plan && plan.monthly_credits > 0
    ? Math.min(100, Math.round((profile.total_credits_used / plan.monthly_credits) * 100))
    : 0;

  // identities 배열에서 실제 사용 중인 소셜 프로바이더 추출
  const identityProviders: string[] = (user.identities || [])
    .map((id: { provider: string }) => id.provider)
    .filter((p: string) => p !== 'email');

  const providerLabel = (p: string) =>
    p === 'google' ? 'Google' :
    p === 'kakao' ? 'Kakao' :
    p === 'naver' ? 'Naver' :
    p.charAt(0).toUpperCase() + p.slice(1);

  const primaryProvider = identityProviders[0] || user.app_metadata?.provider || 'email';
  const providerName = providerLabel(primaryProvider);

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">마이페이지</h1>
          <p className="text-sm text-gray-500 mt-1">계정 정보 및 크레딧 관리</p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">프로필</h2>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-xl font-bold text-white shrink-0">
              {(user.user_metadata?.name || user.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-base font-medium text-white truncate">
                {user.user_metadata?.name || '사용자'}
              </p>
              <p className="text-sm text-gray-400 truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* 소셜 로그인 프로바이더 뱃지 */}
                {identityProviders.length > 0 ? (
                  identityProviders.map(p => (
                    <span key={p} className="inline-block px-2 py-0.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {providerLabel(p)}
                    </span>
                  ))
                ) : (
                  <span className="inline-block px-2 py-0.5 text-xs rounded-lg bg-gray-800 text-gray-400 border border-gray-700/50">
                    {providerName}
                  </span>
                )}
                {profile?.is_admin && (
                  <span className="inline-block px-2 py-0.5 text-xs rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 font-semibold">
                    ⚡ Admin
                  </span>
                )}
                {user.created_at && (
                  <span className="text-xs text-gray-500">
                    가입일: {formatDate(user.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Credit Status */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">크레딧 현황</h2>
            <Link
              href="/pricing?tab=credits"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              충전하기 &rarr;
            </Link>
          </div>

          {profile && plan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4">
                  <p className="text-xs text-gray-500 mb-1">잔액</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {profile.credit_balance.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4">
                  <p className="text-xs text-gray-500 mb-1">플랜</p>
                  <p className="text-lg font-semibold text-white">{plan.name}</p>
                </div>
                <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4 col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-500 mb-1">월간 크레딧</p>
                  <p className="text-lg font-semibold text-white">
                    {plan.monthly_credits > 0 ? plan.monthly_credits.toLocaleString() : '무제한'}
                  </p>
                </div>
              </div>

              {/* Usage bar */}
              {plan.monthly_credits > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-400">사용량</span>
                    <span className="text-gray-500">
                      {profile.total_credits_used.toLocaleString()} / {plan.monthly_credits.toLocaleString()} ({usagePercent}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">크레딧 정보를 불러올 수 없습니다.</p>
          )}
        </div>

        {/* Subscription Info */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">구독 정보</h2>
            <Link
              href="/pricing"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              플랜 변경 &rarr;
            </Link>
          </div>

          {subscription ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4">
                <p className="text-xs text-gray-500 mb-1">현재 플랜</p>
                <p className="text-base font-semibold text-white">{plan?.name || '-'}</p>
              </div>
              <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4">
                <p className="text-xs text-gray-500 mb-1">결제 주기</p>
                <p className="text-base font-semibold text-white">
                  {subscription.billing_cycle === 'yearly' ? '연간' : '월간'}
                </p>
              </div>
              <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4">
                <p className="text-xs text-gray-500 mb-1">다음 결제일</p>
                <p className="text-base font-semibold text-white">
                  {subscription.current_period_end
                    ? formatDate(subscription.current_period_end)
                    : '-'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-4 text-center">
              <p className="text-sm text-gray-400">
                현재 구독 중인 플랜이 없습니다.
              </p>
              <Link
                href="/pricing"
                className="inline-block mt-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                플랜 둘러보기 &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Credit History */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">크레딧 이력</h2>

          {history.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">날짜</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">유형</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500">금액</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 hidden sm:table-cell">설명</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500">잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-lg ${
                          item.amount > 0
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium whitespace-nowrap ${
                        item.amount > 0 ? 'text-emerald-400' : 'text-gray-300'
                      }`}>
                        {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 hidden sm:table-cell truncate max-w-[200px]">
                        {item.description || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-400 whitespace-nowrap">
                        {item.balance_after.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">
              크레딧 이력이 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
