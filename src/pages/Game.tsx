// src/pages/Game.tsx
// Arène de Jeu & Laboratoire d'Analyse IA (Android & Desktop) :
// Échiquier 100% dégagé (le nom du coup et l'échec sont affichés HORS du plateau pour ne jamais cacher les pièces),
// Flèches d'aide soumises à l'autorisation du joueur (limitées à 3 par partie hors-ligne, strictement interdites en ligne)
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Lightbulb,
  RotateCcw,
  RefreshCw,
  Flag,
  Handshake,
  FlipVertical,
  Volume2,
  VolumeX,
  Share2,
  Check,
  Award,
  Eye,
  ListOrdered,
  MessageSquare,
  Sliders,
  Sparkles,
  Crosshair,
  BookOpen,
  Cpu,
  Lock,
} from 'lucide-react';
import { ChessBoard, CLASSIFICATION_BADGES } from '../components/ChessBoard.tsx';
import { PlayerCard } from '../components/PlayerCard.tsx';
import { MoveList } from '../components/MoveList.tsx';
import { Chat } from '../components/Chat.tsx';
import { useChessGame } from '../hooks/useChessGame.ts';
import { useTimer } from '../hooks/useTimer.ts';
import {
  BOARD_THEMES,
  BoardThemeKey,
  PieceStyleKey,
  useAppStore,
} from '../store/useAppStore.ts';
import { AiPlayStyle } from '../lib/stockfish.worker.ts';

function parseTcToMs(tc: string): { initialMs: number; incrementMs: number } {
  if (tc === 'correspondence') return { initialMs: 86400000, incrementMs: 0 };
  const parts = tc.split('+');
  const mins = Math.max(1, Number(parts[0]) || 3);
  const inc = Math.max(0, Number(parts[1]) || 0);
  return { initialMs: mins * 60 * 1000, incrementMs: inc * 1000 };
}

export const Game: React.FC = () => {
  const {
    user,
    gameConfig,
    boardTheme,
    pieceStyle,
    soundEnabled,
    setBoardTheme,
    setPieceStyle,
    toggleSound,
    startGameWithConfig,
    updateGameConfig,
    goBack,
    setActivePage,
  } = useAppStore();

  const {
    fen,
    pgn,
    turn,
    inCheck,
    isOnlineMode,
    hintsRemaining,
    maxHintsPerGame,
    historyVerbose,
    annotatedMoves,
    activeMoveAnnotation,
    viewingMoveIndex,
    setViewingMoveIndex,
    evaluationCp,
    isBotThinking,
    hintArrow,
    activeThreatArrow,
    topEngineMoves,
    threatMove,
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
  } = useChessGame();

  const [flipped, setFlipped] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState<'coach' | 'moves' | 'chat' | 'settings'>(
    gameConfig.mode === 'online' ? 'moves' : 'coach'
  );

  const { initialMs, incrementMs } = useMemo(
    () => parseTcToMs(gameConfig.timeControl),
    [gameConfig.timeControl]
  );

  const { whiteTimeMs, blackTimeMs } = useTimer({
    initialWhiteMs: initialMs,
    initialBlackMs: initialMs,
    incrementMs,
    activeTurn: turn,
    isRunning: status === 'PLAYING' && historyVerbose.length > 0,
    onTimeout: (loserColor) => {
      const winner = loserColor === 'w' ? '0-1' : '1-0';
      concludeGame(winner, 'Temps écoulé (Drapeau)');
    },
  });

  const orientation: 'white' | 'black' = useMemo(() => {
    const base = gameConfig.playerColor === 'b' ? 'black' : 'white';
    if (!flipped) return base;
    return base === 'white' ? 'black' : 'white';
  }, [flipped, gameConfig.playerColor]);

  const playerElo =
    gameConfig.category === 'bullet'
      ? user?.eloBullet || 1200
      : gameConfig.category === 'rapid'
        ? user?.eloRapid || 1200
        : gameConfig.category === 'classical'
          ? user?.eloClassical || 1200
          : user?.eloBlitz || 1200;

  const isPlayerWhite = gameConfig.playerColor === 'w';
  const topIsWhite = orientation === 'black';

  const activeBadge = activeMoveAnnotation
    ? CLASSIFICATION_BADGES[activeMoveAnnotation.classification]
    : null;

  const handleCopyInvite = () => {
    const code = gameConfig.roomCode || 'ARENA-01';
    navigator.clipboard.writeText(`${window.location.origin}/?room=${code}`);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const handleAnalyzeSpecificMove = (idx: number) => {
    setViewingMoveIndex(idx === historyVerbose.length - 1 ? null : idx);
    if (isOnlineMode && status === 'PLAYING') return;
    const meta = annotatedMoves[idx];
    setActiveSideTab('coach');
    requestAiCommentary(undefined, meta?.san, meta?.evalCp);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-2 sm:px-6 py-2 sm:py-4 pb-24 md:pb-8">
      {/* Barre supérieure avec Flèche Retour permanente + Ouverture ECO + Dernier coup (HORS de l'échiquier) */}
      <div className="mb-2.5 px-2.5 sm:px-3.5 py-2 bg-[#23211D] border border-white/10 rounded-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={goBack}
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#161512] hover:bg-white/10 border border-white/15 text-[#EEEED2] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            title="Revenir en arrière"
          >
            <ArrowLeft className="w-4 h-4 text-[#95BB4A]" />
            <span>Retour</span>
          </button>

          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <span className="font-mono font-bold text-[#95BB4A] shrink-0">
              {gameConfig.mode === 'bot'
                ? `IA ${gameConfig.botLevel} ELO`
                : `SALLE ${gameConfig.roomCode || 'LIVE'}`}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-slate-300 truncate">
              <BookOpen className="w-3.5 h-3.5 text-[#769656] shrink-0 hidden sm:inline" />
              <span className="font-mono text-[#EEEED2] font-semibold">{openingInfo.eco}</span>
              <span className="truncate text-slate-300">{openingInfo.name}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Alerte Roi en Échec affichée HORS de l'échiquier pour ne jamais masquer une pièce */}
          {inCheck && (
            <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold animate-pulse">
              ♚ Échec au Roi !
            </span>
          )}

          {/* Badge du dernier coup joué affiché HORS de l'échiquier */}
          {activeMoveAnnotation && activeBadge && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161512] border border-white/15">
              <span
                className={`inline-flex items-center justify-center px-1.5 h-4 rounded text-[10px] font-extrabold font-mono ${activeBadge.bg} ${activeBadge.text}`}
              >
                {activeBadge.symbol}
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {activeMoveAnnotation.san}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                ({activeBadge.label})
              </span>
            </div>
          )}

          {spectatorsCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#161512] text-xs text-slate-400 font-mono">
              <Eye className="w-3.5 h-3.5" /> {spectatorsCount}
            </span>
          )}
          {gameConfig.mode === 'online' && (
            <button
              type="button"
              onClick={handleCopyInvite}
              className="px-2.5 py-1.5 bg-[#161512] hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-200 flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              {inviteCopied ? (
                <Check className="w-3.5 h-3.5 text-[#769656]" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span>{inviteCopied ? 'Copié' : 'Inviter'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleSound}
            className="p-1.5 bg-[#161512] hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 transition-colors"
            title={soundEnabled ? 'Couper le son' : 'Activer le son'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#769656]" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Proposition de nulle entrante */}
      {drawOfferFrom && (
        <div className="mb-3 p-3 bg-amber-950/80 border border-amber-500/50 rounded-xl flex items-center justify-between gap-3">
          <span className="text-xs text-amber-200">
            <strong>{drawOfferFrom}</strong> propose la nulle (½ - ½).
          </span>
          <button
            type="button"
            onClick={() => offerOrAcceptDraw(true)}
            className="px-3 py-1.5 bg-[#769656] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Accepter
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* COLONNE PRINCIPALE (7 cols) : Adversaire + Échiquier 100% Dégagé + Joueur + Outils */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          {/* 1. Barre Supérieure Unifiée : Adversaire + Horloge + Matériel Capturé */}
          <div className="space-y-1">
            <PlayerCard
              username={opponentInfo.username}
              countryCode={opponentInfo.countryCode}
              elo={opponentInfo.elo}
              color={topIsWhite ? 'w' : 'b'}
              isTurn={status === 'PLAYING' && (topIsWhite ? turn === 'w' : turn === 'b')}
              isBot={gameConfig.mode === 'bot'}
              isThinking={isBotThinking}
              timeMs={topIsWhite ? whiteTimeMs : blackTimeMs}
              initialTimeMs={initialMs}
            />
            <div className="flex items-center justify-between px-2.5 text-xs font-mono text-slate-300 min-h-[18px]">
              <div className="flex items-center gap-1 tracking-tighter text-sm">
                <span>
                  {(topIsWhite
                    ? capturedMaterial.whiteCaptured
                    : capturedMaterial.blackCaptured
                  ).join(' ')}
                </span>
                {(topIsWhite
                  ? capturedMaterial.whiteAdvantage
                  : capturedMaterial.blackAdvantage) > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded bg-[#769656]/30 text-[#95BB4A] text-[10px] font-bold">
                    +
                    {topIsWhite
                      ? capturedMaterial.whiteAdvantage
                      : capturedMaterial.blackAdvantage}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {isBotThinking
                  ? 'Stockfish calcule son coup...'
                  : viewingMoveIndex !== null
                    ? `Mode inspection : coup #${viewingMoveIndex + 1}`
                    : turn === 'w'
                      ? 'Trait aux Blancs'
                      : 'Trait aux Noirs'}
              </span>
            </div>
          </div>

          {/* 2. Plateau d'échecs 100% dégagé (aucun badge ni bouton sur les cases) */}
          <div className="bg-[#23211D] border border-white/10 rounded-xl p-1.5 sm:p-3 flex items-center justify-center">
            <ChessBoard
              fen={fen}
              orientation={orientation}
              onMove={makeMove}
              getLegalMoves={getLegalMovesForSquare}
              hintArrow={hintArrow}
              threatArrow={activeThreatArrow}
              tacticalHeatmap={tacticalHeatmap}
              lastMoveSquares={lastMoveSquares}
              evaluationCp={evaluationCp}
            />
          </div>

          {/* 3. Barre Inférieure Unifiée : Vous (Joueur) + Horloge + Matériel Capturé */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2.5 text-xs font-mono text-slate-300 min-h-[18px]">
              <div className="flex items-center gap-1 tracking-tighter text-sm">
                <span>
                  {(!topIsWhite
                    ? capturedMaterial.whiteCaptured
                    : capturedMaterial.blackCaptured
                  ).join(' ')}
                </span>
                {(!topIsWhite
                  ? capturedMaterial.whiteAdvantage
                  : capturedMaterial.blackAdvantage) > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded bg-[#769656]/30 text-[#95BB4A] text-[10px] font-bold">
                    +
                    {!topIsWhite
                      ? capturedMaterial.whiteAdvantage
                      : capturedMaterial.blackAdvantage}
                  </span>
                )}
              </div>
              {isOnlineMode ? (
                <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Fair-Play FIDE : Flèches & Aide IA interdites en ligne
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-mono">
                  Flèches d’aide autorisées restantes :{' '}
                  <strong className={hintsRemaining > 0 ? 'text-[#95BB4A]' : 'text-red-400'}>
                    {hintsRemaining}/{maxHintsPerGame}
                  </strong>
                </span>
              )}
            </div>

            <PlayerCard
              username={user?.username || 'Vous (Joueur)'}
              countryCode={user?.countryCode || 'FR'}
              elo={playerElo}
              avatarUrl={user?.avatarUrl}
              color={topIsWhite ? 'b' : 'w'}
              isTurn={status === 'PLAYING' && (topIsWhite ? turn === 'b' : turn === 'w')}
              timeMs={topIsWhite ? blackTimeMs : whiteTimeMs}
              initialTimeMs={initialMs}
              onClickProfile={() => user && setActivePage('profile', user.uid)}
            />
          </div>

          {/* Bulle Coach IA en Direct (Uniquement hors-ligne ou une fois la partie en ligne terminée) */}
          {!isOnlineMode && aiCommentary && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#23211D] border border-[#769656]/60 flex flex-col gap-1 text-xs shadow-md">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#EEEED2] flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-[#95BB4A] shrink-0" />
                  <span className="truncate">{aiCommentary.headline}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#769656]/25 text-[#95BB4A] font-semibold text-[10px] shrink-0">
                  {isLoadingCommentary ? 'Coach IA...' : aiCommentary.moveQuality}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-snug">
                <strong className="text-[#95BB4A]">Plan :</strong> {aiCommentary.recommendedPlan}
              </p>
              {aiCommentary.tacticalAlert && (
                <p className="text-amber-300/90 text-[11px] leading-snug">
                  <strong className="text-amber-400">Radar :</strong> {aiCommentary.tacticalAlert}
                </p>
              )}
            </div>
          )}

          {/* 4. Barre d'Autorisation des Flèches (Limitée à 3 coups hors-ligne, 100% interdite en ligne) */}
          {isOnlineMode ? (
            <div className="p-2.5 bg-[#23211D] border border-amber-500/30 rounded-xl flex items-center justify-center gap-2 text-xs text-amber-200">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Mode En Ligne Officiel : Les flèches d’assistance et le Coach IA sont strictement désactivés pendant le match.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-[#23211D] border border-white/10 rounded-xl p-1.5">
              <button
                type="button"
                onClick={requestHint}
                disabled={status !== 'PLAYING' || hintsRemaining <= 0 || Boolean(hintArrow)}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  hintArrow
                    ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                    : hintsRemaining > 0
                      ? 'bg-[#161512] hover:bg-[#769656]/25 border-[#769656] text-[#EEEED2]'
                      : 'bg-[#161512] border-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">
                  {hintArrow
                    ? 'Flèche Affichée sur ce Coup'
                    : hintsRemaining > 0
                      ? `Autoriser Flèche d’Aide (${hintsRemaining}/${maxHintsPerGame})`
                      : 'Quota Épuisé (0/3 flèches)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowTacticalHeatmap((v) => !v)}
                className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  showTacticalHeatmap
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                    : 'bg-[#161512] border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Radar Cases & Prises</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSideTab('coach');
                  requestAiCommentary();
                }}
                disabled={isLoadingCommentary}
                className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-[#769656] hover:bg-[#86a666] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {isLoadingCommentary ? 'Analyse IA...' : 'Commenter avec IA'}
                </span>
              </button>
            </div>
          )}

          {/* 5. Barre d'Actions Tactiles (Zone du Pouce Android — Cibles >= 44px) */}
          <div className="grid grid-cols-6 gap-1.5 bg-[#23211D] border border-white/10 rounded-xl p-1.5">
            <button
              type="button"
              onClick={requestHint}
              disabled={isOnlineMode || status !== 'PLAYING' || hintsRemaining <= 0 || Boolean(hintArrow)}
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg bg-[#161512] hover:bg-[#769656]/25 border border-white/10 text-slate-200 disabled:opacity-35 transition-colors"
              title={
                isOnlineMode
                  ? 'Interdit en partie en ligne'
                  : `Autoriser une flèche d'aide (${hintsRemaining}/${maxHintsPerGame} restantes)`
              }
            >
              {isOnlineMode ? (
                <Lock className="w-4 h-4 text-slate-500" />
              ) : (
                <Lightbulb className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-[10px] font-medium whitespace-nowrap">
                {isOnlineMode ? 'Bloqué' : `Aide (${hintsRemaining}/${maxHintsPerGame})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg bg-[#161512] hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
              title="Retourner l'échiquier"
            >
              <FlipVertical className="w-4 h-4 text-slate-300" />
              <span className="text-[10px] font-medium whitespace-nowrap">Tourner</span>
            </button>

            <button
              type="button"
              onClick={undoMove}
              disabled={isOnlineMode || historyVerbose.length === 0}
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg bg-[#161512] hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-35 transition-colors"
              title="Annuler le coup"
            >
              <RotateCcw className="w-4 h-4 text-slate-300" />
              <span className="text-[10px] font-medium whitespace-nowrap">Annuler</span>
            </button>

            <button
              type="button"
              onClick={() => offerOrAcceptDraw(false)}
              disabled={status !== 'PLAYING'}
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg bg-[#161512] hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-40 transition-colors"
              title="Proposer la nulle"
            >
              <Handshake className="w-4 h-4 text-sky-400" />
              <span className="text-[10px] font-medium whitespace-nowrap">Nulle</span>
            </button>

            <button
              type="button"
              onClick={resignGame}
              disabled={status !== 'PLAYING'}
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg bg-[#161512] hover:bg-red-950/60 border border-white/10 text-red-300 disabled:opacity-40 transition-colors"
              title="Abandonner"
            >
              <Flag className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-medium whitespace-nowrap">Abandon</span>
            </button>

            <button
              type="button"
              onClick={restartGame}
              className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg bg-[#769656]/25 hover:bg-[#769656] border border-[#769656] text-white transition-colors"
              title="Nouvelle partie"
            >
              <RefreshCw className="w-4 h-4 text-[#95BB4A]" />
              <span className="text-[10px] font-semibold whitespace-nowrap">Rejouer</span>
            </button>
          </div>
        </div>

        {/* COLONNE SECONDAIRE (5 cols) : Rapport Fin de Partie + Onglets (Coach IA / Coups PGN / Chat / Puissance & Plateau) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Bilan d'Analyse Post-Partie Stockfish */}
          {postGameSummary && (
            <div className="bg-[#23211D] border-2 border-[#769656] rounded-xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#769656] shrink-0" />
                  <h3 className="text-sm font-bold text-white">
                    Analyse Stockfish ({postGameSummary.result})
                  </h3>
                </div>
                <span className="text-xs text-slate-300 font-mono">
                  {postGameSummary.reason}
                </span>
              </div>

              {postGameSummary.eloDelta !== undefined && (
                <div className="text-xs text-slate-300 font-mono tabular-nums">
                  Nouveau classement ELO :{' '}
                  <strong className="text-white">{postGameSummary.newElo}</strong> (
                  <span
                    className={
                      postGameSummary.eloDelta >= 0 ? 'text-[#769656]' : 'text-red-400'
                    }
                  >
                    {postGameSummary.eloDelta >= 0
                      ? `+${postGameSummary.eloDelta}`
                      : postGameSummary.eloDelta}
                  </span>
                  )
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 p-3 bg-[#161512] rounded-lg font-mono text-xs tabular-nums">
                <div>
                  <span className="text-slate-400 block">Précision Blancs</span>
                  <span className="text-base font-bold text-[#EEEED2]">
                    {postGameSummary.whiteAccuracy}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Précision Noirs</span>
                  <span className="text-base font-bold text-[#EEEED2]">
                    {postGameSummary.blackAccuracy}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[11px] text-slate-300 font-mono tabular-nums">
                <span className="text-cyan-400">!! Brillants: {postGameSummary.brilliantMoves ?? 0}</span>
                <span className="text-[#95BB4A]">★ Meilleurs: {postGameSummary.bestMoves}</span>
                <span>✓ Bons: {postGameSummary.goodMoves}</span>
                <span className="text-amber-400">? Erreurs: {postGameSummary.mistakes}</span>
                <span className="text-red-400">?? Gaffes: {postGameSummary.blunders}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSideTab('coach');
                    requestFullAiReview(postGameSummary.result, postGameSummary.reason);
                  }}
                  className="py-2.5 px-3 bg-[#161512] hover:bg-white/10 border border-[#769656] text-[#EEEED2] font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#95BB4A]" />
                  <span>Rapport Complet Coach IA</span>
                </button>
                <button
                  type="button"
                  onClick={restartGame}
                  className="py-2.5 px-3 bg-[#769656] hover:bg-[#86a666] text-white font-semibold text-xs rounded-lg transition-colors whitespace-nowrap"
                >
                  Nouvelle Partie
                </button>
              </div>
            </div>
          )}

          {/* Sélecteur d'Onglets à 4 vues */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#23211D] border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSideTab('coach')}
              className={`min-h-[40px] flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSideTab === 'coach'
                  ? 'bg-[#769656] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Coach IA</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('moves')}
              className={`min-h-[40px] flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSideTab === 'moves'
                  ? 'bg-[#769656] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5 shrink-0" />
              <span>Coups ({historyVerbose.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('chat')}
              className={`min-h-[40px] flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSideTab === 'chat'
                  ? 'bg-[#769656] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSideTab('settings')}
              className={`min-h-[40px] flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSideTab === 'settings'
                  ? 'bg-[#769656] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>IA & Plateau</span>
            </button>
          </div>

          {/* ONGLET 1 : COACH IA & ANALYSE AVANCÉE */}
          {activeSideTab === 'coach' && (
            <div className="bg-[#23211D] border border-white/10 rounded-xl p-4 space-y-4">
              {isOnlineMode && status === 'PLAYING' ? (
                <div className="p-6 rounded-xl bg-[#161512] border border-amber-500/40 text-center space-y-2">
                  <Lock className="w-7 h-7 text-amber-400 mx-auto" />
                  <h3 className="text-sm font-bold text-[#EEEED2]">
                    Coach IA Verrouillé en Partie Classée En Ligne
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Conformément aux règles anti-triche FIDE, les flèches d’aide et les suggestions du Coach IA sont strictement interdites pendant les matchs multijoueur en ligne. Le rapport complet se débloquera automatiquement dès la fin de la partie.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                    <div>
                      <h3 className="text-sm font-bold text-[#EEEED2] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#95BB4A]" />
                        <span>Coach Grand Maître IA & Multi-PV</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Analyse positionnelle, menaces tactiques et plan recommandé.
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCoachEnabled}
                        onChange={(e) => setAutoCoachEnabled(e.target.checked)}
                        className="accent-[#769656] w-3.5 h-3.5"
                      />
                      <span>Auto</span>
                    </label>
                  </div>

                  {/* Lignes Multi-PV Stockfish */}
                  <div className="p-3 rounded-lg bg-[#161512] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>LIGNES MOTEUR MULTI-PV</span>
                      <span className="text-[#95BB4A] font-bold">
                        {evaluationCp >= 0
                          ? `+${(evaluationCp / 100).toFixed(2)}`
                          : (evaluationCp / 100).toFixed(2)}
                      </span>
                    </div>
                    {topEngineMoves.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Jouez un coup pour voir les 3 meilleures suites calculées par le moteur.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {topEngineMoves.map((cand, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs font-mono px-2.5 py-1.5 rounded bg-[#23211D] border border-white/5"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  i === 0
                                    ? 'bg-emerald-600/30 text-emerald-300'
                                    : i === 1
                                      ? 'bg-sky-600/30 text-sky-300'
                                      : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                #{i + 1}
                              </span>
                              <span className="font-bold text-white">{cand.san}</span>
                              <span className="text-slate-400 text-[11px]">
                                ({cand.from} → {cand.to})
                              </span>
                            </div>
                            <span
                              className={
                                cand.evalCp >= 0
                                  ? 'text-[#95BB4A] font-bold'
                                  : 'text-amber-400 font-bold'
                              }
                            >
                              {cand.evalCp >= 0
                                ? `+${(cand.evalCp / 100).toFixed(1)}`
                                : (cand.evalCp / 100).toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {threatMove && (
                      <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-xs font-mono text-red-300">
                        <span>Menace adverse si vous passez :</span>
                        <strong className="px-2 py-0.5 rounded bg-red-950/80 border border-red-500/40">
                          {threatMove.san} ({threatMove.from}→{threatMove.to})
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Boutons d'action Coach IA */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => requestAiCommentary()}
                      disabled={isLoadingCommentary}
                      className="min-h-[40px] px-3 py-2 rounded-lg bg-[#769656] hover:bg-[#86a666] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {isLoadingCommentary ? 'Analyse en cours...' : 'Analyser ce Coup'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestFullAiReview()}
                      disabled={isLoadingFullReview || historyVerbose.length === 0}
                      className="min-h-[40px] px-3 py-2 rounded-lg bg-[#161512] hover:bg-white/10 disabled:opacity-40 border border-white/15 text-[#EEEED2] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Award className="w-3.5 h-3.5 text-[#95BB4A]" />
                      <span>
                        {isLoadingFullReview ? 'Bilan en cours...' : 'Bilan Complet Partie'}
                      </span>
                    </button>
                  </div>

                  {/* Commentaire en Direct du Coach IA sur la position */}
                  {aiCommentary && (
                    <div className="p-3.5 rounded-xl bg-[#161512] border border-[#769656]/50 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#EEEED2] text-sm">
                          {aiCommentary.headline}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#769656]/25 text-[#95BB4A] font-semibold text-[10px] shrink-0">
                          {aiCommentary.moveQuality}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {aiCommentary.positionalExplanation}
                      </p>
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200">
                        <strong className="block text-[11px] uppercase tracking-wider text-amber-400 mb-0.5">
                          Radar Tactique :
                        </strong>
                        {aiCommentary.tacticalAlert}
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200">
                        <strong className="block text-[11px] uppercase tracking-wider text-[#95BB4A] mb-0.5">
                          Plan Recommandé par le Coach :
                        </strong>
                        {aiCommentary.recommendedPlan}
                      </div>
                    </div>
                  )}

                  {/* Rapport Complet Post-Partie du Grand Maître IA */}
                  {fullAiReview && (
                    <div className="p-4 rounded-xl bg-[#161512] border-2 border-[#95BB4A] space-y-3 text-xs">
                      <h4 className="text-sm font-bold text-[#EEEED2] flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-[#95BB4A]" />
                        <span>{fullAiReview.summaryTitle}</span>
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        {fullAiReview.executiveSummary}
                      </p>
                      <div className="p-2.5 rounded-lg bg-[#23211D] border border-white/10">
                        <strong className="text-[#EEEED2] block mb-0.5">Ouverture :</strong>
                        <span className="text-slate-300">{fullAiReview.openingAssessment}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#23211D] border border-amber-500/30">
                        <strong className="text-amber-300 block mb-0.5">Tournant Décisif :</strong>
                        <span className="text-slate-300">{fullAiReview.criticalTurningPoint}</span>
                      </div>
                      <div className="space-y-1">
                        <strong className="text-[#95BB4A] block">
                          Conseils du Grand Maître pour progresser :
                        </strong>
                        <ul className="list-disc list-inside text-slate-300 space-y-1">
                          {fullAiReview.improvementAdvice.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ONGLET 2 : FEUILLE DE COUPS PGN & COURBE D'ÉVALUATION */}
          {activeSideTab === 'moves' && (
            <MoveList
              moves={historyVerbose}
              annotatedMoves={annotatedMoves}
              viewingIndex={viewingMoveIndex}
              onSelectMoveIndex={setViewingMoveIndex}
              onAnalyzeMoveWithAi={
                isOnlineMode && status === 'PLAYING' ? undefined : handleAnalyzeSpecificMove
              }
              pgn={pgn}
            />
          )}

          {/* ONGLET 3 : CHAT EN DIRECT */}
          {activeSideTab === 'chat' && (
            <Chat
              defaultChannel={
                gameConfig.mode === 'online' && gameConfig.roomCode
                  ? `room:${gameConfig.roomCode}`
                  : 'global'
              }
            />
          )}

          {/* ONGLET 4 : RÉGLAGE DE PUISSANCE IA EN DIRECT & PERSONNALISATION DU PLATEAU */}
          {activeSideTab === 'settings' && (
            <div className="bg-[#23211D] border border-white/10 rounded-xl p-4 space-y-5">
              {!isOnlineMode && (
                <div className="p-3.5 rounded-xl bg-[#161512] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#EEEED2] flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-[#95BB4A]" />
                      <span>Puissance de l’IA Stockfish</span>
                    </span>
                    <span className="font-mono text-xs font-extrabold text-[#95BB4A]">
                      {gameConfig.botLevel} ELO
                    </span>
                  </div>

                  <input
                    type="range"
                    min={400}
                    max={3000}
                    step={50}
                    value={gameConfig.botLevel}
                    onChange={(e) =>
                      updateGameConfig({ botLevel: Number(e.target.value) })
                    }
                    className="w-full accent-[#769656]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>400 (Débutant)</span>
                    <span>1600 (Club)</span>
                    <span>3000 (Maximum)</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Style de jeu de l’IA :
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'balanced', label: '⚖️ Équilibré' },
                          { id: 'aggressive', label: '⚔️ Agressif' },
                          { id: 'solid', label: '🛡️ Solide / Défensif' },
                          { id: 'tactical', label: '⚡ Tactique Pur' },
                        ] as { id: AiPlayStyle; label: string }[]
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateGameConfig({ botStyle: st.id })}
                          className={`py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                            (gameConfig.botStyle || 'balanced') === st.id
                              ? 'bg-[#769656]/30 border-[#769656] text-white font-semibold'
                              : 'bg-[#23211D] border-white/10 text-slate-300'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Thème de l’échiquier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    Object.entries(BOARD_THEMES) as [
                      BoardThemeKey,
                      typeof BOARD_THEMES.emerald,
                    ][]
                  ).map(([k, val]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setBoardTheme(k)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                        boardTheme === k
                          ? 'bg-[#769656]/25 border-[#769656] text-white'
                          : 'bg-[#161512] border-white/10 text-slate-300'
                      }`}
                    >
                      <span className="flex w-6 h-6 rounded overflow-hidden border border-white/20 shrink-0">
                        <span
                          className="w-1/2 h-full"
                          style={{ backgroundColor: val.lightSquare }}
                        />
                        <span
                          className="w-1/2 h-full"
                          style={{ backgroundColor: val.darkSquare }}
                        />
                      </span>
                      <span className="truncate">{val.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Style des pièces
                </label>
                <select
                  value={pieceStyle}
                  onChange={(e) => setPieceStyle(e.target.value as PieceStyleKey)}
                  className="w-full bg-[#161512] border border-white/15 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#769656]"
                >
                  <option value="staunton">Staunton FIDE Officiel</option>
                  <option value="neo">Néo-Tournoi Moderne</option>
                  <option value="tournament">Bois Royal Classique</option>
                  <option value="classic">Classique Clair</option>
                  <option value="minimal">Minimaliste Contrasté</option>
                </select>
              </div>

              {!isOnlineMode && (
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300">Votre couleur de départ</span>
                  <button
                    type="button"
                    onClick={() =>
                      startGameWithConfig({
                        playerColor: isPlayerWhite ? 'b' : 'w',
                      })
                    }
                    className="px-3 py-2 bg-[#161512] hover:bg-white/10 border border-white/15 rounded-lg text-xs font-semibold text-[#EEEED2] transition-colors whitespace-nowrap"
                  >
                    Passer aux {isPlayerWhite ? 'Noirs ♚' : 'Blancs ♔'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
