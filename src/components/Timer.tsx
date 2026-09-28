// src/components/Timer.tsx
// Horloge d'échecs numérique haute lisibilité (Android & Desktop) avec barre de progression et alerte < 20s
import React from 'react';
import { Clock } from 'lucide-react';
import { formatClockMs } from '../hooks/useTimer.ts';

interface TimerProps {
  timeMs: number;
  initialTimeMs: number;
  isActive: boolean;
  label?: string;
}

export const Timer: React.FC<TimerProps> = ({ timeMs, initialTimeMs, isActive }) => {
  const isLowTime = timeMs < 20000 && timeMs > 0 && initialTimeMs < 86400000;
  const pct =
    initialTimeMs >= 86400000
      ? 100
      : Math.max(0, Math.min(100, Math.round((timeMs / Math.max(1, initialTimeMs)) * 100)));

  return (
    <div className="flex flex-col items-end shrink-0">
      <div
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg font-mono text-sm sm:text-base font-bold tabular-nums transition-colors ${
          isLowTime
            ? 'bg-red-950 text-red-200 border border-red-500/60 animate-pulse'
            : isActive
              ? 'bg-[#769656] text-white shadow-sm'
              : 'bg-[#161512] text-slate-300 border border-white/10'
        }`}
      >
        <Clock className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'animate-spin' : 'opacity-60'}`} />
        <span>{formatClockMs(timeMs)}</span>
      </div>
      {/* Barre de progression du temps restant */}
      <div className="w-20 sm:w-24 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full transition-transform duration-150 origin-left ${
            isLowTime ? 'bg-red-500' : 'bg-[#769656]'
          }`}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
};
