'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || 'UNKNOWN';
  const message = searchParams.get('message') || '결제가 취소되었거나 실패했습니다.';
  const orderId = searchParams.get('orderId') || '-';

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="max-w-md text-center p-8">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">결제 실패</h1>
        <p className="text-sm text-zinc-400 mb-4">{decodeURIComponent(message)}</p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left mb-6 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">에러 코드</span>
            <span className="text-amber-400 font-mono">{code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">주문번호</span>
            <span className="text-zinc-300 font-mono">{orderId}</span>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Link href="/pricing" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 transition-all">
            다시 시도
          </Link>
          <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">로딩 중...</p>
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
