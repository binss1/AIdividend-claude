'use client';

import { useEffect, useState } from 'react';

interface ScoreBarProps {
  score: number;
  maxScore?: number;
  height?: number;
  showLabel?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'from-emerald-500 to-emerald-400';
  if (score >= 60) return 'from-green-500 to-green-400';
  if (score >= 40) return 'from-yellow-500 to-yellow-400';
  if (score >= 20) return 'from-orange-500 to-orange-400';
  return 'from-red-500 to-red-400';
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

export default function ScoreBar({
  score,
  maxScore = 100,
  height = 8,
  showLabel = true,
}: ScoreBarProps) {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const percentage = Math.min((score / maxScore) * 100, 100);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className="flex-1 rounded-full bg-zinc-800 overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getScoreColor(score)} transition-all duration-700 ease-out`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold tabular-nums min-w-[32px] text-right ${getScoreTextColor(score)}`}>
          {score.toFixed(1)}
        </span>
      )}
    </div>
  );
}
