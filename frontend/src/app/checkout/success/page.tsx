'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentData, setPaymentData] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMsg('결제 정보가 올바르지 않습니다.');
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

    fetch(`${apiBase}/payments/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setPaymentData(data.payment);
        } else {
          setStatus('error');
          setErrorMsg(data.error || '결제 승인에 실패했습니다.');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('서버와 통신할 수 없습니다.');
      });
  }, [paymentKey, orderId, amount]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 animate-spin mx-auto text-emerald-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <p className="text-zinc-400 mt-4">결제 승인 중...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">결제 승인 실패</h1>
          <p className="text-sm text-zinc-400 mb-6">{errorMsg}</p>
          <Link href="/pricing" className="px-6 py-3 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            요금제로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="max-w-md text-center p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">결제가 완료되었습니다!</h1>
        <p className="text-sm text-zinc-400 mb-6">서비스를 이용해 주셔서 감사합니다.</p>

        {paymentData && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left mb-6 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500">주문번호</span>
              <span className="text-zinc-300 font-mono">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">결제금액</span>
              <span className="text-emerald-400 font-bold">₩{Number(amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">결제수단</span>
              <span className="text-zinc-300">{String(paymentData.method || '-')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">상태</span>
              <span className="text-emerald-400">{String(paymentData.status || 'DONE')}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Link href="/screening" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 transition-all">
            스크리닝 시작
          </Link>
          <Link href="/dashboard" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            대시보드
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">로딩 중...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
