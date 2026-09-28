// src/lib/stockfish.worker.ts
// Moteur Stockfish Client + Serveur : Puissance personnalisable (400 à 3000 ELO), Styles d'IA,
// Multi-PV instantané, Menace adverse, Ouvertures ECO, Bilan Matériel, Carte Thermique et Coach IA instantané
import { Chess, Move } from 'chess.js';
import { apiRequest } from './api.ts';

export type BotEloLevel = number;
export type AiPlayStyle = 'balanced' | 'aggressive' | 'solid' | 'tactical';

export interface CandidateMoveInfo {
  from: string;
  to: string;
  san: string;
  evalCp: number;
  promotion?: string;
}

export interface EngineMoveResponse {
  bestMove: Move | null;
  evaluationCp: number;
  topMoves?: CandidateMoveInfo[];
  threatMove?: CandidateMoveInfo | null;
}

export interface CapturedMaterialInfo {
  whiteCaptured: string[];
  blackCaptured: string[];
  whiteAdvantage: number;
  blackAdvantage: number;
}

export interface TacticalSquareOverlay {
  square: string;
  type: 'hanging' | 'threatened' | 'controlled-white' | 'controlled-black' | 'king-danger';
}

export interface InstantCoachCommentary {
  headline: string;
  moveQuality: string;
  positionalExplanation: string;
  tacticalAlert: string;
  recommendedPlan: string;
  bestEngineLine: string[];
  openingName: string;
}

const PIECE_WEIGHTS: Record<string, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};

const CENTER_SQUARES: Record<string, number> = {
  d4: 30,
  e4: 30,
  d5: 30,
  e5: 30,
  c3: 18,
  f3: 18,
  c6: 18,
  f6: 18,
  c4: 20,
  f4: 15,
  c5: 20,
  f5: 15,
};

const ECO_CLIENT_BOOK: { prefix: string; eco: string; name: string }[] = [
  { prefix: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6', eco: 'B90', name: 'Sicilienne Najdorf' },
  { prefix: '1. e4 c5 2. Nf3 Nc6', eco: 'B30', name: 'Défense Sicilienne Classique' },
  { prefix: '1. e4 c5', eco: 'B20', name: 'Défense Sicilienne' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. Bb5', eco: 'C60', name: 'Partie Espagnole (Ruy Lopez)' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', eco: 'C50', name: 'Partie Italienne (Giuoco Piano)' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6', eco: 'C55', name: 'Défense des Deux Cavaliers' },
  { prefix: '1. e4 e5 2. Nf3 Nc6 3. d4', eco: 'C45', name: 'Partie Écossaise' },
  { prefix: '1. e4 e5 2. f4', eco: 'C30', name: 'Gambit du Roi' },
  { prefix: '1. e4 e5', eco: 'C20', name: 'Début Ouvert (1.e4 e5)' },
  { prefix: '1. e4 e6', eco: 'C00', name: 'Défense Française' },
  { prefix: '1. e4 c6', eco: 'B10', name: 'Défense Caro-Kann' },
  { prefix: '1. e4 d5', eco: 'B01', name: 'Défense Scandinave' },
  { prefix: '1. d4 d5 2. c4 e6', eco: 'D30', name: 'Gambit Dame Refusé' },
  { prefix: '1. d4 d5 2. c4 c6', eco: 'D10', name: 'Défense Slave' },
  { prefix: '1. d4 d5 2. c4 dxc4', eco: 'D20', name: 'Gambit Dame Accepté' },
  { prefix: '1. d4 d5 2. Bf4', eco: 'D00', name: 'Système de Londres' },
  { prefix: '1. d4 Nf6 2. Bf4', eco: 'A45', name: 'Système de Londres' },
  { prefix: '1. d4 Nf6 2. c4 g6', eco: 'E60', name: 'Défense Est-Indienne' },
  { prefix: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4', eco: 'E20', name: 'Défense Nimzo-Indienne' },
  { prefix: '1. d4 d5', eco: 'D00', name: 'Début du Pion Dame (1.d4 d5)' },
  { prefix: '1. c4', eco: 'A10', name: 'Ouverture Anglaise' },
  { prefix: '1. Nf3', eco: 'A04', name: 'Ouverture Réti' },
];

export function detectOpeningClient(pgn: string): { eco: string; name: string } {
  const clean = pgn.replace(/\s+/g, ' ').trim();
  if (!clean) return { eco: 'A00', name: 'Position Initiale FIDE' };
  for (const item of ECO_CLIENT_BOOK) {
    if (clean.startsWith(item.prefix)) return { eco: item.eco, name: item.name };
  }
  if (clean.startsWith('1. e4')) return { eco: 'B00', name: 'Ouverture du Pion Roi (1.e4)' };
  if (clean.startsWith('1. d4')) return { eco: 'A40', name: 'Ouverture du Pion Dame (1.d4)' };
  return { eco: 'A00', name: 'Ouverture Moderne' };
}

export function evaluateLocalBoard(chess: Chess, style: AiPlayStyle = 'balanced'): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -9999 : 9999;
  }
  if (chess.isStalemate() || chess.isInsufficientMaterial()) return 0;

  let total = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_WEIGHTS[p.type] || 0;
      const sqBonus = CENTER_SQUARES[p.square] || 0;
      const advance = p.type === 'p' ? (p.color === 'w' ? (6 - r) * 8 : (r - 1) * 8) : 0;
      const styleMod =
        style === 'aggressive' && p.type !== 'p' && p.type !== 'k'
          ? (p.color === 'w' ? 7 - r : r) * 4
          : 0;
      const pieceScore = val + sqBonus + advance + styleMod;
      total += p.color === 'w' ? pieceScore : -pieceScore;
    }
  }
  return total;
}

/**
 * Calcule instantanément côté client les 3 meilleurs coups (Multi-PV) et la menace adverse
 */
export function computeLocalEngineInsights(
  fen: string,
  style: AiPlayStyle = 'balanced'
): {
  evaluationCp: number;
  topMoves: CandidateMoveInfo[];
  threatMove: CandidateMoveInfo | null;
} {
  try {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) {
      return {
        evaluationCp: evaluateLocalBoard(chess, style),
        topMoves: [],
        threatMove: null,
      };
    }

    const isWhite = chess.turn() === 'w';
    const scored: { move: Move; evalCp: number }[] = [];

    for (const m of legalMoves) {
      chess.move(m);
      // 1-ply lookahead for immediate tactical recaptures
      const oppReplies = chess.moves({ verbose: true });
      let replyEval = evaluateLocalBoard(chess, style);
      for (const rep of oppReplies) {
        if (rep.captured || rep.san.includes('+')) {
          chess.move(rep);
          const e = evaluateLocalBoard(chess, style);
          chess.undo();
          if ((isWhite && e < replyEval) || (!isWhite && e > replyEval)) {
            replyEval = e;
          }
        }
      }
      chess.undo();
      scored.push({ move: m, evalCp: Math.round(replyEval) });
    }

    scored.sort((a, b) => (isWhite ? b.evalCp - a.evalCp : a.evalCp - b.evalCp));

    const topMoves: CandidateMoveInfo[] = scored.slice(0, 3).map((item) => ({
      from: item.move.from,
      to: item.move.to,
      san: item.move.san,
      evalCp: item.evalCp,
      promotion: item.move.promotion,
    }));

    // Calcul de la menace adverse si le trait était à l'adversaire
    let threatMove: CandidateMoveInfo | null = null;
    try {
      const parts = fen.split(' ');
      parts[1] = parts[1] === 'w' ? 'b' : 'w';
      parts[3] = '-';
      const oppChess = new Chess(parts.join(' '));
      const oppMoves = oppChess.moves({ verbose: true });
      if (oppMoves.length > 0) {
        const oppWhite = oppChess.turn() === 'w';
        let bestOpp = oppMoves[0];
        let bestScore = oppWhite ? -Infinity : Infinity;
        for (const om of oppMoves) {
          oppChess.move(om);
          const sc = evaluateLocalBoard(oppChess, 'tactical');
          oppChess.undo();
          if ((oppWhite && sc > bestScore) || (!oppWhite && sc < bestScore)) {
            bestScore = sc;
            bestOpp = om;
          }
        }
        threatMove = {
          from: bestOpp.from,
          to: bestOpp.to,
          san: bestOpp.san,
          evalCp: Math.round(bestScore),
        };
      }
    } catch {
      threatMove = null;
    }

    return {
      evaluationCp: topMoves[0]?.evalCp ?? evaluateLocalBoard(chess, style),
      topMoves,
      threatMove,
    };
  } catch {
    return { evaluationCp: 0, topMoves: [], threatMove: null };
  }
}

/**
 * Génère un commentaire tactique et positionnel immédiat (0ms) pour que le Coach IA soit toujours actif
 */
export function buildInstantCoachCommentary(params: {
  fen: string;
  pgn: string;
  lastMoveSan?: string;
  evaluationCp: number;
  topMoves: CandidateMoveInfo[];
  threatMove: CandidateMoveInfo | null;
}): InstantCoachCommentary {
  const { fen, pgn, lastMoveSan, evaluationCp, topMoves, threatMove } = params;
  const opening = detectOpeningClient(pgn);
  const evalPawns = (evaluationCp / 100).toFixed(1);
  const sign = evaluationCp >= 0 ? '+' : '';

  let chess: Chess | null = null;
  try {
    chess = new Chess(fen);
  } catch {
    chess = null;
  }

  const turnLabel = chess?.turn() === 'w' ? 'Blancs' : 'Noirs';
  const bestCandidate = topMoves[0];
  const secondCandidate = topMoves[1];

  if (!lastMoveSan) {
    return {
      headline: `Coach IA Prêt · ${opening.eco} ${opening.name}`,
      moveQuality: 'Début de Partie',
      positionalExplanation:
        'Prenez le contrôle du centre avec vos pions (e4 ou d4), développez vos Cavaliers et Fous rapidement, puis mettez votre Roi à l’abri par le roque.',
      tacticalAlert:
        'Aucune menace immédiate. Évitez de sortir la Dame trop tôt pour ne pas perdre de temps de développement.',
      recommendedPlan: bestCandidate
        ? `Coup recommandé par le moteur : ${bestCandidate.san} (${bestCandidate.from} → ${bestCandidate.to}).`
        : 'Jouez 1.e4 ou 1.d4 pour occuper le centre.',
      bestEngineLine: topMoves.map(
        (m) => `${m.san} (${m.evalCp >= 0 ? '+' : ''}${(m.evalCp / 100).toFixed(1)})`
      ),
      openingName: `${opening.eco} · ${opening.name}`,
    };
  }

  const absEval = Math.abs(evaluationCp);
  const statusText =
    absEval < 45
      ? 'Équilibre dynamique'
      : evaluationCp > 0
        ? 'Initiative aux Blancs'
        : 'Initiative aux Noirs';

  return {
    headline: `Dernier coup : ${lastMoveSan} · ${statusText} (${sign}${evalPawns})`,
    moveQuality:
      absEval < 50
        ? 'Coup Solide & Théorique'
        : absEval < 180
          ? 'Pression Positionnelle'
          : 'Avantage Tactique Fort',
    positionalExplanation: `Dans la variante ${opening.name} (${opening.eco}), le trait est aux ${turnLabel}. ${
      absEval < 60
        ? 'La lutte pour les cases centrales reste équilibrée entre les deux camps.'
        : evaluationCp > 0
          ? 'Les Blancs disposent d’un avantage d’espace et d’activité de pièces.'
          : 'Les Noirs exercent une pression active sur la position blanche.'
    }`,
    tacticalAlert: chess?.inCheck()
      ? '⚠️ Échec au Roi ! Vous devez impérativement parer l’échec (déplacer le Roi, interposer une pièce ou capturer l’attaquant).'
      : threatMove
        ? `Surveillez la réponse adverse potentielle ${threatMove.san} (${threatMove.from} → ${threatMove.to}).`
        : 'Vérifiez qu’aucune de vos pièces n’est laissée sans défense avant d’attaquer.',
    recommendedPlan: bestCandidate
      ? `Le meilleur coup calculé est ${bestCandidate.san} (${bestCandidate.from} → ${bestCandidate.to})${
          secondCandidate ? `, suivi de l'alternative ${secondCandidate.san}` : ''
        }.`
      : 'Consolidez votre structure et activez vos Tours sur les colonnes ouvertes.',
    bestEngineLine: topMoves.map(
      (m) => `${m.san} (${m.evalCp >= 0 ? '+' : ''}${(m.evalCp / 100).toFixed(1)})`
    ),
    openingName: `${opening.eco} · ${opening.name}`,
  };
}

/**
 * Calcule les pièces capturées et l'écart matériel en pions (+1, +3...)
 */
export function computeCapturedMaterial(fen: string): CapturedMaterialInfo {
  const initialCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentWhite: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const currentBlack: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  try {
    const chess = new Chess(fen);
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece || piece.type === 'k') continue;
        if (piece.color === 'w') currentWhite[piece.type] = (currentWhite[piece.type] || 0) + 1;
        else currentBlack[piece.type] = (currentBlack[piece.type] || 0) + 1;
      }
    }
  } catch {
    // Ignorer
  }

  const symbolsBlack: Record<string, string> = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const symbolsWhite: Record<string, string> = { q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
  const weights: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };

  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];
  let whiteMat = 0;
  let blackMat = 0;

  for (const type of ['q', 'r', 'b', 'n', 'p']) {
    whiteMat += (currentWhite[type] || 0) * weights[type];
    blackMat += (currentBlack[type] || 0) * weights[type];

    const missingBlack = Math.max(0, initialCounts[type] - (currentBlack[type] || 0));
    for (let i = 0; i < missingBlack; i++) whiteCaptured.push(symbolsBlack[type]);

    const missingWhite = Math.max(0, initialCounts[type] - (currentWhite[type] || 0));
    for (let i = 0; i < missingWhite; i++) blackCaptured.push(symbolsWhite[type]);
  }

  return {
    whiteCaptured,
    blackCaptured,
    whiteAdvantage: Math.max(0, whiteMat - blackMat),
    blackAdvantage: Math.max(0, blackMat - whiteMat),
  };
}

/**
 * Calcule la carte thermique tactique : pièces en prise (non défendues) et contrôle des cases centrales
 */
export function computeTacticalHeatmap(fen: string): Record<string, TacticalSquareOverlay['type']> {
  const result: Record<string, TacticalSquareOverlay['type']> = {};
  try {
    const chess = new Chess(fen);
    const board = chess.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        const sq = `${'abcdefgh'[c]}${8 - r}` as any;

        const attackedByWhite = chess.isAttacked(sq, 'w');
        const attackedByBlack = chess.isAttacked(sq, 'b');

        if (piece) {
          if (piece.type === 'k') {
            const enemyColor = piece.color === 'w' ? 'b' : 'w';
            if (chess.isAttacked(sq, enemyColor)) {
              result[sq] = 'king-danger';
            }
          } else if (piece.color === 'w' && attackedByBlack && !attackedByWhite) {
            result[sq] = 'hanging';
          } else if (piece.color === 'b' && attackedByWhite && !attackedByBlack) {
            result[sq] = 'hanging';
          } else if (
            (piece.color === 'w' && attackedByBlack) ||
            (piece.color === 'b' && attackedByWhite)
          ) {
            result[sq] = 'threatened';
          }
        } else if (r >= 2 && r <= 5 && c >= 2 && c <= 5) {
          if (attackedByWhite && !attackedByBlack) {
            result[sq] = 'controlled-white';
          } else if (attackedByBlack && !attackedByWhite) {
            result[sq] = 'controlled-black';
          }
        }
      }
    }
  } catch {
    // Ignorer
  }
  return result;
}

/**
 * Demande au moteur Stockfish le meilleur coup pour un niveau de puissance donné (avec fallback client ultra-rapide)
 */
export async function requestStockfishMove(
  fen: string,
  level: BotEloLevel = 1600,
  style: AiPlayStyle = 'balanced',
  depth?: number
): Promise<EngineMoveResponse> {
  try {
    const res = await apiRequest<EngineMoveResponse>('/api/games/stockfish-move', {
      method: 'POST',
      body: JSON.stringify({ fen, level, style, depth }),
    });
    if (res && res.bestMove) {
      return res;
    }
  } catch {
    // Fallback local instantané
  }

  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return { bestMove: null, evaluationCp: evaluateLocalBoard(chess, style), topMoves: [], threatMove: null };
  }

  const insights = computeLocalEngineInsights(fen, style);
  const isWhite = chess.turn() === 'w';
  const scored: { move: Move; score: number }[] = [];

  for (const m of moves) {
    chess.move(m);
    const score =
      evaluateLocalBoard(chess, style) +
      (Math.random() - 0.5) * Math.max(0, 2800 - level) * 0.1;
    chess.undo();
    scored.push({ move: m, score });
  }

  scored.sort((a, b) => (isWhite ? b.score - a.score : a.score - b.score));

  return {
    bestMove: scored[0].move,
    evaluationCp: insights.evaluationCp,
    topMoves: insights.topMoves,
    threatMove: insights.threatMove,
  };
}
