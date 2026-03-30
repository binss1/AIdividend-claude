'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadPaymentWidget, PaymentWidgetInstance, ANONYMOUS } from '@tosspayments/payment-widget-sdk';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '';

const PLANS = [
  { id: 'starter', name: 'Starter', price: 9900, credits: 500 },
  { id: 'pro', name: 'Pro', price: 29900, credits: 2000 },
  { id: 'premium', name: 'Premium', price: 59900, credits: 5000 },
  { id: 'enterprise', name: 'Enterprise', price: 99900, credits: -1 },
  { id: 'credit-100', name: '추가 크레딧 100', price: 2900, credits: 100 },
  { id: 'credit-500', name: '추가 크레딧 500', price: 12900, credits: 500 },
  { id: 'credit-1000', name: '추가 크레딧 1,000', price: 23900, credits: 1000 },
];

function generateOrderId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AID-${date}-${random}`;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') || 'pro';

  const plan = PLANS.find(p => p.id === planId) || PLANS[1];

  const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_KEY) {
      setError('결제 시스템이 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const widget = await loadPaymentWidget(CLIENT_KEY, ANONYMOUS);
        paymentWidgetRef.current = widget;

        // renderPaymentMethods returns a promise-like that resolves when UI is ready
        const paymentMethodsWidget = widget.renderPaymentMethods('#payment-widget', { value: plan.price }, { variantKey: 'DEFAULT' });
        widget.renderAgreement('#agreement-widget', { variantKey: 'AGREEMENT' });

        // Wait for the widget to fully render
        if (paymentMethodsWidget && typeof (paymentMethodsWidget as unknown as { on?: Function }).on === 'function') {
          (paymentMethodsWidget as unknown as { on: Function }).on('ready', () => {
            setReady(true);
            setLoading(false);
          });
        } else {
          // Fallback: wait a moment for rendering
          await new Promise(resolve => setTimeout(resolve, 1500));
          setReady(true);
          setLoading(false);
        }
      } catch (err) {
        setError('결제 위젯을 불러오는데 실패했습니다.');
        console.error(err);
        setLoading(false);
      }
    })();
  }, [plan.price]);

  const handlePayment = async () => {
    const widget = paymentWidgetRef.current;
    if (!widget) return;

    try {
      await widget.requestPayment({
        orderId: generateOrderId(),
        orderName: `AI Dividend ${plan.name} 플랜`,
        customerEmail: '',
        customerName: '',
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
      });
    } catch (err) {
      console.error('결제 요청 실패:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back Button */}
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/pricing'}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          요금제로 돌아가기
        </button>

        {/* Header */}
        <h1 className="text-2xl font-bold text-center mb-2">결제하기</h1>
        <p className="text-sm text-zinc-400 text-center mb-8">AI Dividend 서비스 이용권 구매</p>

        {/* Order Summary */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">주문 내역</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold">{plan.name} 플랜</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {plan.credits === -1 ? '무제한 크레딧' : `${plan.credits.toLocaleString()} 크레딧 / 월`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-emerald-400">₩{plan.price.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500">부가세 포함</p>
            </div>
          </div>
        </div>

        {/* Payment Widget */}
        {loading && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-12 text-center">
            <svg className="w-8 h-8 animate-spin mx-auto text-emerald-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <p className="text-zinc-400 mt-3 text-sm">결제 위젯 로딩 중...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-800/50 bg-red-950/30 p-5 text-center mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div id="payment-widget" className="mb-4" />
        <div id="agreement-widget" className="mb-6" />

        {/* Pay Button */}
        {ready && (
          <button
            onClick={handlePayment}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 transition-all"
          >
            ₩{plan.price.toLocaleString()} 결제하기
          </button>
        )}

        {/* Notice */}
        <p className="text-[10px] text-zinc-600 text-center mt-4">
          결제 처리는 토스페이먼츠에 의해 안전하게 진행됩니다.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">로딩 중...</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
