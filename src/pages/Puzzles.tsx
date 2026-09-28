// src/pages/Puzzles.tsx
// Puzzles Tactiques & Entraînement : Puzzle Quotidien, Mode "Survivre" en série et Indice
import React, { useEffect, useMemo, useState } from 'react';
import { Chess, Move } from 'chess.js';
import { Flame, Lightbulb, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { ChessBoard } from '../components/ChessBoard.tsx';
import { apiRequest } from '../lib/api.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { chessSounds } from '../lib/sound.ts';

export const Puzzles: React.FC = () => {
  const { user, updateUser } = useAppStore();

  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [survivalMode, setSurvivalMode] = useState(false);
  const [survivalStreak, setSurvivalStreak] = useState(0);
  const [survivalLives, setSurvivalLives] = useState(3);

  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>(chess.fen());
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<'SOLVING' | 'SOLVED' | 'FAILED'>('SOLVING');
  const [hintArrow, setHintArrow] = useState<[string, string] | null>(null);

  useEffect(() => {
    apiRequest<{ puzzles: any[] }>('/api/games/puzzles')
      .then((res) => {
        if (res.puzzles && res.puzzles.length > 0) {
          setPuzzles(res.puzzles);
          loadPuzzleInstance(res.puzzles[0]);
        }
      })
      .catch(() => {});
  }, []);

  const currentPuzzle = puzzles[currentIndex] || null;

  const solutionTokens = useMemo(() => {
    if (!currentPuzzle?.solutionMoves) return [];
    return String(currentPuzzle.solutionMoves).trim().split(/\s+/);
  }, [currentPuzzle]);

  const loadPuzzleInstance = (puz: any) => {
    const c = new Chess(puz.fen);
    setChess(c);
    setFen(c.fen());
    setStepIndex(0);
    setStatus('SOLVING');
    setHintArrow(null);
  };

  const handleSelectPuzzle = (idx: number) => {
    setCurrentIndex(idx);
    if (puzzles[idx]) {
      loadPuzzleInstance(puzzles[idx]);
    }
  };

  const recordPuzzleOutcome = async (success: boolean) => {
    if (!user || !currentPuzzle) return;
    try {
      const res = await apiRequest('/api/games/puzzles/solve', {
        method: 'POST',
        body: JSON.stringify({
          success,
          difficultyElo: currentPuzzle.difficultyElo,
        }),
      });
      if (res.user) updateUser(res.user);
    } catch {
      // Ignorer
    }
  };

  const handleMove = (from: string, to: string, promotion = 'q'): boolean => {
    if (status !== 'SOLVING' || !currentPuzzle) return false;

    const temp = new Chess(chess.fen());
    let moveObj: Move | null = null;
    try {
      moveObj = temp.move({ from, to, promotion });
    } catch {
      return false;
    }
    if (!moveObj) return false;

    const expectedToken = solutionTokens[stepIndex];
    const matchesSan = moveObj.san.replace(/[+#]/g, '') === expectedToken?.replace(/[+#]/g, '');
    const matchesUci = `${moveObj.from}${moveObj.to}` === expectedToken;

    if (matchesSan || matchesUci || temp.isCheckmate()) {
      chess.move({ from, to, promotion });
      setFen(chess.fen());
      setHintArrow(null);
      chessSounds.playMove();

      if (stepIndex + 1 >= solutionTokens.length || chess.isCheckmate()) {
        setStatus('SOLVED');
        chessSounds.playGameEnd(true);
        setSurvivalStreak((s) => s + 1);
        recordPuzzleOutcome(true);
      } else {
        // Jouer automatiquement la réponse adverse si le puzzle comporte plusieurs coups
        const replyToken = solutionTokens[stepIndex + 1];
        setTimeout(() => {
          try {
            chess.move(replyToken);
            setFen(chess.fen());
            setStepIndex((s) => s + 2);
          } catch {
            setStatus('SOLVED');
          }
        }, 350);
      }
      return true;
    } else {
      setStatus('FAILED');
      chessSounds.playGameEnd(false);
      if (survivalMode) {
        setSurvivalLives((l) => Math.max(0, l - 1));
      }
      recordPuzzleOutcome(false);
      return false;
    }
  };

  const handleShowHint = () => {
    const legal = chess.moves({ verbose: true });
    const expected = solutionTokens[stepIndex];
    const match = legal.find(
      (m) =>
        m.san.replace(/[+#]/g, '') === expected?.replace(/[+#]/g, '') ||
        `${m.from}${m.to}` === expected
    );
    if (match) {
      setHintArrow([match.from, match.to]);
    } else if (legal[0]) {
      setHintArrow([legal[0].from, legal[0].to]);
    }
  };

  const nextPuzzle = () => {
    const nextIdx = (currentIndex + 1) % Math.max(1, puzzles.length);
    handleSelectPuzzle(nextIdx);
  };

  return (
    <div className="max-w-[1320px] mx-auto px-2 sm:px-6 py-3 sm:py-6 pb-24 md:pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Échiquier du Puzzle */}
        <div className="lg:col-span-7 bg-[#23211D] border border-white/10 rounded-xl p-1.5 sm:p-4 flex items-center justify-center">
          <ChessBoard
            fen={fen}
            orientation={chess.turn() === 'b' && stepIndex === 0 ? 'black' : 'white'}
            onMove={handleMove}
            getLegalMoves={(sq) => {
              try {
                return chess.moves({ square: sq as any, verbose: true });
              } catch {
                return [];
              }
            }}
            hintArrow={hintArrow}
          />
        </div>

        {/* Panneau Tactique & Mode Survivre */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#23211D] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#769656]">
                {currentPuzzle?.isDaily ? 'PUZZLE QUOTIDIEN OFFICIEL' : 'ENTRAÎNEMENT TACTIQUE'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSurvivalMode((m) => !m);
                  setSurvivalStreak(0);
                  setSurvivalLives(3);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  survivalMode
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#161512] text-slate-300 border border-white/10'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{survivalMode ? 'Mode Survivre Actif' : 'Activer Mode Survivre'}</span>
              </button>
            </div>

            <div>
              <h1
                className="text-xl font-bold text-[#EEEED2]"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {currentPuzzle?.title || 'Combinaison Tactique'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums mt-1">
                <span>Thème : {currentPuzzle?.theme}</span>
                <span aria-hidden="true">·</span>
                <span>Difficulté : {currentPuzzle?.difficultyElo} ELO</span>
              </div>
            </div>

            {survivalMode && (
              <div className="p-3.5 bg-[#161512] border border-amber-500/30 rounded-lg flex items-center justify-between font-mono text-xs tabular-nums">
                <span>Série actuelle : {survivalStreak} résolus</span>
                <span className="text-amber-400">Vies restantes : {'❤️'.repeat(survivalLives)}</span>
              </div>
            )}

            {/* État de résolution */}
            {status === 'SOLVING' && (
              <div className="p-3.5 rounded-lg bg-[#161512] border border-white/10 text-xs text-slate-200">
                Trouvez le meilleur coup pour les{' '}
                <strong>{chess.turn() === 'w' ? 'Blancs' : 'Noirs'}</strong>.
              </div>
            )}

            {status === 'SOLVED' && (
              <div className="p-4 rounded-lg bg-[#769656]/25 border border-[#769656] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <CheckCircle2 className="w-4 h-4 text-[#769656]" />
                  <span>Excellent ! Combinaison tactique trouvée.</span>
                </div>
                <button
                  type="button"
                  onClick={nextPuzzle}
                  className="px-3 py-1.5 bg-[#769656] text-white text-xs font-bold rounded-md flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Suivant</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {status === 'FAILED' && (
              <div className="p-4 rounded-lg bg-red-950/60 border border-red-500/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-200">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span>Coup imprécis. Réessayez ou demandez un indice !</span>
                </div>
                <button
                  type="button"
                  onClick={() => currentPuzzle && loadPuzzleInstance(currentPuzzle)}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-md whitespace-nowrap"
                >
                  Réessayer
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleShowHint}
                className="flex-1 py-2.5 px-4 bg-[#161512] hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Lightbulb className="w-4 h-4" />
                <span>Indice Tactique</span>
              </button>
              <button
                type="button"
                onClick={nextPuzzle}
                className="flex-1 py-2.5 px-4 bg-[#769656] hover:bg-[#86a666] text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Puzzle Suivant
              </button>
            </div>
          </div>

          {/* Liste des Puzzles disponibles */}
          <div className="bg-[#23211D] border border-white/10 rounded-xl p-5 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Catalogue d’Entraînement ({puzzles.length} exercices)
            </h3>
            <div className="space-y-2">
              {puzzles.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPuzzle(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left text-xs transition-colors ${
                    idx === currentIndex
                      ? 'bg-[#769656]/25 border-[#769656] text-white font-semibold'
                      : 'bg-[#161512] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <span className="truncate">{p.title}</span>
                  <span className="font-mono text-slate-400 shrink-0 ml-2">
                    {p.difficultyElo} ELO
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
