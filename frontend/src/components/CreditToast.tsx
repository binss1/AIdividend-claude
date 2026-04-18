'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import Link from 'next/link';

interface CreditToastContextType {
  showCreditToast: (message?: string) => void;
}

const CreditToastContext = createContext<CreditToastContextType>({
  showCreditToast: () => {},
});

export function useCreditToast() {
  return useContext(CreditToastContext);
}

// Global event for apiFetch (outside React) to trigger toast
const CREDIT_TOAST_EVENT = 'credit-toast-show';

export function triggerCreditToast(message?: string) {
  window.dispatchEvent(new CustomEvent(CREDIT_TOAST_EVENT, { detail: { message } }));
}

export function CreditToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 300);
  }, []);

  const showCreditToast = useCallback((msg?: string) => {
    setMessage(msg || '크레딧이 부족합니다.');
    setClosing(false);
    setVisible(true);
  }, []);

  // Listen for global events from apiFetch
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      showCreditToast(detail?.message);
    };
    window.addEventListener(CREDIT_TOAST_EVENT, handler);
    return () => window.removeEventListener(CREDIT_TOAST_EVENT, handler);
  }, [showCreditToast]);

  // Auto-close after 3 seconds
  useEffect(() => {
    if (!visible || closing) return;
    const timer = setTimeout(close, 3000);
    return () => clearTimeout(timer);
  }, [visible, closing, close]);

  return (
    <CreditToastContext.Provider value={{ showCreditToast }}>
      {children}
      {visible && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-4 transition-all duration-300 ${
            closing ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
          }`}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/95 backdrop-blur-xl px-5 py-4 shadow-xl shadow-black/40">
            {/* Warning icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{message}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <Link
                  href="/pricing?tab=credits"
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  onClick={close}
                >
                  충전하기
                </Link>
                <span className="text-gray-600 text-xs">|</span>
                <Link
                  href="/pricing"
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  onClick={close}
                >
                  플랜 업그레이드
                </Link>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={close}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </CreditToastContext.Provider>
  );
}
