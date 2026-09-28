// src/server/routes/users.ts
// Routes Utilisateurs, Profils, Historique ELO et Administration (Modération, Bannissement, Reset ELO)
import { Router, Request, Response } from 'express';
import {
  getEloHistoryByUid,
  getLeaderboardUsers,
  getUserByUid,
  listModerationReports,
  listRecentGames,
  updateModerationReportStatus,
  updateUserProfile,
} from '../../db/queries.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getFideBadge } from '../services/elo.ts';

export const usersRouter = Router();

// 1. Obtenir le profil complet d'un joueur + statistiques + historique ELO + parties récentes
usersRouter.get('/profile/:uid', async (req: Request, res: Response) => {
  try {
    const uid = String(req.params.uid);
    const user = await getUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }

    const history = await getEloHistoryByUid(uid);
    const recentGames = await listRecentGames(uid);
    const badge = getFideBadge(Math.max(user.eloBlitz, user.eloRapid, user.eloBullet, user.eloClassical));

    const { passwordHash: _ph, verificationCode: _vc, ...safeUser } = user;
    return res.json({
      user: safeUser,
      badge,
      eloHistory: history,
      recentGames: recentGames.slice(0, 20),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur lors du chargement du profil.' });
  }
});

// 2. Mettre à jour son propre profil (bio, pays, avatar)
usersRouter.put('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const { bio, countryCode, countryName, avatarUrl } = req.body;

    const updated = await updateUserProfile(req.user.uid, {
      ...(bio !== undefined ? { bio: String(bio).slice(0, 300) } : {}),
      ...(countryCode ? { countryCode: String(countryCode).toUpperCase().slice(0, 2) } : {}),
      ...(countryName ? { countryName: String(countryName).slice(0, 60) } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl: String(avatarUrl) } : {}),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Profil introuvable.' });
    }

    const { passwordHash: _ph, ...safeUser } = updated;
    return res.json({ user: safeUser, message: 'Profil mis à jour avec succès.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de modifier le profil.' });
  }
});

// 3. Vue d'ensemble Administration (Joueurs, Parties, Signalements, Logs anti-triche)
usersRouter.get('/admin/overview', async (_req: Request, res: Response) => {
  try {
    const allUsers = await getLeaderboardUsers();
    const allGames = await listRecentGames();
    const reports = await listModerationReports();

    const sanitizedUsers = allUsers.map(({ passwordHash: _ph, verificationCode: _vc, ...u }) => u);
    const suspiciousGames = allGames.filter((g) => g.suspiciousFlag);

    return res.json({
      users: sanitizedUsers,
      recentGames: allGames.slice(0, 25),
      reports,
      suspiciousGames,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur lors du chargement Admin.' });
  }
});

// 4. Actions d'administration (Bannir, Mute, Reset ELO, Traiter un signalement)
usersRouter.post('/admin/action', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUid, action, reportId } = req.body;

    if (action === 'RESOLVE_REPORT' && reportId) {
      const updatedReport = await updateModerationReportStatus(Number(reportId), 'RESOLVED');
      return res.json({ report: updatedReport, message: 'Signalement marqué comme résolu.' });
    }

    if (!targetUid) {
      return res.status(400).json({ error: 'Identifiant du joueur cible requis.' });
    }

    const target = await getUserByUid(String(targetUid));
    if (!target) {
      return res.status(404).json({ error: 'Joueur cible introuvable.' });
    }

    if (action === 'TOGGLE_BAN') {
      const updated = await updateUserProfile(target.uid, { isBanned: !target.isBanned });
      return res.json({
        user: updated,
        message: updated?.isBanned ? 'Joueur suspendu.' : 'Suspension levée.',
      });
    }

    if (action === 'TOGGLE_MUTE') {
      const updated = await updateUserProfile(target.uid, { isMuted: !target.isMuted });
      return res.json({
        user: updated,
        message: updated?.isMuted ? 'Joueur mis en sourdine (Mute).' : 'Sourdine levée.',
      });
    }

    if (action === 'RESET_ELO') {
      const updated = await updateUserProfile(target.uid, {
        eloBullet: 1200,
        eloBlitz: 1200,
        eloRapid: 1200,
        eloClassical: 1200,
      });
      return res.json({
        user: updated,
        message: 'Classements ELO réinitialisés à 1200.',
      });
    }

    return res.status(400).json({ error: 'Action administrative non reconnue.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur lors de l’action Admin.' });
  }
});
