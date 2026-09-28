// src/hooks/useChessGame.ts
// Hook avancé de gestion d'une partie d'échecs : validation chess.js, Stockfish IA (400-3000 ELO + Styles),
// Système d'Autorisation d'Aide limité à 3 coups par partie (100% INTERDIT en ligne Fair-Play FIDE),
// Reconnaissance d'Ouverture ECO, Courbe d'Évaluation et Coach IA actif
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Move } from 'chess.js';
import { chessSounds } from '../lib/sound.ts';
import {
  AiPlayStyle,
  BotEloLevel,
  buildInstantCoachCommentary,
  CandidateMoveInfo,
  computeCapturedMaterial,
  computeLocalEngineInsights,
  computeTacticalHeatmap,
  detectOpeningClient,
  evaluateLocalBoard,
  requestStockfishMove,
} from '../lib/stockfish.worker.ts';
import { apiRequest } from '../lib/api.ts';
import { useSocket } from './useSocket.ts';
import { useAppStore } from '../store/useAppStore.ts';

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface AnnotatedMoveMeta {
  moveIndex: number;
  moveNumber: number;
  san: string;
  color: 'w' | 'b';
  from: string;
  to: string;
  evalCp: number;
  cpDelta: number;
  classification: MoveClassification;
}

export interface AiCoachCommentary {
  headline: string;
  moveQuality: string;
  positionalExplanation: string;
  tacticalAlert: string;
  recommendedPlan: string;
  bestEngineLine: string[];
  openingName: string;
}

export interface AiFullReviewData {
  summaryTitle: string;
  executiveSummary: string;
  openingAssessment: string;
  criticalTurningPoint: string;
  whiteStrengths: string[];
  blackStrengths: string[];
  improvementAdvice: string[];
}

export interface PostGameSummary {
  result: '1-0' | '0-1' | '1/2-1/2';
  reason: string;
  whiteAccuracy: number;
  blackAccuracy: number;
  brilliantMoves?: number;
  greatMoves?: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  goodMoves: number;
  bestMoves: number;
  eloDelta?: number;
  newElo?: number;
}

export const MAX_HINTS_PER_GAME = 3;

function classifyMoveSwing(cpLoss: number, isCapture: boolean, evalCp: number): MoveClassification {
  if (cpLoss > 230) return 'blunder';
  if (cpLoss > 115) return 'mistake';
  if (cpLoss > 55) return 'inaccuracy';
  if (cpLoss <= 5 && isCapture && Math.abs(evalCp) >= 140) return 'brilliant';
  if (cpLoss <= 12) return 'best';
  if (cpLoss <= 28) return 'great';
  return 'good';
}

export function useChessGame() {
  const { gameConfig, user, updateUser } = useAppStore();
  const { socket } = useSocket();

  const chessRef = useRef<Chess>(new Chess());
  const configRef = useRef(gameConfig);
  configRef.current = gameConfig;

  const isOnlineMode = gameConfig.mode === 'online';

  const [fen, setFen] = useState<string>(chessRef.current.fen());
  const [pgn, setPgn] = useState<string>('');
  const [historyVerbose, setHistoryVerbose] = useState<Move[]>([]);
  const [annotatedMoves, setAnnotatedMoves] = useState<AnnotatedMoveMeta[]>([]);
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null);

  const [evaluationCp, setEvaluationCp] = useState<number>(0);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);

  // Système strict d'autorisation de flèches : AUCUNE flèche par défaut, limité à 3 par partie hors-ligne, 0 en ligne
  const [hintsRemaining, setHintsRemaining] = useState<number>(
    gameConfig.mode === 'online' ? 0 : MAX_HINTS_PER_GAME
  );
  const hintsRemainingRef = useRef<number>(
    gameConfig.mode === 'online' ? 0 : MAX_HINTS_PER_GAME
  );
  const [hintArrow, setHintArrow] = useState<[string, string] | null>(null);
  const [activeThreatArrow, setActiveThreatArrow] = useState<[string, string] | null>(null);

  const [topEngineMoves, setTopEngineMoves] = useState<CandidateMoveInfo[]>([]);
  const [threatMove, setThreatMove] = useState<CandidateMoveInfo | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from: string; to: string } | null>(null);

  // Carte thermique tactique (uniquement hors-ligne)
  const [showTacticalHeatmap, setShowTacticalHeatmap] = useState<boolean>(false);
  const [autoCoachEnabled, setAutoCoachEnabled] = useState<boolean>(true);
  const autoCoachRef = useRef(autoCoachEnabled);
  autoCoachRef.current = autoCoachEnabled;

  // Commentaires et Bilan Coach IA
  const [aiCommentary, setAiCommentary] = useState<AiCoachCommentary | null>(() => {
    const initFen = new Chess().fen();
    const insights = computeLocalEngineInsights(initFen, 'balanced');
    return buildInstantCoachCommentary({
      fen: initFen,
      pgn: '',
      evaluationCp: 0,
      topMoves: insights.topMoves,
      threatMove: insights.threatMove,
    });
  });
  const [isLoadingCommentary, setIsLoadingCommentary] = useState<boolean>(false);
  const [fullAiReview, setFullAiReview] = useState<AiFullReviewData | null>(null);
  const [isLoadingFullReview, setIsLoadingFullReview] = useState<boolean>(false);

  const [status, setStatus] = useState<'WAITING' | 'PLAYING' | 'FINISHED'>(
    gameConfig.mode === 'online' ? 'WAITING' : 'PLAYING'
  );
  const statusRef = useRef(status);
  statusRef.current = status;

  const [postGameSummary, setPostGameSummary] = useState<PostGameSummary | null>(null);
  const [drawOfferFrom, setDrawOfferFrom] = useState<string | null>(null);
  const [spectatorsCount, setSpectatorsCount] = useState<number>(0);

  const [opponentInfo, setOpponentInfo] = useState<{
    uid: string;
    username: string;
    countryCode: string;
    elo: number;
  }>({
    uid: 'stockfish-bot',
    username: `Stockfish IA (${gameConfig.botLevel} ELO)`,
    countryCode: 'UN',
    elo: gameConfig.botLevel,
  });

  // Calculer l'analyse coup par coup locale pour la feuille de coups
  const rebuildMoveAnnotations = useCallback((moves: Move[]) => {
    const temp = new Chess();
    let prev = 0;
    const list: AnnotatedMoveMeta[] = [];

    moves.forEach((m, idx) => {
      temp.move(m);
      const curEval = evaluateLocalBoard(temp);
      const swing = m.color === 'w' ? prev - curEval : curEval - prev;
      const cpLoss = Math.max(0, swing);
      const classification = classifyMoveSwing(cpLoss, Boolean(m.captured), curEval);
      list.push({
        moveIndex: idx,
        moveNumber: Math.floor(idx / 2) + 1,
        san: m.san,
        color: m.color,
        from: m.from,
        to: m.to,
        evalCp: curEval,
        cpDelta: curEval - prev,
        classification,
      });
      prev = curEval;
    });

    setAnnotatedMoves(list);
  }, []);

  // Demander un commentaire au Coach IA Gemini (interdit pendant une partie en ligne en cours)
  const requestAiCommentary = useCallback(
    async (customFen?: string, customLastSan?: string, customEvalCp?: number) => {
      if (configRef.current.mode === 'online' && statusRef.current === 'PLAYING') {
        return;
      }
      const c = chessRef.current;
      const targetFen = customFen || c.fen();
      const currentPgn = c.pgn();
      const history = c.history({ verbose: true });
      const lastSan =
        customLastSan || (history.length > 0 ? history[history.length - 1].san : undefined);

      const localInsights = computeLocalEngineInsights(
        targetFen,
        (configRef.current.botStyle as AiPlayStyle) || 'balanced'
      );
      const evalVal = customEvalCp !== undefined ? customEvalCp : localInsights.evaluationCp;

      const instant = buildInstantCoachCommentary({
        fen: targetFen,
        pgn: currentPgn,
        lastMoveSan: lastSan,
        evaluationCp: evalVal,
        topMoves: localInsights.topMoves,
        threatMove: localInsights.threatMove,
      });
      setAiCommentary(instant);

      setIsLoadingCommentary(true);
      try {
        const res = await apiRequest<{ commentary: AiCoachCommentary }>('/api/games/ai-commentary', {
          method: 'POST',
          body: JSON.stringify({
            fen: targetFen,
            pgn: currentPgn,
            lastMoveSan: lastSan,
            playerColor: configRef.current.playerColor,
            evaluationCp: evalVal,
          }),
        });
        if (res && res.commentary) {
          setAiCommentary(res.commentary);
        }
      } catch {
        // Conserver le commentaire instantané
      } finally {
        setIsLoadingCommentary(false);
      }
    },
    []
  );

  // Demander le rapport complet Grand Maître IA sur toute la partie
  const requestFullAiReview = useCallback(
    async (customResult?: string, customReason?: string) => {
      setIsLoadingFullReview(true);
      try {
        const res = await apiRequest<{ review: AiFullReviewData; analysis: any }>(
          '/api/games/ai-full-review',
          {
            method: 'POST',
            body: JSON.stringify({
              pgn: chessRef.current.pgn(),
              playerColor: configRef.current.playerColor,
              result: customResult || '1-0',
              reason: customReason || 'Analyse complète',
            }),
          }
        );
        if (res && res.review) {
          setFullAiReview(res.review);
        }
      } catch {
        // Ignorer
      } finally {
        setIsLoadingFullReview(false);
      }
    },
    []
  );

  // Synchroniser l'état local depuis l'instance chessRef
  const syncBoardState = useCallback(() => {
    const c = chessRef.current;
    const currentFen = c.fen();
    const currentPgn = c.pgn();
    const moves = c.history({ verbose: true });
    const lastSan = moves.length > 0 ? moves[moves.length - 1].san : undefined;

    setFen(currentFen);
    setPgn(currentPgn);
    setHistoryVerbose(moves);
    setViewingMoveIndex(null);

    const insights = computeLocalEngineInsights(
      currentFen,
      (configRef.current.botStyle as AiPlayStyle) || 'balanced'
    );
    setEvaluationCp(insights.evaluationCp);
    setTopEngineMoves(insights.topMoves);
    setThreatMove(insights.threatMove);
    rebuildMoveAnnotations(moves);

    if (configRef.current.mode !== 'online') {
      const instantCoach = buildInstantCoachCommentary({
        fen: currentFen,
        pgn: currentPgn,
        lastMoveSan: lastSan,
        evaluationCp: insights.evaluationCp,
        topMoves: insights.topMoves,
        threatMove: insights.threatMove,
      });
      setAiCommentary(instantCoach);
    } else {
      setAiCommentary(null);
    }
  }, [rebuildMoveAnnotations]);

  // Finaliser la partie et lancer l'analyse post-partie + revue Coach IA
  const concludeGame = useCallback(
    async (result: '1-0' | '0-1' | '1/2-1/2', reason: string) => {
      if (statusRef.current === 'FINISHED') return;
      setStatus('FINISHED');
      statusRef.current = 'FINISHED';

      const cfg = configRef.current;
      const playerWon =
        (cfg.playerColor === 'w' && result === '1-0') ||
        (cfg.playerColor === 'b' && result === '0-1');
      chessSounds.playGameEnd(playerWon);

      requestFullAiReview(result, reason);

      try {
        if (user && cfg.mode === 'bot') {
          const res = await apiRequest('/api/games/complete', {
            method: 'POST',
            body: JSON.stringify({
              opponentUid: 'stockfish-bot',
              opponentUsername: `Stockfish (${cfg.botLevel} ELO)`,
              opponentCountry: 'UN',
              opponentElo: cfg.botLevel,
              playerColor: cfg.playerColor,
              category: cfg.category,
              timeControl: cfg.timeControl,
              result,
              reason,
              pgn: chessRef.current.pgn(),
              finalFen: chessRef.current.fen(),
              movesCount: chessRef.current.history().length,
            }),
          });
          if (res.user) updateUser(res.user);
          setPostGameSummary({
            result,
            reason,
            whiteAccuracy: res.analysis?.whiteAccuracy ?? 90,
            blackAccuracy: res.analysis?.blackAccuracy ?? 86,
            brilliantMoves: res.analysis?.brilliantMoves ?? 0,
            greatMoves: res.analysis?.greatMoves ?? 2,
            blunders: res.analysis?.blunders ?? 0,
            mistakes: res.analysis?.mistakes ?? 1,
            inaccuracies: res.analysis?.inaccuracies ?? 2,
            goodMoves: res.analysis?.goodMoves ?? 8,
            bestMoves: res.analysis?.bestMoves ?? 10,
            eloDelta: res.eloChange?.delta,
            newElo: res.eloChange?.newElo,
          });
          return;
        }

        const analysisRes = await apiRequest('/api/games/analyze', {
          method: 'POST',
          body: JSON.stringify({ pgn: chessRef.current.pgn() }),
        });
        setPostGameSummary({
          result,
          reason,
          whiteAccuracy: analysisRes.analysis?.whiteAccuracy ?? 89,
          blackAccuracy: analysisRes.analysis?.blackAccuracy ?? 85,
          brilliantMoves: analysisRes.analysis?.brilliantMoves ?? 0,
          greatMoves: analysisRes.analysis?.greatMoves ?? 2,
          blunders: analysisRes.analysis?.blunders ?? 0,
          mistakes: analysisRes.analysis?.mistakes ?? 1,
          inaccuracies: analysisRes.analysis?.inaccuracies ?? 2,
          goodMoves: analysisRes.analysis?.goodMoves ?? 6,
          bestMoves: analysisRes.analysis?.bestMoves ?? 8,
        });
      } catch {
        setPostGameSummary({
          result,
          reason,
          whiteAccuracy: 88,
          blackAccuracy: 84,
          brilliantMoves: 0,
          greatMoves: 1,
          blunders: 0,
          mistakes: 1,
          inaccuracies: 2,
          goodMoves: 7,
          bestMoves: 9,
        });
      }
    },
    [requestFullAiReview, updateUser, user]
  );

  // Vérifier les conditions de fin de partie
  const checkGameEndConditions = useCallback(() => {
    const c = chessRef.current;
    if (!c.isGameOver()) return false;

    if (c.isCheckmate()) {
      const winner = c.turn() === 'w' ? '0-1' : '1-0';
      concludeGame(winner, 'Échec et Mat');
    } else if (c.isStalemate()) {
      concludeGame('1/2-1/2', 'Pat (Aucun coup légal)');
    } else if (c.isThreefoldRepetition()) {
      concludeGame('1/2-1/2', 'Triple répétition de position');
    } else if (c.isInsufficientMaterial()) {
      concludeGame('1/2-1/2', 'Matériel insuffisant');
    } else {
      concludeGame('1/2-1/2', 'Règle des 50 coups / Nulle');
    }
    return true;
  }, [concludeGame]);

  // Déclencher le coup de Stockfish IA
  const triggerBotTurnIfNeeded = useCallback(() => {
    const c = chessRef.current;
    const cfg = configRef.current;
    if (cfg.mode !== 'bot' || c.isGameOver()) return;
    if (c.turn() === cfg.playerColor) return;

    setIsBotThinking(true);
    const expectedFen = c.fen();

    setTimeout(async () => {
      try {
        if (chessRef.current.fen() !== expectedFen || chessRef.current.isGameOver()) {
          return;
        }
        const {
          bestMove,
          evaluationCp: newEval,
        } = await requestStockfishMove(
          expectedFen,
          cfg.botLevel as BotEloLevel,
          (cfg.botStyle as AiPlayStyle) || 'balanced',
          cfg.botDepth
        );

        if (chessRef.current.fen() !== expectedFen) return;

        let played: Move | null = null;
        if (bestMove) {
          try {
            played = chessRef.current.move({
              from: bestMove.from,
              to: bestMove.to,
              promotion: bestMove.promotion || 'q',
            });
          } catch {
            played = null;
          }
        }

        if (!played) {
          const fallbackMoves = chessRef.current.moves({ verbose: true });
          if (fallbackMoves.length > 0) {
            played = chessRef.current.move(fallbackMoves[0]);
          }
        }

        if (played) {
          if (chessRef.current.inCheck()) chessSounds.playCheck();
          else if (played.captured) chessSounds.playCapture();
          else if (played.san.includes('O-O')) chessSounds.playCastle();
          else chessSounds.playMove();

          setLastMoveSquares({ from: played.from, to: played.to });
          syncBoardState();
          const ended = checkGameEndConditions();
          if (!ended && autoCoachRef.current) {
            requestAiCommentary(chessRef.current.fen(), played.san, newEval);
          }
        }
      } finally {
        setIsBotThinking(false);
      }
    }, 280);
  }, [checkGameEndConditions, requestAiCommentary, syncBoardState]);

  // Mettre à jour l'étiquette de l'IA sans réinitialiser la partie
  useEffect(() => {
    if (gameConfig.mode === 'bot') {
      const styleLabels: Record<string, string> = {
        balanced: 'Équilibré',
        aggressive: 'Attaque',
        solid: 'Forteresse',
        tactical: 'Tactique',
      };
      const styleSuffix = gameConfig.botStyle ? ` · ${styleLabels[gameConfig.botStyle] || ''}` : '';
      setOpponentInfo({
        uid: 'stockfish-bot',
        username: `Stockfish IA (${gameConfig.botLevel} ELO${styleSuffix})`,
        countryCode: 'UN',
        elo: gameConfig.botLevel,
      });
    }
  }, [gameConfig.botLevel, gameConfig.botStyle, gameConfig.mode]);

  // Initialisation au lancement d'une nouvelle partie
  useEffect(() => {
    chessRef.current = new Chess();
    setPostGameSummary(null);
    setFullAiReview(null);
    setHintArrow(null);
    setActiveThreatArrow(null);
    setLastMoveSquares(null);
    setDrawOfferFrom(null);

    const initialQuota = gameConfig.mode === 'online' ? 0 : MAX_HINTS_PER_GAME;
    setHintsRemaining(initialQuota);
    hintsRemainingRef.current = initialQuota;

    if (gameConfig.mode === 'online') {
      setShowTacticalHeatmap(false);
    }

    syncBoardState();

    if (gameConfig.mode === 'bot') {
      setStatus('PLAYING');
      statusRef.current = 'PLAYING';
      if (gameConfig.playerColor === 'b') {
        triggerBotTurnIfNeeded();
      }
    } else if (gameConfig.mode === 'local') {
      setStatus('PLAYING');
      statusRef.current = 'PLAYING';
      setOpponentInfo({
        uid: 'local-guest',
        username: 'Joueur 2 (Sur cet écran)',
        countryCode: user?.countryCode || 'FR',
        elo: user?.eloBlitz || 1200,
      });
    } else if (gameConfig.mode === 'online' && gameConfig.roomCode) {
      setStatus('WAITING');
      statusRef.current = 'WAITING';
      socket.emit('room:join', {
        roomCode: gameConfig.roomCode,
        uid: user?.uid || `guest-${socket.id}`,
        username: user?.username || 'Joueur Invité',
        countryCode: user?.countryCode || 'FR',
        elo: user?.eloBlitz || 1200,
        asSpectator: gameConfig.asSpectator,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameConfig.mode,
    gameConfig.playerColor,
    gameConfig.roomCode,
    gameConfig.asSpectator,
  ]);

  // Écouteurs Socket.io pour le mode multijoueur temps réel
  useEffect(() => {
    if (gameConfig.mode !== 'online') return;

    const handleRoomJoined = (data: any) => {
      if (data.pgn) {
        try {
          chessRef.current.loadPgn(data.pgn);
        } catch {
          chessRef.current.load(data.fen);
        }
      } else if (data.fen) {
        chessRef.current.load(data.fen);
      }
      const nextStatus = data.status || 'PLAYING';
      setStatus(nextStatus);
      statusRef.current = nextStatus;
      setSpectatorsCount(data.spectatorsCount || 0);

      const myUid = user?.uid;
      if (data.whitePlayer && data.whitePlayer.uid !== myUid) {
        setOpponentInfo(data.whitePlayer);
      } else if (data.blackPlayer) {
        setOpponentInfo(data.blackPlayer);
      }
      syncBoardState();
    };

    const handleGameUpdate = (data: any) => {
      if (data.pgn) {
        try {
          chessRef.current.loadPgn(data.pgn);
        } catch {
          chessRef.current.load(data.fen);
        }
      } else if (data.fen) {
        chessRef.current.load(data.fen);
      }
      if (data.lastMove) {
        setLastMoveSquares({ from: data.lastMove.from, to: data.lastMove.to });
      }
      if (data.isCheck) chessSounds.playCheck();
      else chessSounds.playMove();

      setSpectatorsCount(data.spectatorsCount || 0);
      syncBoardState();
    };

    const handleGameOver = (data: any) => {
      setStatus('FINISHED');
      statusRef.current = 'FINISHED';
      chessSounds.playGameEnd(true);
      requestFullAiReview(data.result, data.reason);
      setPostGameSummary({
        result: data.result,
        reason: data.reason,
        whiteAccuracy: data.analysis?.whiteAccuracy ?? 90,
        blackAccuracy: data.analysis?.blackAccuracy ?? 87,
        brilliantMoves: data.analysis?.brilliantMoves ?? 0,
        greatMoves: data.analysis?.greatMoves ?? 2,
        blunders: data.analysis?.blunders ?? 0,
        mistakes: data.analysis?.mistakes ?? 1,
        inaccuracies: data.analysis?.inaccuracies ?? 2,
        goodMoves: data.analysis?.goodMoves ?? 8,
        bestMoves: data.analysis?.bestMoves ?? 9,
        eloDelta:
          gameConfig.playerColor === 'w' ? data.whiteDelta : data.blackDelta,
        newElo:
          gameConfig.playerColor === 'w' ? data.whiteEloNew : data.blackEloNew,
      });
    };

    const handleDrawOffered = (data: any) => {
      setDrawOfferFrom(data.username || 'Adversaire');
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('game:update', handleGameUpdate);
    socket.on('game:over', handleGameOver);
    socket.on('game:drawOffered', handleDrawOffered);

    return () => {
      socket.off('room:joined', handleRoomJoined);
      socket.off('game:update', handleGameUpdate);
      socket.off('game:over', handleGameOver);
      socket.off('game:drawOffered', handleDrawOffered);
    };
  }, [gameConfig.mode, gameConfig.playerColor, requestFullAiReview, socket, syncBoardState, user?.uid]);

  // Exécuter un coup du joueur (efface immédiatement toute flèche d'aide)
  const makeMove = useCallback(
    (from: string, to: string, promotion = 'q'): boolean => {
      if (statusRef.current !== 'PLAYING' || viewingMoveIndex !== null) return false;
      const c = chessRef.current;
      const cfg = configRef.current;

      if (cfg.mode === 'bot' && c.turn() !== cfg.playerColor) {
        return false;
      }

      let moveObj: Move | null = null;
      try {
        moveObj = c.move({ from, to, promotion });
      } catch {
        return false;
      }

      if (!moveObj) return false;

      // Effacer les flèches dès que le coup est joué
      setHintArrow(null);
      setActiveThreatArrow(null);
      setLastMoveSquares({ from: moveObj.from, to: moveObj.to });

      if (c.inCheck()) chessSounds.playCheck();
      else if (moveObj.captured) chessSounds.playCapture();
      else if (moveObj.san.includes('O-O')) chessSounds.playCastle();
      else chessSounds.playMove();

      syncBoardState();

      if (cfg.mode === 'online' && cfg.roomCode) {
        socket.emit('game:move', {
          roomCode: cfg.roomCode,
          uid: user?.uid || `guest-${socket.id}`,
          from,
          to,
          promotion,
        });
        return true;
      }

      const ended = checkGameEndConditions();
      if (!ended && cfg.mode === 'bot') {
        triggerBotTurnIfNeeded();
      } else if (!ended && autoCoachRef.current) {
        requestAiCommentary(c.fen(), moveObj.san);
      }
      return true;
    },
    [
      checkGameEndConditions,
      requestAiCommentary,
      socket,
      syncBoardState,
      triggerBotTurnIfNeeded,
      user?.uid,
      viewingMoveIndex,
    ]
  );

  // Demander une flèche d'aide autorisée (limité à 3 par partie hors-ligne, strictement interdit en ligne)
  const requestHint = useCallback(async () => {
    if (configRef.current.mode === 'online') {
      return;
    }
    if (statusRef.current !== 'PLAYING') {
      return;
    }
    // Si une flèche est déjà affichée sur ce tour, ne pas décompter une 2e fois
    if (hintArrow) {
      return;
    }
    if (hintsRemainingRef.current <= 0) {
      return;
    }

    const nextQuota = hintsRemainingRef.current - 1;
    hintsRemainingRef.current = nextQuota;
    setHintsRemaining(nextQuota);

    const currentFen = chessRef.current.fen();
    const insights = computeLocalEngineInsights(currentFen, 'tactical');
    if (insights.topMoves[0]) {
      setHintArrow([insights.topMoves[0].from, insights.topMoves[0].to]);
    }
    if (insights.threatMove) {
      setActiveThreatArrow([insights.threatMove.from, insights.threatMove.to]);
    }

    const { bestMove, topMoves, threatMove: nextThreat } = await requestStockfishMove(
      currentFen,
      2400,
      'tactical',
      2
    );
    if (bestMove) {
      setHintArrow([bestMove.from, bestMove.to]);
    }
    if (topMoves) setTopEngineMoves(topMoves);
    if (nextThreat) {
      setThreatMove(nextThreat);
      setActiveThreatArrow([nextThreat.from, nextThreat.to]);
    }
  }, [hintArrow]);

  // Annuler le dernier coup (uniquement hors-ligne)
  const undoMove = useCallback(() => {
    if (configRef.current.mode === 'online') return;
    const c = chessRef.current;
    c.undo();
    if (configRef.current.mode === 'bot') {
      c.undo();
    }
    setHintArrow(null);
    setActiveThreatArrow(null);
    syncBoardState();
  }, [syncBoardState]);

  // Recommencer la partie (réinitialise le quota de 3 aides hors-ligne)
  const restartGame = useCallback(() => {
    chessRef.current = new Chess();
    setPostGameSummary(null);
    setFullAiReview(null);
    setHintArrow(null);
    setActiveThreatArrow(null);
    setLastMoveSquares(null);
    const resetQuota = configRef.current.mode === 'online' ? 0 : MAX_HINTS_PER_GAME;
    setHintsRemaining(resetQuota);
    hintsRemainingRef.current = resetQuota;
    setStatus('PLAYING');
    statusRef.current = 'PLAYING';
    syncBoardState();
    if (configRef.current.mode === 'bot' && configRef.current.playerColor === 'b') {
      triggerBotTurnIfNeeded();
    }
  }, [syncBoardState, triggerBotTurnIfNeeded]);

  // Abandonner
  const resignGame = useCallback(() => {
    if (statusRef.current !== 'PLAYING') return;
    const cfg = configRef.current;
    if (cfg.mode === 'online' && cfg.roomCode) {
      socket.emit('game:resign', {
        roomCode: cfg.roomCode,
        uid: user?.uid || `guest-${socket.id}`,
      });
      return;
    }
    const winner = cfg.playerColor === 'w' ? '0-1' : '1-0';
    concludeGame(winner, 'Abandon');
  }, [concludeGame, socket, user?.uid]);

  // Proposer ou accepter la nulle
  const offerOrAcceptDraw = useCallback(
    (accept = false) => {
      if (statusRef.current !== 'PLAYING') return;
      const cfg = configRef.current;
      if (cfg.mode === 'online' && cfg.roomCode) {
        socket.emit('game:offerDraw', {
          roomCode: cfg.roomCode,
          uid: user?.uid || `guest-${socket.id}`,
          accept,
        });
        setDrawOfferFrom(null);
        return;
      }
      concludeGame('1/2-1/2', 'Nulle par accord mutuel');
    },
    [concludeGame, socket, user?.uid]
  );

  // Obtenir la position FEN affichée
  const displayedFen = useMemo(() => {
    if (viewingMoveIndex === null) return fen;
    const temp = new Chess();
    const movesToReplay = historyVerbose.slice(0, viewingMoveIndex + 1);
    for (const m of movesToReplay) {
      temp.move(m);
    }
    return temp.fen();
  }, [fen, historyVerbose, viewingMoveIndex]);

  const activeMoveAnnotation = useMemo(() => {
    if (annotatedMoves.length === 0) return null;
    const idx = viewingMoveIndex === null ? annotatedMoves.length - 1 : viewingMoveIndex;
    return annotatedMoves[idx] || null;
  }, [annotatedMoves, viewingMoveIndex]);

  const openingInfo = useMemo(() => detectOpeningClient(pgn), [pgn]);
  const capturedMaterial = useMemo(() => computeCapturedMaterial(displayedFen), [displayedFen]);
  const tacticalHeatmap = useMemo(
    () => (!isOnlineMode && showTacticalHeatmap ? computeTacticalHeatmap(displayedFen) : {}),
    [displayedFen, isOnlineMode, showTacticalHeatmap]
  );

  const getLegalMovesForSquare = useCallback((square: string) => {
    try {
      return chessRef.current.moves({ square: square as any, verbose: true });
    } catch {
      return [];
    }
  }, []);

  return {
    fen: displayedFen,
    liveFen: fen,
    pgn,
    turn: chessRef.current.turn(),
    inCheck: chessRef.current.inCheck(),
    isOnlineMode,
    hintsRemaining,
    maxHintsPerGame: MAX_HINTS_PER_GAME,
    historyVerbose,
    annotatedMoves,
    activeMoveAnnotation,
    viewingMoveIndex,
    setViewingMoveIndex,
    evaluationCp,
    isBotThinking,
    hintArrow,
    activeThreatArrow,
    topEngineMoves: isOnlineMode && status === 'PLAYING' ? [] : topEngineMoves,
    threatMove: isOnlineMode && status === 'PLAYING' ? null : threatMove,
    lastMoveSquares,
    openingInfo,
    capturedMaterial,
    tacticalHeatmap,
    showTacticalHeatmap,
    setShowTacticalHeatmap,
    autoCoachEnabled,
    setAutoCoachEnabled,
    aiCommentary,
    isLoadingCommentary,
    requestAiCommentary,
    fullAiReview,
    isLoadingFullReview,
    requestFullAiReview,
    status,
    postGameSummary,
    setPostGameSummary,
    drawOfferFrom,
    spectatorsCount,
    opponentInfo,
    makeMove,
    requestHint,
    undoMove,
    restartGame,
    resignGame,
    offerOrAcceptDraw,
    concludeGame,
    getLegalMovesForSquare,
  };
}
