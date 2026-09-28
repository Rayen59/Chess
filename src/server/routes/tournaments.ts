// src/server/routes/tournaments.ts
// Routes Tournois : Arena, Système Suisse, Round-Robin et Élimination Directe (Création & Inscription auto par ELO)
import { Router, Request, Response } from 'express';
import {
  createTournamentRecord,
  getUserByUid,
  listTournaments,
  updateTournamentRecord,
} from '../../db/queries.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';

export const tournamentsRouter = Router();

export interface TournamentParticipant {
  uid: string;
  username: string;
  country: string;
  elo: number;
  score: number;
  streak: number;
}

tournamentsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await listTournaments();
    const formatted = list.map((t) => ({
      ...t,
      participants: JSON.parse(t.participantsJson || '[]') as TournamentParticipant[],
      pairings: JSON.parse(t.pairingsJson || '[]'),
    }));
    return res.json({ tournaments: formatted });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de charger les tournois.' });
  }
});

// Créer un tournoi (minimum 4 joueurs requis)
tournamentsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const creator = await getUserByUid(req.user.uid);
    if (!creator) return res.status(404).json({ error: 'Créateur introuvable.' });

    if (!creator.emailVerified) {
      return res.status(403).json({
        error: 'Vous devez vérifier votre adresse email avant de créer un tournoi officiel.',
      });
    }

    const {
      name,
      format = 'ARENA',
      category = 'blitz',
      timeControl = '3+2',
      minElo = 800,
      maxElo = 2800,
      maxPlayers = 16,
    } = req.body;

    if (!name || String(name).trim().length < 4) {
      return res.status(400).json({ error: 'Le nom du tournoi doit comporter au moins 4 caractères.' });
    }

    if (Number(maxPlayers) < 4) {
      return res.status(400).json({ error: 'Un tournoi nécessite au minimum 4 joueurs.' });
    }

    const initialParticipant: TournamentParticipant = {
      uid: creator.uid,
      username: creator.username,
      country: creator.countryCode,
      elo: creator.eloBlitz,
      score: 0,
      streak: 0,
    };

    const created = await createTournamentRecord({
      name: String(name).trim().slice(0, 80),
      format: String(format),
      category: String(category),
      timeControl: String(timeControl),
      minElo: Number(minElo),
      maxElo: Number(maxElo),
      maxPlayers: Math.max(4, Number(maxPlayers)),
      creatorUid: creator.uid,
      creatorUsername: creator.username,
      participantsJson: JSON.stringify([initialParticipant]),
      pairingsJson: JSON.stringify([]),
    });

    return res.status(201).json({
      tournament: {
        ...created,
        participants: [initialParticipant],
        pairings: [],
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de créer le tournoi.' });
  }
});

// Inscription automatique par ELO et génération des appariements (brackets) en direct
tournamentsRouter.post('/:id/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const player = await getUserByUid(req.user.uid);
    if (!player) return res.status(404).json({ error: 'Joueur introuvable.' });

    if (!player.emailVerified) {
      return res.status(403).json({
        error: 'Compte non vérifié : veuillez confirmer votre email pour rejoindre un tournoi.',
      });
    }

    const tournamentId = Number(req.params.id);
    const all = await listTournaments();
    const tournament = all.find((t) => t.id === tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournoi introuvable.' });
    }

    const participants: TournamentParticipant[] = JSON.parse(tournament.participantsJson || '[]');
    if (participants.some((p) => p.uid === player.uid)) {
      return res.status(400).json({ error: 'Vous êtes déjà inscrit à ce tournoi.' });
    }

    if (participants.length >= tournament.maxPlayers) {
      return res.status(400).json({ error: 'Ce tournoi est complet.' });
    }

    const playerElo =
      tournament.category === 'bullet'
        ? player.eloBullet
        : tournament.category === 'rapid'
          ? player.eloRapid
          : tournament.category === 'classical'
            ? player.eloClassical
            : player.eloBlitz;

    if (playerElo < tournament.minElo || playerElo > tournament.maxElo) {
      return res.status(403).json({
        error: `Votre ELO (${playerElo}) doit être compris entre ${tournament.minElo} et ${tournament.maxElo} pour ce tournoi.`,
      });
    }

    participants.push({
      uid: player.uid,
      username: player.username,
      country: player.countryCode,
      elo: playerElo,
      score: 0,
      streak: 0,
    });

    // Tri par ELO décroissant et génération automatique des appariements (Pairings / Brackets)
    participants.sort((a, b) => b.elo - a.elo);
    const pairings = [];
    for (let i = 0; i < participants.length - 1; i += 2) {
      pairings.push({
        round: 1,
        white: participants[i].username,
        black: participants[i + 1].username,
        result: 'En cours',
      });
    }

    const updated = await updateTournamentRecord(tournament.id, {
      participantsJson: JSON.stringify(participants),
      pairingsJson: JSON.stringify(pairings),
    });

    return res.json({
      tournament: {
        ...updated,
        participants,
        pairings,
      },
      message: 'Inscription au tournoi confirmée !',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de rejoindre le tournoi.' });
  }
});
