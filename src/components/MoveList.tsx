// src/components/MoveList.tsx
// Feuille de partie PGN avancée : Badges tactiques (!!, !, ★, ?!, ?, ??), Courbe d'évaluation interactive,
// Navigation coup par coup (← →) et bouton d'analyse IA par coup
import React, { useEffect } from 'react';
import { Move } from 'chess.js';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { AnnotatedMoveMeta } from '../hooks/useChessGame.ts';
import { CLASSIFICATION_BADGES } from './ChessBoard.tsx';

interface MoveListProps {
  moves: Move[];
  annotatedMoves?: AnnotatedMoveMeta[];
  viewingIndex: number | null;
  onSelectMoveIndex: (idx: number | null) => void;
  onAnalyzeMoveWithAi?: (idx: number) => void;
  pgn: string;
}

export const MoveList: React.FC<MoveListProps> = ({
  moves,
  annotatedMoves = [],
  viewingIndex,
  onSelectMoveIndex,
  onAnalyzeMoveWithAi,
  pgn,
}) => {
  const [copied, setCopied] = React.useState(false);

  // Regrouper les coups par paires (1. Blancs Noirs) avec leurs annotations tactiques
  const pairs: {
    moveNumber: number;
    white?: Move;
    whiteMeta?: AnnotatedMoveMeta;
    whiteIdx?: number;
    black?: Move;
    blackMeta?: AnnotatedMoveMeta;
    blackIdx?: number;
  }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      whiteMeta: annotatedMoves[i],
      whiteIdx: i,
      black: moves[i + 1],
      blackMeta: i + 1 < annotatedMoves.length ? annotatedMoves[i + 1] : undefined,
      blackIdx: i + 1 < moves.length ? i + 1 : undefined,
    });
  }

  const activeIdx = viewingIndex === null ? moves.length - 1 : viewingIndex;

  // Support clavier Flèche Gauche / Flèche Droite pour naviguer dans les coups
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft' && moves.length > 0) {
        e.preventDefault();
        const prev = Math.max(0, activeIdx - 1);
        onSelectMoveIndex(prev);
      } else if (e.key === 'ArrowRight' && viewingIndex !== null) {
        e.preventDefault();
        if (viewingIndex >= moves.length - 1) {
          onSelectMoveIndex(null);
        } else {
          onSelectMoveIndex(viewingIndex + 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIdx, moves.length, onSelectMoveIndex, viewingIndex]);

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(pgn || '1. e4 e5');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const renderMoveBadge = (meta?: AnnotatedMoveMeta) => {
    if (!meta) return null;
    const badge = CLASSIFICATION_BADGES[meta.classification];
    return (
      <span
        className={`inline-flex items-center justify-center px-1 min-w-[18px] h-4 rounded text-[9px] font-extrabold ${badge.bg} ${badge.text}`}
        title={`${badge.label} (${meta.evalCp >= 0 ? '+' : ''}${(meta.evalCp / 100).toFixed(1)})`}
      >
        {badge.symbol}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#1D1B18] border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-[#23211D]">
        <span className="text-xs font-semibold text-slate-200">
          Notation & Qualité des Coups ({moves.length})
        </span>
        <div className="flex items-center gap-2">
          {onAnalyzeMoveWithAi && moves.length > 0 && (
            <button
              type="button"
              onClick={() => onAnalyzeMoveWithAi(activeIdx)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#769656]/25 hover:bg-[#769656] border border-[#769656] text-[11px] font-semibold text-[#EEEED2] hover:text-white transition-colors"
              title="Commenter ce coup avec le Coach IA"
            >
              <Sparkles className="w-3 h-3" />
              <span>Coach IA</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyPgn}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors whitespace-nowrap"
            title="Copier le PGN"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#769656]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'Copié' : 'PGN'}</span>
          </button>
        </div>
      </div>

      {/* Mini Courbe d'Évaluation Interactive Coup par Coup */}
      {annotatedMoves.length > 1 && (
        <div className="px-3 py-2 bg-[#161512] border-b border-white/10">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
            <span>Courbe d’Avantage (Cliquez un coup)</span>
            <span>
              {annotatedMoves[activeIdx]
                ? `${annotatedMoves[activeIdx].evalCp >= 0 ? '+' : ''}${(
                    annotatedMoves[activeIdx].evalCp / 100
                  ).toFixed(1)}`
                : '0.0'}
            </span>
          </div>
          <div className="h-10 w-full flex items-end gap-0.5 bg-[#23211D] rounded p-1 overflow-x-auto">
            {annotatedMoves.map((m, i) => {
              const clamped = Math.max(-600, Math.min(600, m.evalCp));
              const heightPct = Math.round(50 + (clamped / 600) * 45);
              const isSelected = i === activeIdx;
              const isError = m.classification === 'blunder' || m.classification === 'mistake';
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => (i === moves.length - 1 ? onSelectMoveIndex(null) : onSelectMoveIndex(i))}
                  title={`${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san} (${
                    CLASSIFICATION_BADGES[m.classification].label
                  })`}
                  className={`flex-1 min-w-[6px] rounded-t transition-all ${
                    isSelected
                      ? 'bg-[#95BB4A] ring-1 ring-white'
                      : isError
                        ? 'bg-red-500/85 hover:bg-red-400'
                        : m.evalCp >= 0
                          ? 'bg-[#EEEED2]/80 hover:bg-white'
                          : 'bg-slate-600 hover:bg-slate-400'
                  }`}
                  style={{ height: `${Math.max(12, heightPct)}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Table des coups */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 font-mono text-xs tabular-nums min-h-[150px] max-h-[240px]">
        {pairs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-sans">
            Déplacez une pièce sur l’échiquier pour démarrer la notation algébrique et l’analyse.
          </div>
        ) : (
          pairs.map((row) => (
            <div
              key={row.moveNumber}
              className="grid grid-cols-7 items-center px-3 py-1.5 hover:bg-white/5"
            >
              <span className="col-span-1 text-slate-500">{row.moveNumber}.</span>
              <button
                type="button"
                onClick={() =>
                  row.whiteIdx === moves.length - 1
                    ? onSelectMoveIndex(null)
                    : onSelectMoveIndex(row.whiteIdx ?? null)
                }
                className={`col-span-3 flex items-center justify-between gap-1 text-left px-2 py-0.5 rounded transition-colors ${
                  activeIdx === row.whiteIdx
                    ? 'bg-[#769656]/30 text-white font-semibold border border-[#769656]/50'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                <span className="truncate">{row.white?.san || ''}</span>
                {renderMoveBadge(row.whiteMeta)}
              </button>
              {row.black ? (
                <button
                  type="button"
                  onClick={() =>
                    row.blackIdx === moves.length - 1
                      ? onSelectMoveIndex(null)
                      : onSelectMoveIndex(row.blackIdx ?? null)
                  }
                  className={`col-span-3 flex items-center justify-between gap-1 text-left px-2 py-0.5 rounded transition-colors ${
                    activeIdx === row.blackIdx
                      ? 'bg-[#769656]/30 text-white font-semibold border border-[#769656]/50'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="truncate">{row.black.san}</span>
                  {renderMoveBadge(row.blackMeta)}
                </button>
              ) : (
                <span className="col-span-3" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Barre de navigation PGN (|<< < > >>|) */}
      <div className="grid grid-cols-4 gap-1 p-2 border-t border-white/10 bg-[#23211D]">
        <button
          type="button"
          onClick={() => (moves.length > 0 ? onSelectMoveIndex(0) : null)}
          disabled={moves.length === 0}
          className="flex items-center justify-center py-1.5 rounded bg-[#161512] text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          aria-label="Premier coup"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() =>
            moves.length > 0 ? onSelectMoveIndex(Math.max(0, activeIdx - 1)) : null
          }
          disabled={moves.length === 0 || activeIdx <= 0}
          className="flex items-center justify-center py-1.5 rounded bg-[#161512] text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          aria-label="Coup précédent"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (viewingIndex === null) return;
            if (viewingIndex >= moves.length - 1) onSelectMoveIndex(null);
            else onSelectMoveIndex(viewingIndex + 1);
          }}
          disabled={viewingIndex === null}
          className="flex items-center justify-center py-1.5 rounded bg-[#161512] text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          aria-label="Coup suivant"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onSelectMoveIndex(null)}
          disabled={viewingIndex === null}
          className="flex items-center justify-center py-1.5 rounded bg-[#161512] text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          aria-label="Position actuelle en direct"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
