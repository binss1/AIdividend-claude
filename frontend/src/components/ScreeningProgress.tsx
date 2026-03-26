'use client';

import { useEffect, useState } from 'react';

interface ScreeningProgressProps {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentSymbol: string | null;
  processed: number;
  total: number;
  found: number;
  estimatedTimeRemaining?: number | null;
  message?: string;
}

export default function ScreeningProgress({
  status,
  currentSymbol,
  processed,
  total,
  found,
  estimatedTimeRemaining,
  message,
}: ScreeningProgressProps) {
  const [pulseFound, setPulseFound] = useState(false);
  const percentage = total > 0 ? (processed / total) * 100 : 0;

  useEffect(() => {
    if (found > 0) {
      setPulseFound(true);
      const timer = setTimeout(() => setPulseFound(false), 600);
      return () => clearTimeout(timer);
    }
  }, [found]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.ceil(seconds)}초`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}분 ${secs}초`;
  };

  const statusText: Record<string, string> = {
    idle: '대기 중',
    running: '분석 중...',
    completed: '완료!',
    error: '오류 발생',
  };

  if (status === 'idle') return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
      {/* Header */}
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
          <span className="text-sm font-medium text-zinc-300">
            {statusText[status]}
          </span>
        </div>
        <div className="text-sm text-zinc-500">
          {processed} / {total}
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

      {/* Details */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          {currentSymbol && status === 'running' && (
            <span className="text-zinc-400">
              분석 중: <span className="text-emerald-400 font-mono font-medium">{currentSymbol}</span>
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 transition-all duration-300 ${
              pulseFound ? 'text-emerald-300 scale-110' : 'text-zinc-400'
            }`}
          >
            발견:{' '}
            <span className="text-emerald-400 font-semibold">{found}</span>개
          </span>
        </div>
        <div className="flex items-center gap-4">
          {estimatedTimeRemaining != null && estimatedTimeRemaining > 0 && status === 'running' && (
            <span className="text-zinc-500">
              예상 잔여: {formatTime(estimatedTimeRemaining)}
            </span>
          )}
          {message && (
            <span className="text-zinc-500">{message}</span>
          )}
        </div>
      </div>

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
