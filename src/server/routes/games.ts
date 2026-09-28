// src/server/routes/games.ts
// Routes Parties, Moteur IA Stockfish (Puissance 400-3000 ELO + Styles), Analyse Post-Partie, Coach IA Gemini et Puzzles Tactiques
import { Router, Request, Response } from 'express';
import {
  addEloHistoryEntry,
  createGameRecord,
  getUserByUid,
  listPuzzles,
  listRecentGames,
  updateUserProfile,
} from '../../db/queries.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { calculateFideElo, EloCategory } from '../services/elo.ts';
import {
  AiPlayStyle,
  analyzeCompletedGame,
  computeBestMove,
  detectOpeningEco,
} from '../services/stockfish.ts';
import { generateFullGameReview, generateMoveCommentary } from '../services/geminiCoach.ts';

export const gamesRouter = Router();

// 1. Lister les parties récentes
gamesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userUid = req.query.userUid ? String(req.query.userUid) : undefined;
    const gamesList = await listRecentGames(userUid);
    return res.json({ games: gamesList.slice(0, 30) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de charger les parties.' });
  }
});

// 2. Calculer le meilleur coup Stockfish côté serveur (Puissance libre de 400 à 3000 ELO + Style + Multi-PV)
gamesRouter.post('/stockfish-move', async (req: Request, res: Response) => {
  try {
    const { fen, level = 1600, style = 'balanced', depth } = req.body;
    if (!fen) {
      return res.status(400).json({ error: 'Position FEN requise.' });
    }
    const validLevel = Math.max(400, Math.min(3000, Number(level) || 1600));
    const validStyle: AiPlayStyle = ['balanced', 'aggressive', 'solid', 'tactical'].includes(style)
      ? style
      : 'balanced';

    const { bestMove, evaluationCp, topMoves, threatMove } = computeBestMove(
      String(fen),
      validLevel,
      validStyle,
      depth ? Number(depth) : undefined
    );
    return res.json({
      bestMove,
      evaluationCp,
      topMoves,
      threatMove,
      level: validLevel,
      style: validStyle,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur du moteur Stockfish.' });
  }
});

// 3. Analyse complète post-partie (Brillants, Meilleurs, Gaffes, Précision %, Ouverture ECO)
gamesRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { pgn = '' } = req.body;
    const analysis = analyzeCompletedGame(String(pgn));
    return res.json({ analysis });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur lors de l’analyse de la partie.' });
  }
});

// 4. Commentaire en direct du Coach IA (Gemini API) sur un coup ou une position
gamesRouter.post('/ai-commentary', async (req: Request, res: Response) => {
  try {
    const {
      fen,
      pgn = '',
      lastMoveSan,
      playerColor = 'w',
      evaluationCp = 0,
    } = req.body;

    if (!fen) {
      return res.status(400).json({ error: 'FEN requis pour le commentaire IA.' });
    }

    const commentary = await generateMoveCommentary({
      fen: String(fen),
      pgn: String(pgn),
      lastMoveSan: lastMoveSan ? String(lastMoveSan) : undefined,
      playerColor: playerColor === 'b' ? 'b' : 'w',
      evaluationCp: Number(evaluationCp) || 0,
    });

    return res.json({ commentary });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Impossible de générer le commentaire du Coach IA.',
    });
  }
});

// 5. Rapport complet post-partie du Grand Maître IA (Gemini API + Stockfish)
gamesRouter.post('/ai-full-review', async (req: Request, res: Response) => {
  try {
    const {
      pgn = '',
      playerColor = 'w',
      result = '1-0',
      reason = 'Échec et Mat',
    } = req.body;

    const [review, analysis] = await Promise.all([
      generateFullGameReview({
        pgn: String(pgn),
        playerColor: playerColor === 'b' ? 'b' : 'w',
        result: String(result),
        reason: String(reason),
      }),
      Promise.resolve(analyzeCompletedGame(String(pgn))),
    ]);

    return res.json({
      review,
      analysis,
      opening: detectOpeningEco(String(pgn)),
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Impossible de générer le bilan complet du Coach IA.',
    });
  }
});

// 6. Enregistrer une partie terminée (contre Stockfish ou en ligne) et mettre à jour l'ELO FIDE
gamesRouter.post('/complete', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });

    const {
      opponentUid = 'stockfish-bot',
      opponentUsername = 'Stockfish IA',
      opponentCountry = 'UN',
      opponentElo = 1600,
      playerColor = 'w',
      category = 'blitz',
      timeControl = '3+2',
      result = '1-0',
      reason = 'checkmate',
      pgn = '',
      finalFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      movesCount = 20,
      avgMoveTimeMs = 2500,
    } = req.body;

    const user = await getUserByUid(req.user.uid);
    if (!user) return res.status(404).json({ error: 'Joueur introuvable.' });

    const eloCat: EloCategory = ['bullet', 'blitz', 'rapid', 'classical'].includes(category)
      ? (category as EloCategory)
      : 'blitz';

    const userCurrentElo =
      eloCat === 'bullet'
        ? user.eloBullet
        : eloCat === 'blitz'
          ? user.eloBlitz
          : eloCat === 'rapid'
            ? user.eloRapid
            : user.eloClassical;

    const whiteEloBefore = playerColor === 'w' ? userCurrentElo : Number(opponentElo);
    const blackEloBefore = playerColor === 'b' ? userCurrentElo : Number(opponentElo);

    const eloCalc = calculateFideElo(
      whiteEloBefore,
      blackEloBefore,
      result as '1-0' | '0-1' | '1/2-1/2',
      user.gamesPlayed,
      30
    );

    const analysis = analyzeCompletedGame(String(pgn));

    // Détection anti-triche basique : temps de coup anormalement court (< 350ms sur >= 15 coups)
    const suspiciousFlag = Number(movesCount) >= 15 && Number(avgMoveTimeMs) < 350;
    const suspiciousReason = suspiciousFlag
      ? `Temps moyen anormal (${avgMoveTimeMs}ms/coup) sur ${movesCount} coups.`
      : null;

    const game = await createGameRecord({
      whiteUid: playerColor === 'w' ? user.uid : opponentUid,
      blackUid: playerColor === 'b' ? user.uid : opponentUid,
      whiteUsername: playerColor === 'w' ? user.username : opponentUsername,
      blackUsername: playerColor === 'b' ? user.username : opponentUsername,
      whiteCountry: playerColor === 'w' ? user.countryCode : opponentCountry,
      blackCountry: playerColor === 'b' ? user.countryCode : opponentCountry,
      whiteEloBefore,
      blackEloBefore,
      whiteEloAfter: eloCalc.whiteNewElo,
      blackEloAfter: eloCalc.blackNewElo,
      category: eloCat,
      timeControl,
      result,
      reason,
      pgn,
      finalFen,
      movesCount: Number(movesCount),
      whiteAccuracy: analysis.whiteAccuracy,
      blackAccuracy: analysis.blackAccuracy,
      suspiciousFlag,
      suspiciousReason,
    });

    const userNewElo = playerColor === 'w' ? eloCalc.whiteNewElo : eloCalc.blackNewElo;
    const userDelta = playerColor === 'w' ? eloCalc.whiteDelta : eloCalc.blackDelta;

    const didWin = (playerColor === 'w' && result === '1-0') || (playerColor === 'b' && result === '0-1');
    const didLose = (playerColor === 'w' && result === '0-1') || (playerColor === 'b' && result === '1-0');

    const updatedUser = await updateUserProfile(user.uid, {
      ...(eloCat === 'bullet' ? { eloBullet: userNewElo } : {}),
      ...(eloCat === 'blitz' ? { eloBlitz: userNewElo } : {}),
      ...(eloCat === 'rapid' ? { eloRapid: userNewElo } : {}),
      ...(eloCat === 'classical' ? { eloClassical: userNewElo } : {}),
      gamesPlayed: user.gamesPlayed + 1,
      wins: didWin ? user.wins + 1 : user.wins,
      losses: didLose ? user.losses + 1 : user.losses,
      draws: result === '1/2-1/2' ? user.draws + 1 : user.draws,
    });

    await addEloHistoryEntry({
      userId: user.id,
      userUid: user.uid,
      category: eloCat,
      elo: userNewElo,
      delta: userDelta,
    });

    return res.json({
      game,
      analysis,
      eloChange: {
        oldElo: userCurrentElo,
        newElo: userNewElo,
        delta: userDelta,
      },
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Complete game error:', error);
    return res.status(500).json({ error: error.message || 'Impossible d’enregistrer la partie.' });
  }
});

// 7. Puzzles tactiques & Puzzle quotidien
gamesRouter.get('/puzzles', async (_req: Request, res: Response) => {
  try {
    const allPuzzles = await listPuzzles();
    return res.json({ puzzles: allPuzzles });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de charger les puzzles.' });
  }
});

// 8. Enregistrer la résolution d'un puzzle (mise à jour ELO Tactique & Série Survivre)
gamesRouter.post('/puzzles/solve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const { success, difficultyElo = 1400 } = req.body;

    const user = await getUserByUid(req.user.uid);
    if (!user) return res.status(404).json({ error: 'Joueur introuvable.' });

    const eloCalc = calculateFideElo(
      user.puzzleRating,
      Number(difficultyElo),
      success ? '1-0' : '0-1',
      30,
      30
    );

    const updated = await updateUserProfile(user.uid, {
      puzzleRating: eloCalc.whiteNewElo,
      puzzlesSolved: success ? user.puzzlesSolved + 1 : user.puzzlesSolved,
      puzzleStreak: success ? user.puzzleStreak + 1 : 0,
    });

    return res.json({
      user: updated,
      delta: eloCalc.whiteDelta,
      newPuzzleRating: eloCalc.whiteNewElo,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de mettre à jour le score puzzle.' });
  }
});
