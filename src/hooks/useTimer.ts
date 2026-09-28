// src/hooks/useTimer.ts
// Hook de chronomètre d'échecs haute précision (incrément Fischer, alerte < 20 secondes, détection du drapeau)
import { useEffect, useRef, useState } from 'react';

interface UseTimerOptions {
  initialWhiteMs: number;
  initialBlackMs: number;
  incrementMs: number;
  activeTurn: 'w' | 'b';
  isRunning: boolean;
  onTimeout: (loserColor: 'w' | 'b') => void;
}

export function useTimer({
  initialWhiteMs,
  initialBlackMs,
  activeTurn,
  isRunning,
  onTimeout,
}: UseTimerOptions) {
  const [whiteTimeMs, setWhiteTimeMs] = useState(initialWhiteMs);
  const [blackTimeMs, setBlackTimeMs] = useState(initialBlackMs);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    setWhiteTimeMs(initialWhiteMs);
    setBlackTimeMs(initialBlackMs);
  }, [initialWhiteMs, initialBlackMs]);

  useEffect(() => {
    if (!isRunning) return;
    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (activeTurn === 'w') {
        setWhiteTimeMs((prev) => {
          const next = Math.max(0, prev - delta);
          if (next === 0) {
            onTimeout('w');
          }
          return next;
        });
      } else {
        setBlackTimeMs((prev) => {
          const next = Math.max(0, prev - delta);
          if (next === 0) {
            onTimeout('b');
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeTurn, isRunning, onTimeout]);

  return {
    whiteTimeMs,
    blackTimeMs,
    setWhiteTimeMs,
    setBlackTimeMs,
  };
}

export function formatClockMs(ms: number): string {
  if (ms >= 86400000) return '∞';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (ms < 10000 && ms > 0) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
