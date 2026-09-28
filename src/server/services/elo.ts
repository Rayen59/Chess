// src/server/services/elo.ts
// Service de calcul ELO officiel FIDE avec facteur K adaptatif et attribution des titres

export type EloCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface EloCalculationResult {
  whiteNewElo: number;
  blackNewElo: number;
  whiteDelta: number;
  blackDelta: number;
}

/**
 * Détermine le facteur K adaptatif selon les règles FIDE :
 * - K = 40 pour un nouveau joueur (< 30 parties jouées)
 * - K = 20 pour un joueur avec ELO < 2400
 * - K = 10 pour un joueur ayant atteint 2400+ ELO
 */
export function getAdaptiveKFactor(elo: number, gamesPlayed: number): number {
  if (gamesPlayed < 30) return 40;
  if (elo < 2400) return 20;
  return 10;
}

/**
 * Calcule l'espérance de gain E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function getExpectedScore(ratingA: number, ratingB: number): number {
  const exponent = (ratingB - ratingA) / 400;
  return 1 / (1 + Math.pow(10, exponent));
}

/**
 * Calcule les nouveaux classements ELO après une partie
 * @param whiteElo ELO actuel des Blancs
 * @param blackElo ELO actuel des Noirs
 * @param result '1-0' (Blancs gagnent), '0-1' (Noirs gagnent), '1/2-1/2' (Nulle)
 * @param whiteGames Nombre de parties jouées par les Blancs
 * @param blackGames Nombre de parties jouées par les Noirs
 */
export function calculateFideElo(
  whiteElo: number,
  blackElo: number,
  result: '1-0' | '0-1' | '1/2-1/2',
  whiteGames = 30,
  blackGames = 30
): EloCalculationResult {
  const scoreWhite = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
  const scoreBlack = 1 - scoreWhite;

  const expectedWhite = getExpectedScore(whiteElo, blackElo);
  const expectedBlack = getExpectedScore(blackElo, whiteElo);

  const kWhite = getAdaptiveKFactor(whiteElo, whiteGames);
  const kBlack = getAdaptiveKFactor(blackElo, blackGames);

  const whiteDelta = Math.round(kWhite * (scoreWhite - expectedWhite));
  const blackDelta = Math.round(kBlack * (scoreBlack - expectedBlack));

  return {
    whiteNewElo: Math.max(100, whiteElo + whiteDelta),
    blackNewElo: Math.max(100, blackElo + blackDelta),
    whiteDelta,
    blackDelta,
  };
}

/**
 * Retourne le badge FIDE officiel selon le classement ELO
 */
export function getFideBadge(elo: number): {
  title: string | null;
  label: string;
  colorClass: string;
} {
  if (elo >= 2500) {
    return { title: 'GM', label: 'Grand Maître', colorClass: 'text-amber-400' };
  }
  if (elo >= 2400) {
    return { title: 'IM', label: 'Maître International', colorClass: 'text-orange-400' };
  }
  if (elo >= 2300) {
    return { title: 'FM', label: 'Maître FIDE', colorClass: 'text-emerald-400' };
  }
  if (elo >= 2200) {
    return { title: 'CM', label: 'Candidat Maître', colorClass: 'text-sky-400' };
  }
  if (elo >= 2000) {
    return { title: 'M', label: 'Maître National', colorClass: 'text-indigo-400' };
  }
  return { title: null, label: 'Joueur Classé', colorClass: 'text-slate-400' };
}
