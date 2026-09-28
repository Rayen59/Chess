// src/server/services/geminiCoach.ts
// Service Serveur d'Analyse et Commentaires Grand Maître avec Gemini API (@google/genai)
// Inclut un cache LRU, un régulateur de quota (anti-429 Free Tier) et un moteur analytique Grand Maître de secours
import { GoogleGenAI, Type } from '@google/genai';
import { Chess } from 'chess.js';
import { analyzeCompletedGame, computeMultiPvMoves, detectOpeningEco } from './stockfish.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface AiMoveCommentary {
  headline: string;
  moveQuality: string;
  positionalExplanation: string;
  tacticalAlert: string;
  recommendedPlan: string;
  bestEngineLine: string[];
  openingName: string;
}

export interface AiFullGameReview {
  summaryTitle: string;
  executiveSummary: string;
  openingAssessment: string;
  criticalTurningPoint: string;
  whiteStrengths: string[];
  blackStrengths: string[];
  improvementAdvice: string[];
}

// Cache mémoire et protection contre le dépassement de quota (429 RESOURCE_EXHAUSTED - 5 req/min Free Tier)
const commentaryCache = new Map<string, AiMoveCommentary>();
const reviewCache = new Map<string, AiFullGameReview>();
const MAX_CACHE_ENTRIES = 150;

let geminiCooldownUntil = 0;
let lastGeminiCallTimestamp = 0;
const MIN_GEMINI_INTERVAL_MS = 14_000; // Max ~4 appels/min pour ne jamais saturer le quota de 5/min

function canInvokeGeminiApi(): boolean {
  if (!process.env.GEMINI_API_KEY) return false;
  const now = Date.now();
  if (now < geminiCooldownUntil) return false;
  if (now - lastGeminiCallTimestamp < MIN_GEMINI_INTERVAL_MS) return false;
  return true;
}

function handleGeminiQuotaError(err: unknown): void {
  const now = Date.now();
  const msg = err instanceof Error ? err.message : String(err);
  // Extraire le délai retryDelay éventuel (ex: "retry in 52.7s" ou "52s")
  const match = msg.match(/retry in ([0-9.]+)s/i) || msg.match(/"retryDelay"\s*:\s*"([0-9.]+)s"/i);
  const waitSeconds = match ? Math.ceil(Number(match[1])) + 3 : 60;
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    geminiCooldownUntil = now + waitSeconds * 1000;
  } else {
    geminiCooldownUntil = now + 15_000;
  }
}

export async function generateMoveCommentary(params: {
  fen: string;
  pgn: string;
  lastMoveSan?: string;
  playerColor: 'w' | 'b';
  evaluationCp: number;
}): Promise<AiMoveCommentary> {
  const { fen, pgn, lastMoveSan, playerColor, evaluationCp } = params;
  const cacheKey = `${fen}|${lastMoveSan || ''}|${playerColor}`;
  const cached = commentaryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const opening = detectOpeningEco(pgn, fen);
  const multiPv = computeMultiPvMoves(fen, 2000, 3);
  const bestLine = multiPv.topMoves.map(
    (m) => `${m.san} (${m.evalCp >= 0 ? '+' : ''}${(m.evalCp / 100).toFixed(1)})`
  );

  const evalPawns = (evaluationCp / 100).toFixed(2);
  const chess = new Chess(fen);
  const turnText = chess.turn() === 'w' ? 'Blancs' : 'Noirs';

  if (canInvokeGeminiApi()) {
    lastGeminiCallTimestamp = Date.now();
    try {
      const prompt = `Tu es un Grand Maître international d'échecs et entraîneur FIDE francophone.
Analyse la position d'échecs suivante de manière pédagogique, concise et très précise :
- Position FEN : ${fen}
- Historique PGN : ${pgn || 'Début de partie'}
- Dernier coup joué : ${lastMoveSan || 'Position initiale'}
- Ouverture détectée : ${opening.eco} - ${opening.name}
- Couleur du joueur humain : ${playerColor === 'w' ? 'Blancs' : 'Noirs'}
- Trait actuel : ${turnText}
- Évaluation Stockfish : ${evalPawns} pions (positif = avantage Blancs)
- Meilleurs coups suggérés par le moteur : ${bestLine.join(', ') || 'Aucun (fin de partie)'}

Fournis ton analyse structurée en français.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: {
                type: Type.STRING,
                description: 'Titre court et percutant résumant le coup ou la position (max 70 caractères).',
              },
              moveQuality: {
                type: Type.STRING,
                description: 'Appréciation du dernier coup joué (ex: Coup théorique solide, Initiative tactique, Imprécision positionnelle).',
              },
              positionalExplanation: {
                type: Type.STRING,
                description: 'Explication claire des thèmes positionnels (centre, développement, structure de pions, sécurité du roi).',
              },
              tacticalAlert: {
                type: Type.STRING,
                description: 'Menace directe à surveiller ou opportunité tactique (clouage, fourchette, colonne ouverte, pièce non protégée).',
              },
              recommendedPlan: {
                type: Type.STRING,
                description: 'Plan concret recommandé pour les 2-3 prochains coups.',
              },
            },
            required: [
              'headline',
              'moveQuality',
              'positionalExplanation',
              'tacticalAlert',
              'recommendedPlan',
            ],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = JSON.parse(rawText.trim());
        const result: AiMoveCommentary = {
          headline: parsed.headline || `Analyse : ${opening.name}`,
          moveQuality: parsed.moveQuality || 'Coup analysé par le Coach IA',
          positionalExplanation: parsed.positionalExplanation,
          tacticalAlert: parsed.tacticalAlert,
          recommendedPlan: parsed.recommendedPlan,
          bestEngineLine: bestLine,
          openingName: `${opening.eco} · ${opening.name}`,
        };
        if (commentaryCache.size >= MAX_CACHE_ENTRIES) {
          const firstKey = commentaryCache.keys().next().value;
          if (firstKey) commentaryCache.delete(firstKey);
        }
        commentaryCache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      handleGeminiQuotaError(err);
    }
  }

  // Fallback analytique déterministe basé sur le moteur tactique local (sans erreur console)
  const bestCandidate = multiPv.topMoves[0];
  const secondCandidate = multiPv.topMoves[1];
  const threatMove = multiPv.threatMove;
  const absEval = Math.abs(evaluationCp);
  const advantageSide =
    absEval < 40
      ? 'Position équilibrée'
      : evaluationCp > 0
        ? 'Avantage aux Blancs'
        : 'Avantage aux Noirs';

  const fallbackResult: AiMoveCommentary = {
    headline: lastMoveSan
      ? `Après ${lastMoveSan} — ${advantageSide} (${Number(evalPawns) >= 0 ? '+' : ''}${evalPawns})`
      : `${opening.eco} · ${opening.name}`,
    moveQuality:
      absEval < 60
        ? 'Équilibre dynamique maintenu'
        : absEval < 180
          ? 'Pression positionnelle croissante'
          : 'Avantage décisif détecté',
    positionalExplanation: `Dans cette structure issue de ${opening.name} (${opening.eco}), le trait est aux ${turnText}. La coordination des pièces centrales et la sécurité du Roi déterminent la suite du combat.`,
    tacticalAlert: threatMove
      ? `Attention à la menace adverse potentielle ${threatMove.san} (${threatMove.from}→${threatMove.to}).`
      : chess.inCheck()
        ? 'Le Roi est actuellement en échec : vous devez parer la menace immédiatement.'
        : 'Aucune menace immédiate forcée, surveillez les pièces non défendues.',
    recommendedPlan: bestCandidate
      ? `Le moteur recommande ${bestCandidate.san} (${bestCandidate.from}→${bestCandidate.to})${
          secondCandidate ? `, ou l'alternative ${secondCandidate.san}` : ''
        } pour optimiser l’activité de vos pièces.`
      : 'Consolidez votre roque et contestez les colonnes centrales.',
    bestEngineLine: bestLine,
    openingName: `${opening.eco} · ${opening.name}`,
  };

  commentaryCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

export async function generateFullGameReview(params: {
  pgn: string;
  playerColor: 'w' | 'b';
  result: string;
  reason: string;
}): Promise<AiFullGameReview> {
  const { pgn, playerColor, result, reason } = params;
  const reviewKey = `${pgn.trim()}|${playerColor}|${result}`;
  const cached = reviewCache.get(reviewKey);
  if (cached) {
    return cached;
  }

  const engineAnalysis = analyzeCompletedGame(pgn);
  const opening = detectOpeningEco(pgn);

  // Trouver le plus grand basculement d'évaluation (tournant du match)
  let maxSwing = 0;
  let turningMove = 'Milieu de jeu';
  let prevCp = 0;
  for (const m of engineAnalysis.moves) {
    const diff = Math.abs(m.evalCp - prevCp);
    if (diff > maxSwing) {
      maxSwing = diff;
      turningMove = `Coup ${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san} (Éval ${(m.evalCp / 100).toFixed(1)})`;
    }
    prevCp = m.evalCp;
  }

  if (canInvokeGeminiApi() && pgn.trim().length > 0) {
    lastGeminiCallTimestamp = Date.now();
    try {
      const prompt = `Tu es un Grand Maître d'échecs FIDE. Rédige un bilan d'analyse post-partie complet en français pour cette partie :
- PGN : ${pgn}
- Ouverture : ${opening.eco} ${opening.name}
- Résultat : ${result} (${reason})
- Joueur coaché : ${playerColor === 'w' ? 'Blancs' : 'Noirs'}
- Précision Blancs : ${engineAnalysis.whiteAccuracy}% | Précision Noirs : ${engineAnalysis.blackAccuracy}%
- Coups brillants : ${engineAnalysis.brilliantMoves} | Meilleurs coups : ${engineAnalysis.bestMoves} | Erreurs : ${engineAnalysis.mistakes} | Gaffes : ${engineAnalysis.blunders}
- Moment clé détecté : ${turningMove}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryTitle: {
                type: Type.STRING,
                description: 'Titre du rapport du Grand Maître.',
              },
              executiveSummary: {
                type: Type.STRING,
                description: 'Résumé narratif de la physionomie de la partie en 2-3 phrases.',
              },
              openingAssessment: {
                type: Type.STRING,
                description: 'Analyse de la phase d’ouverture des deux camps.',
              },
              criticalTurningPoint: {
                type: Type.STRING,
                description: 'Explication du moment décisif où la partie a basculé.',
              },
              whiteStrengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 points forts du jeu des Blancs.',
              },
              blackStrengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 points forts du jeu des Noirs.',
              },
              improvementAdvice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 conseils concrets pour progresser après cette partie.',
              },
            },
            required: [
              'summaryTitle',
              'executiveSummary',
              'openingAssessment',
              'criticalTurningPoint',
              'whiteStrengths',
              'blackStrengths',
              'improvementAdvice',
            ],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsedReview = JSON.parse(rawText.trim()) as AiFullGameReview;
        if (reviewCache.size >= MAX_CACHE_ENTRIES) {
          const firstKey = reviewCache.keys().next().value;
          if (firstKey) reviewCache.delete(firstKey);
        }
        reviewCache.set(reviewKey, parsedReview);
        return parsedReview;
      }
    } catch (err) {
      handleGeminiQuotaError(err);
    }
  }

  const fallbackReview: AiFullGameReview = {
    summaryTitle: `Bilan Grand Maître — ${opening.name}`,
    executiveSummary: `Partie disputée sur ${engineAnalysis.moves.length} demi-coups (${result} par ${reason}). Les Blancs ont affiché une précision de ${engineAnalysis.whiteAccuracy}% contre ${engineAnalysis.blackAccuracy}% pour les Noirs.`,
    openingAssessment: `Ouverture identifiée : ${opening.eco} (${opening.name}). Le développement initial a posé les bases de la lutte pour le centre.`,
    criticalTurningPoint: `Le moment charnière s'est produit autour du ${turningMove}, provoquant la plus forte variation d'évaluation.`,
    whiteStrengths: [
      `Précision globale de ${engineAnalysis.whiteAccuracy}% sur l'ensemble de la rencontre`,
      'Bonne activité des pièces sur les colonnes centrales',
    ],
    blackStrengths: [
      `Précision globale de ${engineAnalysis.blackAccuracy}% et résistance défensive`,
      'Recherche de contre-jeu tactique',
    ],
    improvementAdvice: [
      'Vérifiez systématiquement les échecs, captures et menaces adverses avant chaque coup.',
      'Rejouez le moment clé sur l’échiquier en inspectant les lignes Multi-PV.',
      'Travaillez la transition entre l’ouverture et le milieu de jeu pour éviter les pièces non coordonnées.',
    ],
  };

  reviewCache.set(reviewKey, fallbackReview);
  return fallbackReview;
}
