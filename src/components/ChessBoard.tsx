// src/components/ChessBoard.tsx
// Plateau d'échecs interactif Android & Desktop — 100% dégagé (aucun badge ni bouton ne cache les pièces sur les 64 cases)
// Flèche d'aide affichée uniquement sur demande explicite du joueur (quota limité à 3 par partie hors-ligne, strictement interdit en ligne)
import React, { useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Move } from 'chess.js';
import { BOARD_THEMES, useAppStore } from '../store/useAppStore.ts';
import { TacticalSquareOverlay } from '../lib/stockfish.worker.ts';
import { AnnotatedMoveMeta } from '../hooks/useChessGame.ts';

interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  onMove: (from: string, to: string, promotion?: string) => boolean;
  getLegalMoves: (square: string) => Move[];
  lastMoveSquares?: { from: string; to: string } | null;
  hintArrow?: [string, string] | null;
  threatArrow?: [string, string] | null;
  tacticalHeatmap?: Record<string, TacticalSquareOverlay['type']>;
  evaluationCp?: number;
}

const PROMOTION_PIECES = [
  { code: 'q', label: 'Dame (Q)', symbol: '♕' },
  { code: 'r', label: 'Tour (R)', symbol: '♖' },
  { code: 'b', label: 'Fou (B)', symbol: '♗' },
  { code: 'n', label: 'Cavalier (N)', symbol: '♘' },
];

export const CLASSIFICATION_BADGES: Record<
  AnnotatedMoveMeta['classification'],
  { symbol: string; label: string; bg: string; text: string }
> = {
  brilliant: {
    symbol: '!!',
    label: 'Coup Brillant',
    bg: 'bg-cyan-500',
    text: 'text-slate-950',
  },
  great: {
    symbol: '!',
    label: 'Très Bon Coup',
    bg: 'bg-sky-500',
    text: 'text-white',
  },
  best: {
    symbol: '★',
    label: 'Meilleur Coup',
    bg: 'bg-[#769656]',
    text: 'text-white',
  },
  good: {
    symbol: '✓',
    label: 'Bon Coup',
    bg: 'bg-emerald-700',
    text: 'text-white',
  },
  inaccuracy: {
    symbol: '?!',
    label: 'Imprécision',
    bg: 'bg-amber-500',
    text: 'text-slate-950',
  },
  mistake: {
    symbol: '?',
    label: 'Erreur',
    bg: 'bg-orange-500',
    text: 'text-white',
  },
  blunder: {
    symbol: '??',
    label: 'Gaffe Critique',
    bg: 'bg-red-600',
    text: 'text-white',
  },
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation,
  onMove,
  getLegalMoves,
  lastMoveSquares = null,
  hintArrow = null,
  threatArrow = null,
  tacticalHeatmap = {},
  evaluationCp = 0,
}) => {
  const { boardTheme, pieceStyle } = useAppStore();
  const activeTheme = BOARD_THEMES[boardTheme] || BOARD_THEMES.emerald;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<Move[]>([]);
  const [annotatedSquares, setAnnotatedSquares] = useState<Record<string, boolean>>({});
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);

  // Réinitialiser la sélection lorsque la position FEN change
  React.useEffect(() => {
    setSelectedSquare(null);
    setLegalTargets([]);
  }, [fen]);

  const checkIsPromotion = (from: string, to: string, moves: Move[]): boolean => {
    return moves.some((m) => m.from === from && m.to === to && Boolean(m.promotion));
  };

  // Sélectionner la pièce dès le début d'un glisser tactile (permet aussi le tap-to-move sur Android)
  const handlePieceDrag = ({ square }: { square: string | null }) => {
    if (!square) return;
    const movesForSquare = getLegalMoves(square);
    if (movesForSquare.length > 0) {
      setSelectedSquare(square);
      setLegalTargets(movesForSquare);
    }
  };

  // Clic ou Tap tactile sur une case : sélectionner une pièce ou jouer vers une case cible légale
  const handleSquareClick = ({ square }: { square: string }) => {
    setAnnotatedSquares({});

    if (selectedSquare && selectedSquare !== square) {
      const isTargetLegal = legalTargets.some((m) => m.to === square);
      if (isTargetLegal) {
        if (checkIsPromotion(selectedSquare, square, legalTargets)) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }
        const moved = onMove(selectedSquare, square, 'q');
        if (moved) {
          setSelectedSquare(null);
          setLegalTargets([]);
          return;
        }
      }
    }

    const movesForSquare = getLegalMoves(square);
    if (movesForSquare.length > 0) {
      setSelectedSquare(square);
      setLegalTargets(movesForSquare);
    } else {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  // Drag & Drop d'une pièce
  const handlePieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean => {
    if (!targetSquare || sourceSquare === targetSquare) return false;
    const movesFromSource = getLegalMoves(sourceSquare);

    if (checkIsPromotion(sourceSquare, targetSquare, movesFromSource)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }

    const success = onMove(sourceSquare, targetSquare, 'q');
    if (success) {
      setSelectedSquare(null);
      setLegalTargets([]);
      setPremove(null);
      return true;
    } else {
      setPremove({ from: sourceSquare, to: targetSquare });
      return false;
    }
  };

  const handleSquareRightClick = ({ square }: { square: string }) => {
    setAnnotatedSquares((prev) => ({
      ...prev,
      [square]: !prev[square],
    }));
  };

  // Flèches affichées UNIQUEMENT si le joueur a explicitement activé l'un de ses 3 droits d'aide hors-ligne
  const boardArrows = useMemo(() => {
    const list: { startSquare: string; endSquare: string; color: string }[] = [];

    if (hintArrow) {
      list.push({
        startSquare: hintArrow[0],
        endSquare: hintArrow[1],
        color: 'rgba(34, 197, 94, 0.9)',
      });
    }

    if (threatArrow) {
      list.push({
        startSquare: threatArrow[0],
        endSquare: threatArrow[1],
        color: 'rgba(239, 68, 68, 0.85)',
      });
    }

    return list;
  }, [hintArrow, threatArrow]);

  // Styles dynamiques des cases
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    Object.entries(tacticalHeatmap).forEach(([sq, kind]) => {
      if (kind === 'hanging') {
        styles[sq] = {
          backgroundColor: 'rgba(239, 68, 68, 0.55)',
          boxShadow: 'inset 0 0 0 3px rgba(254, 202, 202, 0.9)',
        };
      } else if (kind === 'king-danger') {
        styles[sq] = {
          backgroundColor: 'rgba(220, 38, 38, 0.75)',
          boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.8)',
        };
      } else if (kind === 'threatened') {
        styles[sq] = {
          boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.75)',
        };
      } else if (kind === 'controlled-white') {
        styles[sq] = {
          backgroundColor: 'rgba(118, 150, 86, 0.25)',
        };
      } else if (kind === 'controlled-black') {
        styles[sq] = {
          backgroundColor: 'rgba(56, 189, 248, 0.22)',
        };
      }
    });

    if (lastMoveSquares) {
      styles[lastMoveSquares.from] = {
        ...styles[lastMoveSquares.from],
        backgroundColor: 'rgba(245, 246, 130, 0.48)',
      };
      styles[lastMoveSquares.to] = {
        ...styles[lastMoveSquares.to],
        backgroundColor: 'rgba(245, 246, 130, 0.62)',
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(118, 150, 86, 0.82)',
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.55)',
      };
    }

    for (const move of legalTargets) {
      styles[move.to] = {
        ...styles[move.to],
        backgroundImage: move.captured
          ? 'radial-gradient(circle, transparent 52%, rgba(239, 68, 68, 0.82) 58%)'
          : 'radial-gradient(circle, rgba(22, 101, 52, 0.65) 24%, transparent 28%)',
      };
    }

    if (premove) {
      styles[premove.from] = { backgroundColor: 'rgba(239, 68, 68, 0.4)' };
      styles[premove.to] = { backgroundColor: 'rgba(239, 68, 68, 0.5)' };
    }

    Object.keys(annotatedSquares).forEach((sq) => {
      if (annotatedSquares[sq]) {
        styles[sq] = {
          ...styles[sq],
          backgroundColor: 'rgba(235, 97, 80, 0.65)',
        };
      }
    });

    return styles;
  }, [annotatedSquares, lastMoveSquares, legalTargets, premove, selectedSquare, tacticalHeatmap]);

  const whiteAdvantagePct = useMemo(() => {
    const clamped = Math.max(-1000, Math.min(1000, evaluationCp));
    return Math.round(50 + (clamped / 1000) * 45);
  }, [evaluationCp]);

  const evalFormatted = useMemo(() => {
    if (Math.abs(evaluationCp) >= 9000) return 'MAT';
    const pawns = (evaluationCp / 100).toFixed(1);
    return evaluationCp > 0 ? `+${pawns}` : pawns;
  }, [evaluationCp]);

  const pieceFilterClass =
    pieceStyle === 'neo'
      ? 'contrast-110 saturate-125'
      : pieceStyle === 'tournament'
        ? 'sepia-[0.18] contrast-105'
        : pieceStyle === 'classic'
          ? 'brightness-95 contrast-110'
          : pieceStyle === 'minimal'
            ? 'grayscale-[0.25] contrast-125'
            : '';

  return (
    <div className="w-full flex flex-col sm:flex-row items-center sm:items-stretch justify-center gap-2 select-none">
      {/* Barre d'évaluation HORIZONTALE sur Android / Mobile */}
      <div
        className="flex sm:hidden w-full max-w-[540px] h-4 rounded-md overflow-hidden bg-[#262421] border border-white/15 relative items-center"
        title={`Évaluation Stockfish : ${evalFormatted}`}
      >
        <div
          className="h-full bg-[#EEEED2] transition-transform duration-200 origin-left w-full"
          style={{
            transform: `scaleX(${whiteAdvantagePct / 100})`,
          }}
        />
        <span className="absolute inset-0 flex items-center justify-between px-2 font-mono text-[10px] font-bold text-[#769656] mix-blend-difference tabular-nums">
          <span>BLANCS</span>
          <span>Éval : {evalFormatted}</span>
          <span>NOIRS</span>
        </span>
      </div>

      {/* Barre d'évaluation VERTICALE sur Desktop */}
      <div
        className="hidden sm:flex w-6 rounded-md overflow-hidden bg-[#262421] border border-white/15 flex-col justify-between relative shrink-0"
        title={`Évaluation Stockfish : ${evalFormatted}`}
      >
        <div
          className="w-full bg-[#EEEED2] transition-transform duration-200 origin-bottom"
          style={{
            height: '100%',
            transform: `scaleY(${whiteAdvantagePct / 100})`,
          }}
        />
        <span className="absolute top-1.5 inset-x-0 text-center font-mono text-[9px] font-bold text-[#95BB4A] mix-blend-difference tabular-nums">
          {evalFormatted}
        </span>
      </div>

      {/* Conteneur carré strict de l'échiquier — AUCUNE surimpression ne cache les pièces */}
      <div
        className={`relative w-full max-w-[540px] aspect-square rounded-lg overflow-hidden shadow-2xl border border-white/20 touch-none bg-[#161512] ${pieceFilterClass}`}
      >
        <div className="w-full h-full">
          <Chessboard
            options={{
              position: fen,
              boardOrientation: orientation,
              darkSquareStyle: { backgroundColor: activeTheme.darkSquare },
              lightSquareStyle: { backgroundColor: activeTheme.lightSquare },
              squareStyles: customSquareStyles,
              showNotation: true,
              allowDrawingArrows: false,
              dragActivationDistance: 8,
              animationDurationInMs: 160,
              arrows: boardArrows,
              onPieceDrag: handlePieceDrag,
              onSquareClick: handleSquareClick,
              onPieceDrop: handlePieceDrop,
              onSquareRightClick: handleSquareRightClick,
            }}
          />
        </div>

        {/* Modale de Promotion de Pion uniquement lors d'une promotion */}
        {pendingPromotion && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30 p-4">
            <div className="bg-[#23211D] border border-white/20 rounded-xl p-5 max-w-xs w-full shadow-2xl">
              <h4 className="text-sm font-semibold text-white mb-3 text-center">
                Choisir la pièce de promotion
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                {PROMOTION_PIECES.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => {
                      onMove(pendingPromotion.from, pendingPromotion.to, p.code);
                      setPendingPromotion(null);
                      setSelectedSquare(null);
                      setLegalTargets([]);
                    }}
                    className="flex flex-col items-center justify-center min-h-[64px] p-3 rounded-lg bg-[#161512] hover:bg-[#769656] text-slate-100 hover:text-white border border-white/10 transition-colors"
                  >
                    <span className="text-2xl mb-1">{p.symbol}</span>
                    <span className="text-xs font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingPromotion(null)}
                className="w-full mt-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
