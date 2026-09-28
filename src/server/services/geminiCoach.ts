// src/server/services/geminiCoach.ts
// Service Serveur d'Analyse et Commentaires Grand Maître avec Gemini API (@google/genai)
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

export async function generateMoveCommentary(params: {
  fen: string;
  pgn: string;
  lastMoveSan?: string;
  playerColor: 'w' | 'b';
  evaluationCp: number;
}): Promise<AiMoveCommentary> {
  const { fen, pgn, lastMoveSan, playerColor, evaluationCp } = params;
  const opening = detectOpeningEco(pgn, fen);
  const multiPv = computeMultiPvMoves(fen, 2000, 3);
  const bestLine = multiPv.topMoves.map((m) => `${m.san} (${m.evalCp >= 0 ? '+' : ''}${(m.evalCp / 100).toFixed(1)})`);

  const evalPawns = (evaluationCp / 100).toFixed(2);
  const chess = new Chess(fen);
  const turnText = chess.turn() === 'w' ? 'Blancs' : 'Noirs';

  if (process.env.GEMINI_API_KEY) {
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
        return {
          headline: parsed.headline || `Analyse : ${opening.name}`,
          moveQuality: parsed.moveQuality || 'Coup analysé par le Coach IA',
          positionalExplanation: parsed.positionalExplanation,
          tacticalAlert: parsed.tacticalAlert,
          recommendedPlan: parsed.recommendedPlan,
          bestEngineLine: bestLine,
          openingName: `${opening.eco} · ${opening.name}`,
        };
      }
    } catch (err) {
      console.warn('Gemini move commentary fallback:', err);
    }
  }

  // Fallback analytique déterministe basé sur le moteur tactique local
  const bestCandidate = multiPv.topMoves[0];
  const threatMove = multiPv.threatMove;
  const absEval = Math.abs(evaluationCp);
  const advantageSide =
    absEval < 40
      ? 'Position équilibrée'
      : evaluationCp > 0
        ? 'Avantage aux Blancs'
        : 'Avantage aux Noirs';

  return {
    headline: lastMoveSan
      ? `Après ${lastMoveSan} — ${advantageSide} (${Number(evalPawns) >= 0 ? '+' : ''}${evalPawns})`
      : `${opening.eco} · ${opening.name}`,
    moveQuality:
      absEval < 60
        ? 'Équilibre dynamique maintenu'
        : absEval < 180
          ? 'Pression positionnelle croissante'
          : 'Avantage décisif détecté',
    positionalExplanation: `Dans cette structure issue de ${opening.name}, le trait est aux ${turnText}. La coordination des pièces centrales et la sécurité du Roi déterminent la suite du combat.`,
    tacticalAlert: threatMove
      ? `Attention à la menace adverse potentielle ${threatMove.san} (${threatMove.from}→${threatMove.to}).`
      : chess.inCheck()
        ? 'Le Roi est actuellement en échec : vous devez parer la menace immédiatement.'
        : 'Aucune menace immédiate forcée, surveillez les pièces non défendues.',
    recommendedPlan: bestCandidate
      ? `Le moteur recommande ${bestCandidate.san} (${bestCandidate.from}→${bestCandidate.to}) pour optimiser l’activité de vos pièces.`
      : 'Consolidez votre roque et contestez les colonnes centrales.',
    bestEngineLine: bestLine,
    openingName: `${opening.eco} · ${opening.name}`,
  };
}

export async function generateFullGameReview(params: {
  pgn: string;
  playerColor: 'w' | 'b';
  result: string;
  reason: string;
}): Promise<AiFullGameReview> {
  const { pgn, playerColor, result, reason } = params;
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

  if (process.env.GEMINI_API_KEY && pgn.trim().length > 0) {
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
        return JSON.parse(rawText.trim()) as AiFullGameReview;
      }
    } catch (err) {
      console.warn('Gemini full review fallback:', err);
    }
  }

  return {
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
      'Rejouez le moment clé sur l’échiquier avec les flèches Multi-PV activées.',
      'Travaillez la transition entre l’ouverture et le milieu de jeu pour éviter les pièces non coordonnées.',
    ],
  };
}
