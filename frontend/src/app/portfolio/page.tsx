'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getApiBaseUrl } from '@/config/api';

// ============================================================
// Types
// ============================================================
interface Holding {
  id: number;
  symbol: string;
  company_name: string | null;
  shares: number;
  avg_cost: number;
  currency: string;
  asset_type: string;
  memo: string | null;
  created_at: string;
  // Live data (optional, from /live endpoint)
  current_price?: number | null;
  current_value?: number | null;
  cost_basis?: number;
  gain_loss?: number | null;
  gain_loss_pct?: number | null;
  annual_dividend_per_share?: number;
  annual_dividend_total?: number;
  monthly_dividend_estimate?: number;
  dividend_months?: number[];
  next_ex_date?: string | null;
  yield_on_cost?: number;
  current_yield?: number;
  change_pct?: number | null;
}

interface Summary {
  total_cost_basis: number;
  total_current_value: number;
  total_gain_loss: number;
  total_gain_loss_pct: number;
  total_annual_dividend: number;
  estimated_monthly_dividend: number;
  monthly_breakdown: Record<number, number>;
  holdings_count: number;
}

// ============================================================
// Helpers
// ============================================================
const fmt = (n: number | null | undefined, decimals = 2) =>
  n == null || isNaN(n) ? '-' : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtPct = (n: number | null | undefined) =>
  n == null || isNaN(n) ? '-' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function GainBadge({ value, pct }: { value: number | null | undefined; pct: number | null | undefined }) {
  if (value == null) return <span className="text-gray-500">-</span>;
  const pos = value >= 0;
  return (
    <span className={pos ? 'text-emerald-400' : 'text-red-400'}>
      {pos ? '+' : ''}${fmt(value)} ({fmtPct(pct)})
    </span>
  );
}

// ============================================================
// Add / Edit Modal
// ============================================================
function HoldingModal({
  editing,
  onClose,
  onSave,
}: {
  editing: Holding | null;
  onClose: () => void;
  onSave: (data: { symbol: string; shares: number; avg_cost: number; memo: string; asset_type: string }) => Promise<void>;
}) {
  const [symbol, setSymbol] = useState(editing?.symbol ?? '');
  const [shares, setShares] = useState(editing ? String(editing.shares) : '');
  const [avgCost, setAvgCost] = useState(editing ? String(editing.avg_cost) : '');
  const [assetType, setAssetType] = useState(editing?.asset_type ?? 'stock');
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!symbol.trim()) { setError('종목 코드를 입력하세요.'); return; }
    const s = parseFloat(shares);
    const c = parseFloat(avgCost);
    if (isNaN(s) || s <= 0) { setError('보유 수량을 올바르게 입력하세요.'); return; }
    if (isNaN(c) || c <= 0) { setError('평균 매수가를 올바르게 입력하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ symbol: symbol.toUpperCase().trim(), shares: s, avg_cost: c, memo, asset_type: assetType });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const costBasisPreview = parseFloat(shares) * parseFloat(avgCost);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-5">
          {editing ? '종목 수정' : '보유 종목 추가'}
        </h3>

        <div className="space-y-4">
          {/* 종목 코드 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">종목 코드 (티커)</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              disabled={!!editing}
              placeholder="예: AAPL, JEPI, VYM"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-sm disabled:opacity-50"
            />
          </div>

          {/* 종류 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">종류</label>
            <div className="grid grid-cols-2 gap-2">
              {(['stock', 'etf'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAssetType(t)}
                  className={`py-2 text-sm rounded-xl border transition-colors ${
                    assetType === t
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {t === 'stock' ? '주식' : 'ETF'}
                </button>
              ))}
            </div>
          </div>

          {/* 보유 수량 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">보유 수량 (주)</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={shares}
              onChange={e => setShares(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {/* 평균 매수가 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">평균 매수가 (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={avgCost}
              onChange={e => setAvgCost(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {/* 코스트 베이시스 미리보기 */}
          {shares && avgCost && !isNaN(costBasisPreview) && (
            <div className="rounded-xl bg-gray-800/60 border border-gray-700/30 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">투자 원금</span>
              <span className="text-sm font-medium text-white">${fmt(costBasisPreview)}</span>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 장기 보유, 배당 재투자"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-sm transition-colors"
          >
            {saving ? '저장 중...' : (editing ? '수정' : '추가')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Monthly Dividend Calendar
// ============================================================
function MonthlyCalendar({
  breakdown,
  holdings,
}: {
  breakdown: Record<number, number>;
  holdings: Holding[];
}) {
  const maxVal = Math.max(...Object.values(breakdown), 1);

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="text-sm font-semibold text-white mb-4">월별 예상 배당 수령</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
        {MONTH_LABELS.map((label, idx) => {
          const month = idx + 1;
          const amount = breakdown[month] || 0;
          const heightPct = amount > 0 ? Math.max(10, (amount / maxVal) * 100) : 0;

          // 해당 월에 배당이 있는 종목들
          const payingSymbols = holdings
            .filter(h => h.dividend_months?.includes(month))
            .map(h => h.symbol);

          return (
            <div key={month} className="flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end" style={{ height: 60 }}>
                <div
                  className={`w-full rounded-t-md transition-all ${
                    amount > 0 ? 'bg-emerald-500/70' : 'bg-gray-800'
                  }`}
                  style={{ height: `${heightPct}%`, minHeight: amount > 0 ? 4 : 0 }}
                />
              </div>
              <span className="text-xs text-gray-500">{label}</span>
              {amount > 0 && (
                <span className="text-xs text-emerald-400 font-medium">${fmt(amount, 0)}</span>
              )}
              {payingSymbols.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {payingSymbols.slice(0, 2).map(s => (
                    <span key={s} className="text-[9px] text-gray-600">{s}</span>
                  ))}
                  {payingSymbols.length > 2 && (
                    <span className="text-[9px] text-gray-600">+{payingSymbols.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Target Tracker
// ============================================================
function TargetTracker({
  monthlyIncome,
  target,
  onChangeTarget,
}: {
  monthlyIncome: number;
  target: number;
  onChangeTarget: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(target));
  const pct = target > 0 ? Math.min((monthlyIncome / target) * 100, 100) : 0;
  const remaining = Math.max(0, target - monthlyIncome);

  function save() {
    const v = parseFloat(inputVal);
    if (!isNaN(v) && v > 0) onChangeTarget(v);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">월 배당 목표 달성률</h2>
        <button
          onClick={() => { setEditing(!editing); setInputVal(String(target)); }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          목표 수정
        </button>
      </div>

      {editing ? (
        <div className="flex gap-2 mb-4">
          <div className="flex items-center gap-1 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3">
            <span className="text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              className="flex-1 bg-transparent py-2.5 text-white text-sm focus:outline-none"
              placeholder="월 목표 배당 (USD)"
              autoFocus
            />
          </div>
          <button
            onClick={save}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-medium"
          >
            저장
          </button>
        </div>
      ) : null}

      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-xs text-gray-500">현재 월 예상</p>
          <p className="text-2xl font-bold text-emerald-400">${fmt(monthlyIncome)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">목표</p>
          <p className="text-lg font-semibold text-white">${fmt(target)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${
            pct >= 100 ? 'bg-amber-400' : pct >= 70 ? 'bg-emerald-400' : pct >= 30 ? 'bg-emerald-600' : 'bg-gray-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className={`font-medium ${pct >= 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {pct >= 100 ? '목표 달성!' : `${pct.toFixed(1)}% 달성`}
        </span>
        {remaining > 0 && <span>목표까지 ${ fmt(remaining)}/월 부족</span>}
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function PortfolioPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingHoldings, setLoadingHoldings] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [targetMonthly, setTargetMonthly] = useState<number>(700);
  const [toast, setToast] = useState('');
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const apiHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  // 로컬스토리지에서 목표 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('portfolio_target_monthly');
    if (saved) setTargetMonthly(parseFloat(saved) || 700);
  }, []);

  function updateTarget(v: number) {
    setTargetMonthly(v);
    localStorage.setItem('portfolio_target_monthly', String(v));
  }

  // 크레딧 잔액 조회
  const fetchCreditBalance = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/credits/profile`, { headers: apiHeaders() });
      if (res.ok) {
        const d = await res.json();
        setCreditBalance(d.profile?.credit_balance ?? null);
      }
    } catch { /* ignore */ }
  }, [session?.access_token, apiHeaders]);

  // 기본 보유 종목 로드 (무료)
  const fetchHoldings = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingHoldings(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/portfolio`, { headers: apiHeaders() });
      if (res.ok) {
        const d = await res.json();
        setHoldings(d.holdings || []);
      }
    } catch (e) {
      showToast(`조회 실패: ${(e as Error).message}`);
    } finally {
      setLoadingHoldings(false);
    }
  }, [session?.access_token, apiHeaders]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchHoldings();
    fetchCreditBalance();
  }, [authLoading, user, router, fetchHoldings, fetchCreditBalance]);

  // 실시간 가격 업데이트 (2크레딧)
  async function handleRefreshLive() {
    setRefreshing(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/portfolio/live`, { headers: apiHeaders() });
      if (res.status === 402) {
        showToast('크레딧이 부족합니다. 크레딧을 충전해주세요.');
        return;
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '가격 업데이트 실패');
      }
      const d = await res.json();
      setHoldings(d.holdings || []);
      setSummary(d.summary || null);
      setHasLiveData(true);
      fetchCreditBalance();
      showToast('실시간 가격이 업데이트되었습니다.');
    } catch (e) {
      showToast(`오류: ${(e as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }

  // 종목 추가 / 수정
  async function handleSaveHolding(data: {
    symbol: string; shares: number; avg_cost: number; memo: string; asset_type: string;
  }) {
    if (editingHolding) {
      // 수정
      const res = await fetch(`${getApiBaseUrl()}/portfolio/${editingHolding.id}`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ shares: data.shares, avg_cost: data.avg_cost, memo: data.memo }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '수정 실패'); }
      showToast(`${editingHolding.symbol} 종목이 수정되었습니다.`);
    } else {
      // 추가
      const res = await fetch(`${getApiBaseUrl()}/portfolio`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '추가 실패'); }
      showToast(`${data.symbol} 종목이 추가되었습니다.`);
    }
    setEditingHolding(null);
    setShowModal(false);
    await fetchHoldings();
    setHasLiveData(false);
    setSummary(null);
  }

  // 종목 삭제
  async function handleDelete(h: Holding) {
    if (!confirm(`${h.symbol} 종목을 포트폴리오에서 삭제하시겠습니까?`)) return;
    const res = await fetch(`${getApiBaseUrl()}/portfolio/${h.id}`, {
      method: 'DELETE',
      headers: apiHeaders(),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || '삭제 실패'); return; }
    showToast(`${h.symbol} 종목이 삭제되었습니다.`);
    setHoldings(prev => prev.filter(x => x.id !== h.id));
    setSummary(null);
    setHasLiveData(false);
  }

  // 합계 계산 (실시간 데이터 없을 때 정적으로)
  const staticSummary = {
    total_cost_basis: holdings.reduce((s, h) => s + h.shares * h.avg_cost, 0),
    holdings_count: holdings.length,
  };

  const displaySummary = summary || null;

  if (authLoading || loadingHoldings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-black text-sm font-medium px-5 py-3 rounded-2xl shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Modal */}
      {(showModal || editingHolding) && (
        <HoldingModal
          editing={editingHolding}
          onClose={() => { setShowModal(false); setEditingHolding(null); }}
          onSave={handleSaveHolding}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">내 포트폴리오</h1>
            <p className="text-sm text-gray-500 mt-1">보유 종목 추적 · 배당 현금 흐름 분석</p>
          </div>
          <div className="flex items-center gap-2">
            {creditBalance !== null && (
              <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1.5 rounded-lg">
                크레딧 {creditBalance.toLocaleString()}
              </span>
            )}
            <button
              onClick={handleRefreshLive}
              disabled={refreshing || holdings.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {refreshing ? (
                <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              가격 업데이트 <span className="text-[10px] text-blue-500">(2크레딧)</span>
            </button>
            <button
              onClick={() => { setShowModal(true); setEditingHolding(null); }}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              종목 추가
            </button>
          </div>
        </div>

        {/* 빈 상태 */}
        {holdings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 py-20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">포트폴리오가 비어 있습니다</h3>
            <p className="text-sm text-gray-500 mb-6">보유 중인 배당주/ETF 종목을 추가하고<br/>배당 현금 흐름을 한눈에 확인하세요.</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              첫 종목 추가하기
            </button>
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">투자 원금</p>
                <p className="text-xl font-bold text-white">${fmt(staticSummary.total_cost_basis)}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">현재 가치</p>
                {displaySummary ? (
                  <p className="text-xl font-bold text-white">${fmt(displaySummary.total_current_value)}</p>
                ) : (
                  <p className="text-xl font-bold text-gray-600">업데이트 필요</p>
                )}
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">평가 손익</p>
                {displaySummary ? (
                  <GainBadge value={displaySummary.total_gain_loss} pct={displaySummary.total_gain_loss_pct} />
                ) : (
                  <p className="text-xl font-bold text-gray-600">-</p>
                )}
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">예상 연배당금</p>
                {displaySummary ? (
                  <>
                    <p className="text-xl font-bold text-emerald-400">${fmt(displaySummary.total_annual_dividend)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">월 ${fmt(displaySummary.estimated_monthly_dividend)}</p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-gray-600">-</p>
                )}
              </div>
            </div>

            {/* 보유 종목 테이블 */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  보유 종목 <span className="text-gray-500">({holdings.length})</span>
                </h2>
                {!hasLiveData && (
                  <span className="text-xs text-gray-600">가격 업데이트 버튼을 눌러 실시간 데이터를 불러오세요</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">종목</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">보유 수량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">평균 매수가</th>
                      {hasLiveData && <>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">현재가</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">평가 손익</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">연배당수익률</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">예상 연배당</th>
                      </>}
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">배당 월</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {holdings.map(h => (
                      <tr key={h.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              h.asset_type === 'etf'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}>
                              {h.asset_type === 'etf' ? 'ETF' : 'STK'}
                            </span>
                            <div>
                              <p className="font-semibold text-white">{h.symbol}</p>
                              {h.company_name && (
                                <p className="text-xs text-gray-500 truncate max-w-[120px]">{h.company_name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-white">{h.shares.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-400">${fmt(h.avg_cost)}</td>
                        {hasLiveData && <>
                          <td className="px-4 py-3 text-right">
                            <div>
                              <span className="text-white">${fmt(h.current_price)}</span>
                              {h.change_pct != null && (
                                <p className={`text-xs ${h.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {fmtPct(h.change_pct)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <GainBadge value={h.gain_loss} pct={h.gain_loss_pct} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {h.current_yield != null ? (
                              <div>
                                <span className="text-emerald-400">{h.current_yield.toFixed(2)}%</span>
                                <p className="text-xs text-gray-500">YOC {(h.yield_on_cost ?? 0).toFixed(2)}%</p>
                              </div>
                            ) : <span className="text-gray-600">-</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {h.annual_dividend_total ? (
                              <div>
                                <span className="text-white">${fmt(h.annual_dividend_total)}</span>
                                <p className="text-xs text-gray-500">${fmt(h.monthly_dividend_estimate)}/월</p>
                              </div>
                            ) : <span className="text-gray-600">-</span>}
                          </td>
                        </>}
                        <td className="px-4 py-3 text-center">
                          {h.dividend_months && h.dividend_months.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {h.dividend_months.map(m => (
                                <span key={m} className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">
                                  {m}월
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600">업데이트 필요</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditingHolding(h); setShowModal(true); }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                              title="수정"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(h)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="삭제"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 월별 배당 캘린더 + 목표 달성률 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                {displaySummary ? (
                  <MonthlyCalendar
                    breakdown={displaySummary.monthly_breakdown}
                    holdings={holdings}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 flex items-center justify-center py-16">
                    <div className="text-center">
                      <p className="text-gray-500 text-sm mb-3">가격 업데이트 후 배당 캘린더가 표시됩니다</p>
                      <button
                        onClick={handleRefreshLive}
                        disabled={refreshing}
                        className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        지금 업데이트 (2크레딧)
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <TargetTracker
                  monthlyIncome={displaySummary?.estimated_monthly_dividend ?? 0}
                  target={targetMonthly}
                  onChangeTarget={updateTarget}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
