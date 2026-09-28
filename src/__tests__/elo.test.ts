// src/__tests__/elo.test.ts
// Tests unitaires essentiels (Vitest) : Calcul ELO FIDE, K-factor adaptatif, Badges FIDE & Moteur Stockfish
import { describe, it, expect } from 'vitest';
import {
  calculateFideElo,
  getAdaptiveKFactor,
  getFideBadge,
} from '../server/services/elo.ts';
import { analyzeCompletedGame, computeBestMove } from '../server/services/stockfish.ts';

describe('Système ELO Officiel FIDE', () => {
  it('applique un K-factor de 40 pour un nouveau joueur (< 30 parties)', () => {
    expect(getAdaptiveKFactor(1200, 10)).toBe(40);
    expect(getAdaptiveKFactor(1800, 45)).toBe(20);
    expect(getAdaptiveKFactor(2550, 100)).toBe(10);
  });

  it('calcule correctement le gain ELO lors d’une victoire entre deux joueurs égaux', () => {
    const res = calculateFideElo(1500, 1500, '1-0', 50, 50);
    expect(res.whiteDelta).toBe(10);
    expect(res.blackDelta).toBe(-10);
    expect(res.whiteNewElo).toBe(1510);
    expect(res.blackNewElo).toBe(1490);
  });

  it('attribue les badges FIDE officiels selon le seuil ELO', () => {
    expect(getFideBadge(2600).title).toBe('GM');
    expect(getFideBadge(2420).title).toBe('IM');
    expect(getFideBadge(2310).title).toBe('FM');
    expect(getFideBadge(2210).title).toBe('CM');
    expect(getFideBadge(1450).title).toBeNull();
  });
});

describe('Moteur Stockfish & Analyse Post-Partie', () => {
  it('trouve un coup légal depuis la position initiale', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = computeBestMove(startFen, 1600);
    expect(result.bestMove).not.toBeNull();
    expect(typeof result.evaluationCp).toBe('number');
  });

  it('analyse un PGN complet et retourne les pourcentages de précision', () => {
    const samplePgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
    const report = analyzeCompletedGame(samplePgn);
    expect(report.whiteAccuracy).toBeGreaterThanOrEqual(45);
    expect(report.blackAccuracy).toBeGreaterThanOrEqual(45);
    expect(report.moves.length).toBe(6);
  });
});
