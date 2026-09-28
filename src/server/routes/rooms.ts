// src/server/routes/rooms.ts
// Routes de gestion des Salles multijoueur (Création publique/privée avec mot de passe, blocage si email non vérifié)
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createRoomRecord, getRoomByCode, getUserByUid, listActiveRooms } from '../../db/queries.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';

export const roomsRouter = Router();

// Parse un contrôle de temps ex: "3+2" -> { initialMs: 180000, incrementMs: 2000 }
export function parseTimeControl(tc: string): { initialMs: number; incrementMs: number } {
  if (tc === 'correspondence') {
    return { initialMs: 86400000, incrementMs: 0 };
  }
  const parts = tc.split('+');
  const minutes = Math.max(1, Number(parts[0]) || 10);
  const incSeconds = Math.max(0, Number(parts[1]) || 0);
  return {
    initialMs: minutes * 60 * 1000,
    incrementMs: incSeconds * 1000,
  };
}

roomsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const activeRooms = await listActiveRooms();
    const sanitized = activeRooms.map(({ passwordHash: _ph, ...r }) => ({
      ...r,
      hasPassword: Boolean(_ph),
    }));
    return res.json({ rooms: sanitized });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de lister les salles.' });
  }
});

roomsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const host = await getUserByUid(req.user.uid);
    if (!host) return res.status(404).json({ error: 'Profil hôte introuvable.' });

    // RÈGLE OBLIGATOIRE : Le jeu en ligne est BLOQUÉ tant que le compte n'est pas vérifié
    if (!host.emailVerified) {
      return res.status(403).json({
        error:
          'Votre adresse email n’est pas encore vérifiée. Veuillez valider votre code de vérification pour créer ou rejoindre une partie en ligne.',
      });
    }

    const {
      name = `Salle de ${host.username}`,
      timeControl = '3+2',
      category = 'blitz',
      isPrivate = false,
      password = '',
    } = req.body;

    const code = `ROOM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { initialMs, incrementMs } = parseTimeControl(String(timeControl));
    const passwordHash = password ? await bcrypt.hash(String(password), 10) : null;

    const hostElo =
      category === 'bullet'
        ? host.eloBullet
        : category === 'rapid'
          ? host.eloRapid
          : category === 'classical'
            ? host.eloClassical
            : host.eloBlitz;

    const room = await createRoomRecord({
      code,
      name: String(name).slice(0, 60),
      hostUid: host.uid,
      hostUsername: host.username,
      hostCountry: host.countryCode,
      hostElo,
      timeControl: String(timeControl),
      category: String(category),
      isPrivate: Boolean(isPrivate),
      passwordHash,
      whiteTimeMs: initialMs,
      blackTimeMs: initialMs,
      incrementMs,
    });

    const { passwordHash: _ph, ...safeRoom } = room;
    return res.status(201).json({ room: { ...safeRoom, hasPassword: Boolean(passwordHash) } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de créer la salle.' });
  }
});

roomsRouter.post('/:code/verify-password', async (req: Request, res: Response) => {
  try {
    const room = await getRoomByCode(String(req.params.code));
    if (!room) return res.status(404).json({ error: 'Salle introuvable.' });

    if (!room.passwordHash) {
      return res.json({ valid: true });
    }

    const { password = '' } = req.body;
    const valid = await bcrypt.compare(String(password), room.passwordHash);
    if (!valid) {
      return res.status(403).json({ valid: false, error: 'Mot de passe de la salle incorrect.' });
    }
    return res.json({ valid: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur de vérification.' });
  }
});
