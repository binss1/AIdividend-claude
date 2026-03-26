'use client';

import { StockGrade } from '@/types';

interface GradeBadgeProps {
  grade: StockGrade;
  size?: 'sm' | 'md' | 'lg';
}

const gradeStyles: Record<string, string> = {
  'A+': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/20 shadow-lg',
  'A':  'bg-green-500/20 text-green-400 border-green-500/30',
  'A-': 'bg-green-600/20 text-green-500 border-green-600/30',
  'B+': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'B':  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'B-': 'bg-cyan-600/20 text-cyan-500 border-cyan-600/30',
  'C+': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'C':  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'C-': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'D':  'bg-red-500/20 text-red-400 border-red-500/30',
  'F':  'bg-red-700/20 text-red-500 border-red-700/30',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export default function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  const style = gradeStyles[grade] || gradeStyles['D'];

  return (
    <span
      className={`
        inline-flex items-center justify-center font-bold rounded-full border
        transition-all duration-200 hover:scale-110 cursor-default
        ${style} ${sizeStyles[size]}
      `}
    >
      {grade}
    </span>
  );
}
