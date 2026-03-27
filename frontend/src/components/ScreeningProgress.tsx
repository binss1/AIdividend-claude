'use client';

import { useEffect, useState } from 'react';

interface ScreeningProgressProps {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentSymbol: string | null;
  processed: number;
  total: number;
  found: number;
  estimatedTimeRemaining?: number | null;
  skipped?: number;
  averageTimePerStock?: number | null;
  screeningOrder?: string | null;
  message?: string;
}

export default function ScreeningProgress({
  status,
  currentSymbol,
  processed,
  total,
  found,
  estimatedTimeRemaining,
  skipped = 0,
  averageTimePerStock,
  screeningOrder,
  message,
}: ScreeningProgressProps) {
  const [pulseFound, setPulseFound] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsedNow, setElapsedNow] = useState(0);
  const percentage = total > 0 ? (processed / total) * 100 : 0;

  // Reset startedAt when a new screening begins (status transitions to running with processed=0)
  useEffect(() => {
    if (status === 'running' && processed === 0) {
      setStartedAt(Date.now());
    }
  }, [status, processed]);

  // Update elapsed every second for live timer + self-calculated ETA
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => setElapsedNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (found > 0) {
      setPulseFound(true);
      const timer = setTimeout(() => setPulseFound(false), 600);
      return () => clearTimeout(timer);
    }
  }, [found]);

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '계산 중...';
    if (seconds < 60) return `약 ${Math.ceil(seconds)}초`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `약 ${hrs}시간 ${remMins}분`;
    }
    return `약 ${mins}분 ${secs}초`;
  };

  const formatElapsed = (): string => {
    const elapsed = (Date.now() - startedAt) / 1000;
    if (elapsed < 60) return `${Math.round(elapsed)}초`;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.round(elapsed % 60);
    return `${mins}분 ${secs}초`;
  };

  const statusConfig: Record<string, { text: string; color: string }> = {
    idle: { text: '대기 중', color: 'text-zinc-400' },
    running: { text: '분석 중...', color: 'text-emerald-400' },
    completed: { text: '✅ 스크리닝 완료!', color: 'text-emerald-400' },
    error: { text: '❌ 오류 발생', color: 'text-red-400' },
  };

  if (status === 'idle') return null;

  const passRate = processed > 0 ? ((found / processed) * 100).toFixed(1) : '0.0';

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-6 shadow-xl shadow-black/20">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {status === 'running' && (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </div>
          )}
          {status === 'completed' && (
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {status === 'error' && (
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <span className={`text-sm font-medium ${statusConfig[status]?.color || 'text-zinc-300'}`}>
            {statusConfig[status]?.text}
          </span>
        </div>
        <div className="text-sm text-zinc-400 font-mono">
          {processed} / {total}
          <span className="text-zinc-600 ml-2">({percentage.toFixed(1)}%)</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            status === 'error'
              ? 'bg-gradient-to-r from-red-600 to-red-500'
              : status === 'completed'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
              : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
        {status === 'running' && (
          <div
            className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {/* 현재 종목 */}
        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">분석 중</div>
          <div className="text-xs font-mono text-emerald-400 font-medium truncate">
            {status === 'running' && currentSymbol ? currentSymbol : status === 'completed' ? '완료' : '-'}
          </div>
        </div>

        {/* 발견 */}
        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">발견 (통과율)</div>
          <div className={`text-xs font-mono font-medium transition-all duration-300 ${pulseFound ? 'text-emerald-300 scale-105' : 'text-emerald-400'}`}>
            {found}개 <span className="text-zinc-500">({passRate}%)</span>
          </div>
        </div>

        {/* 예상 잔여 시간 */}
        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">예상 완료</div>
          <div className="text-xs font-mono text-amber-400 font-medium">
            {(() => {
              if (status === 'completed') return '완료됨';
              if (status !== 'running') return '-';
              // Use prop if provided
              if (estimatedTimeRemaining != null && estimatedTimeRemaining > 0) {
                return formatTime(estimatedTimeRemaining);
              }
              // Self-calculate ETA from elapsed time + progress
              if (processed >= 3 && total > 0) {
                const elapsedSec = (Date.now() - startedAt) / 1000;
                const avgPerItem = elapsedSec / processed;
                const remaining = (total - processed) * avgPerItem;
                void elapsedNow; // trigger re-render from timer
                return formatTime(remaining);
              }
              return '계산 중...';
            })()}
          </div>
        </div>

        {/* 경과 시간 */}
        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">경과 시간</div>
          <div className="text-xs font-mono text-zinc-300 font-medium">
            {status === 'running' || status === 'completed' ? (void elapsedNow, formatElapsed()) : '-'}
          </div>
        </div>
      </div>

      {/* Bottom Info Row */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          {skipped > 0 && (
            <span>스킵: <span className="text-zinc-400">{skipped}개</span></span>
          )}
          {averageTimePerStock != null && averageTimePerStock > 0 && status === 'running' && (
            <span>종목당: <span className="text-zinc-400">{averageTimePerStock.toFixed(1)}초</span></span>
          )}
        </div>
        {message && <span className="text-zinc-500">{message}</span>}
      </div>

      {/* Screening Order Info (shown initially) */}
      {screeningOrder && status === 'running' && processed <= 20 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60">
          <div className="text-[11px] text-zinc-500 flex items-start gap-2">
            <span className="text-zinc-600 shrink-0">ℹ️</span>
            <span className="leading-relaxed">{screeningOrder}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
