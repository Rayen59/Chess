// src/server/services/stockfish.ts
// Moteur d'évaluation, Multi-PV, détection d'ouvertures ECO, styles d'IA et analyse post-partie côté serveur
import { Chess, Move } from 'chess.js';

export type StockfishLevel = number; // 400 à 3000 ELO personnalisable
export type AiPlayStyle = 'balanced' | 'aggressive' | 'solid' | 'tactical';

export interface CandidateEngineMove {
  from: string;
  to: string;
  san: string;
  evalCp: number;
  promotion?: string;
}

export interface MoveAnalysisItem {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  from: string;
  to: string;
  evalCp: number;
  cpLoss: number;
  bestAlternativeSan?: string;
  classification: 'brilliant' | 'great' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
}

export interface GamePostAnalysis {
  whiteAccuracy: number;
  blackAccuracy: number;
  brilliantMoves: number;
  greatMoves: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  goodMoves: number;
  bestMoves: number;
  openingEco: string;
  openingName: string;
  moves: MoveAnalysisItem[];
}

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};

const CENTER_BONUS: Record<string, number> = {
  d4: 32,
  e4: 32,
  d5: 32,
  e5: 32,
  c3: 20,
  f3: 20,
  c6: 20,
  f6: 20,
  c4: 22,
  f4: 16,
  c5: 22,
  f5: 16,
  d3: 14,
  e3: 14,
  d6: 14,
  e6: 14,
};

const ECO_OPENINGS: { prefix: string; eco: string; name: string }[] = [
  { prefix: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6', eco: 'B90', name: 'Défense Sicilienne · Variante Najdorf' },
  { prefix: '1. e4 c5 2. Nf3 Nc6', eco: 'B30', name: 'Défense Sicilienne · Système Classique' },
  { prefix: '1. e4 c5', eco: 'B20', name: 'Défense Sicilienne' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. Bb5', eco: 'C60', name: 'Partie Espagnole (Ruy Lopez)' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', eco: 'C50', name: 'Partie Italienne (Giuoco Piano)' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6', eco: 'C55', name: 'Défense des Deux Cavaliers' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. d4', eco: 'C45', name: 'Partie Écossaise' },
  { prefix: '1. e4 e5 2. f4', eco: 'C30', name: 'Gambit du Roi' },
  { prefix: '1. e4 e5', eco: 'C20', name: 'Début Ouvert (Double Pion Roi)' },
  { prefix: '1. e4 e6 2. d4 d5', eco: 'C00', name: 'Défense Française' },
  { prefix: '1. e4 e6', eco: 'C00', name: 'Défense Française' },
  { prefix: '1. e4 c6 2. d4 d5', eco: 'B12', name: 'Défense Caro-Kann' },
  { prefix: '1. e4 c6', eco: 'B10', name: 'Défense Caro-Kann' },
  { prefix: '1. e4 d5', eco: 'B01', name: 'Défense Scandinave' },
  { prefix: '1. e4 d6 2. d4 Nf6', eco: 'B07', name: 'Défense Pirc' },
  { prefix: '1. e4 Nf6', eco: 'B02', name: 'Défense Alekhine' },
  { prefix: '1. d4 d5 2. c4 e6', eco: 'D30', name: 'Gambit Dame Refusé' },
  { prefix: '1. d4 d5 2. c4 c6', eco: 'D10', name: 'Défense Slave' },
  { prefix: '1. d4 d5 2. c4 dxc4', eco: 'D20', name: 'Gambit Dame Accepté' },
  { prefix: '1. d4 d5 2. Bf4', eco: 'D00', name: 'Système de Londres' },
  { prefix: '1. d4 Nf6 2. Bf4', eco: 'A45', name: 'Système de Londres' },
  { prefix: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7', eco: 'E60', name: 'Défense Est-Indienne' },
  { prefix: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4', eco: 'E20', name: 'Défense Nimzo-Indienne' },
  { prefix: '1. d4 d5', eco: 'D00', name: 'Début Fermé (Double Pion Dame)' },
  { prefix: '1. c4', eco: 'A10', name: 'Ouverture Anglaise' },
  { prefix: '1. Nf3', eco: 'A04', name: 'Ouverture Réti' },
];

export function detectOpeningEco(pgn = '', _fen = ''): { eco: string; name: string } {
  const cleanPgn = pgn.replace(/\s+/g, ' ').trim();
  if (!cleanPgn) {
    return { eco: 'A00', name: 'Position Initiale FIDE' };
  }
  for (const item of ECO_OPENINGS) {
    if (cleanPgn.startsWith(item.prefix)) {
      return { eco: item.eco, name: item.name };
    }
  }
  if (cleanPgn.startsWith('1. e4')) return { eco: 'B00', name: 'Ouverture du Pion Roi (1.e4)' };
  if (cleanPgn.startsWith('1. d4')) return { eco: 'A40', name: 'Ouverture du Pion Dame (1.d4)' };
  return { eco: 'A00', name: 'Système Irrégulier / Moderne' };
}

/**
 * Évalue une position FEN en centipions du point de vue des Blancs
 */
export function evaluatePositionCp(chess: Chess, style: AiPlayStyle = 'balanced'): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -9999 : 9999;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const base = PIECE_VALUES[piece.type] || 0;
      const squareBonus = CENTER_BONUS[piece.square] || 0;
      const advancementBonus =
        piece.type === 'p' ? (piece.color === 'w' ? (6 - r) * 9 : (r - 1) * 9) : 0;

      let styleBonus = 0;
      if (style === 'aggressive') {
        const enemyKingRank = piece.color === 'w' ? 7 - r : r;
        if (piece.type !== 'k' && piece.type !== 'p') {
          styleBonus += enemyKingRank * 5;
        }
      } else if (style === 'solid') {
        if (piece.type === 'k' && (c <= 2 || c >= 6)) {
          styleBonus += 25;
        }
      } else if (style === 'tactical') {
        styleBonus += squareBonus * 0.5;
      }

      const total = base + squareBonus + advancementBonus + styleBonus;
      score += piece.color === 'w' ? total : -total;
    }
  }

  if (chess.inCheck()) {
    score += chess.turn() === 'w' ? -35 : 35;
  }

  return Math.round(score);
}

/**
 * Recherche Alpha-Beta avec profondeur configurée selon la puissance ELO choisie
 */
function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  style: AiPlayStyle = 'balanced'
): number {
  if (depth <= 0) {
    return evaluatePositionCp(chess, style);
  }

  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) {
    return evaluatePositionCp(chess, style);
  }

  legalMoves.sort((a, b) => (b.captured ? 12 : 0) - (a.captured ? 12 : 0));
  const candidateMoves = legalMoves.slice(0, 14);

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of candidateMoves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, false, style);
      chess.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of candidateMoves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, true, style);
      chess.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Calcule le meilleur coup pour un niveau de puissance ELO donné (400 à 3000 ELO) + Style de jeu
 */
export function computeBestMove(
  fen: string,
  levelElo: StockfishLevel = 1600,
  style: AiPlayStyle = 'balanced',
  customDepth?: number
): {
  bestMove: Move | null;
  evaluationCp: number;
  topMoves: CandidateEngineMove[];
  threatMove: CandidateEngineMove | null;
} {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) {
    return {
      bestMove: null,
      evaluationCp: evaluatePositionCp(chess, style),
      topMoves: [],
      threatMove: null,
    };
  }

  const clampedElo = Math.max(400, Math.min(3000, Number(levelElo) || 1600));
  const autoDepth = clampedElo < 1000 ? 1 : 2;
  const depth = customDepth ? Math.max(1, Math.min(2, customDepth)) : autoDepth;

  // Bruit proportionnel à l'écart avec 2800 ELO pour simuler fidèlement tout niveau de 400 à 3000 ELO
  const noise = Math.max(0, ((2800 - clampedElo) / 2400) * 240);
  const isWhite = chess.turn() === 'w';

  const scoredMoves: { move: Move; rawEval: number; noisyEval: number }[] = [];

  for (const move of legalMoves) {
    chess.move(move);
    const rawEval = minimax(chess, depth - 1, -Infinity, Infinity, !isWhite, style);
    chess.undo();

    const jitter = noise > 0 ? (Math.random() - 0.5) * noise : 0;
    const noisyEval = rawEval + jitter;
    scoredMoves.push({ move, rawEval, noisyEval });
  }

  // Tri selon le score bruité pour le choix du bot
  scoredMoves.sort((a, b) => (isWhite ? b.noisyEval - a.noisyEval : a.noisyEval - b.noisyEval));
  const chosen = scoredMoves[0];

  // Tri selon le vrai score moteur pour les lignes Multi-PV d'analyse
  const pureSorted = [...scoredMoves].sort((a, b) =>
    isWhite ? b.rawEval - a.rawEval : a.rawEval - b.rawEval
  );

  const topMoves: CandidateEngineMove[] = pureSorted.slice(0, 3).map((item) => ({
    from: item.move.from,
    to: item.move.to,
    san: item.move.san,
    evalCp: Math.round(item.rawEval),
    promotion: item.move.promotion,
  }));

  // Calculer la menace directe si c'était au tour de l'adversaire (Null-move threat)
  let threatMove: CandidateEngineMove | null = null;
  try {
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-'; // Réinitialiser la prise en passant pour tester le coup de menace
    const flippedChess = new Chess(parts.join(' '));
    const oppMoves = flippedChess.moves({ verbose: true });
    if (oppMoves.length > 0) {
      const oppWhite = flippedChess.turn() === 'w';
      let bestOpp = oppMoves[0];
      let bestOppScore = oppWhite ? -Infinity : Infinity;
      for (const om of oppMoves) {
        flippedChess.move(om);
        const sc = evaluatePositionCp(flippedChess, 'tactical');
        flippedChess.undo();
        if ((oppWhite && sc > bestOppScore) || (!oppWhite && sc < bestOppScore)) {
          bestOppScore = sc;
          bestOpp = om;
        }
      }
      threatMove = {
        from: bestOpp.from,
        to: bestOpp.to,
        san: bestOpp.san,
        evalCp: Math.round(bestOppScore),
      };
    }
  } catch {
    threatMove = null;
  }

  return {
    bestMove: chosen.move,
    evaluationCp: Math.round(pureSorted[0]?.rawEval ?? chosen.rawEval),
    topMoves,
    threatMove,
  };
}

export function computeMultiPvMoves(fen: string, levelElo = 2200, pvCount = 3) {
  const res = computeBestMove(fen, levelElo, 'balanced', 2);
  return {
    topMoves: res.topMoves.slice(0, pvCount),
    threatMove: res.threatMove,
    evaluationCp: res.evaluationCp,
  };
}

/**
 * Analyse complète post-partie d'une suite de coups (PGN ou liste SAN)
 */
export function analyzeCompletedGame(pgnOrMoves: string): GamePostAnalysis {
  const chess = new Chess();
  try {
    if (pgnOrMoves.trim()) {
      chess.loadPgn(pgnOrMoves);
    }
  } catch {
    // Continuer avec l'historique disponible
  }

  const opening = detectOpeningEco(pgnOrMoves);
  const history = chess.history({ verbose: true });
  const replay = new Chess();

  const analyzedMoves: MoveAnalysisItem[] = [];
  let brilliantMoves = 0;
  let greatMoves = 0;
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;
  let goodMoves = 0;
  let bestMoves = 0;

  let whiteLossSum = 0;
  let whiteMovesCount = 0;
  let blackLossSum = 0;
  let blackMovesCount = 0;

  let prevEval = 0;

  history.forEach((m, idx) => {
    // Trouver le meilleur coup théorique avant de jouer m
    const legalBefore = replay.moves({ verbose: true });
    let bestBeforeSan = m.san;
    let bestBeforeEval = m.color === 'w' ? -Infinity : Infinity;

    for (const cand of legalBefore) {
      replay.move(cand);
      const sc = evaluatePositionCp(replay);
      replay.undo();
      if ((m.color === 'w' && sc > bestBeforeEval) || (m.color === 'b' && sc < bestBeforeEval)) {
        bestBeforeEval = sc;
        bestBeforeSan = cand.san;
      }
    }

    replay.move(m);
    const currentEval = evaluatePositionCp(replay);
    const swing = m.color === 'w' ? prevEval - currentEval : currentEval - prevEval;
    const cpLoss = Math.max(0, Math.round(swing));

    let classification: MoveAnalysisItem['classification'] = 'good';
    if (cpLoss > 240) {
      classification = 'blunder';
      blunders++;
    } else if (cpLoss > 120) {
      classification = 'mistake';
      mistakes++;
    } else if (cpLoss > 55) {
      classification = 'inaccuracy';
      inaccuracies++;
    } else if (cpLoss === 0 && m.captured && Math.abs(currentEval) > 150) {
      classification = 'brilliant';
      brilliantMoves++;
    } else if (cpLoss <= 10 && m.san === bestBeforeSan) {
      classification = 'best';
      bestMoves++;
    } else if (cpLoss <= 22) {
      classification = 'great';
      greatMoves++;
    } else {
      classification = 'good';
      goodMoves++;
    }

    if (m.color === 'w') {
      whiteLossSum += Math.min(300, cpLoss);
      whiteMovesCount++;
    } else {
      blackLossSum += Math.min(300, cpLoss);
      blackMovesCount++;
    }

    analyzedMoves.push({
      moveNumber: Math.floor(idx / 2) + 1,
      color: m.color,
      san: m.san,
      from: m.from,
      to: m.to,
      evalCp: currentEval,
      cpLoss,
      bestAlternativeSan: bestBeforeSan !== m.san ? bestBeforeSan : undefined,
      classification,
    });

    prevEval = currentEval;
  });

  const whiteAvgLoss = whiteMovesCount > 0 ? whiteLossSum / whiteMovesCount : 15;
  const blackAvgLoss = blackMovesCount > 0 ? blackLossSum / blackMovesCount : 15;

  const whiteAccuracy = Math.max(45, Math.min(99, Math.round(100 - whiteAvgLoss / 3.2)));
  const blackAccuracy = Math.max(45, Math.min(99, Math.round(100 - blackAvgLoss / 3.2)));

  return {
    whiteAccuracy,
    blackAccuracy,
    brilliantMoves,
    greatMoves,
    blunders,
    mistakes,
    inaccuracies,
    goodMoves,
    bestMoves,
    openingEco: opening.eco,
    openingName: opening.name,
    moves: analyzedMoves,
  };
}
