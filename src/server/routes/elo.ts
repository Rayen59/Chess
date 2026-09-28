// src/server/routes/elo.ts
// Routes Classements (Leaderboards) : Mondial, par Pays ISO, par Amis et Badges FIDE
import { Router, Request, Response } from 'express';
import { getLeaderboardUsers, getUserFriends } from '../../db/queries.ts';
import { getFideBadge } from '../services/elo.ts';

export const eloRouter = Router();

eloRouter.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const category = String(req.query.category || 'blitz');
    const country = req.query.country ? String(req.query.country) : 'ALL';
    const scope = String(req.query.scope || 'global'); // 'global' | 'country' | 'friends'
    const userUid = req.query.userUid ? String(req.query.userUid) : '';

    let usersList = await getLeaderboardUsers(scope === 'country' ? country : 'ALL');

    if (scope === 'friends' && userUid) {
      const friendships = await getUserFriends(userUid);
      const friendUids = new Set<string>([userUid]);
      friendships.forEach((f) => {
        if (f.status === 'ACCEPTED') {
          friendUids.add(f.requesterUid);
          friendUids.add(f.addresseeUid);
        }
      });
      usersList = usersList.filter((u) => friendUids.has(u.uid));
    }

    const enriched = usersList
      .map((u) => {
        const activeElo =
          category === 'bullet'
            ? u.eloBullet
            : category === 'rapid'
              ? u.eloRapid
              : category === 'classical'
                ? u.eloClassical
                : u.eloBlitz;

        const badge = getFideBadge(activeElo);
        return {
          uid: u.uid,
          username: u.username,
          countryCode: u.countryCode,
          countryName: u.countryName,
          avatarUrl: u.avatarUrl,
          eloBullet: u.eloBullet,
          eloBlitz: u.eloBlitz,
          eloRapid: u.eloRapid,
          eloClassical: u.eloClassical,
          activeElo,
          gamesPlayed: u.gamesPlayed,
          wins: u.wins,
          losses: u.losses,
          draws: u.draws,
          puzzleRating: u.puzzleRating,
          badge,
        };
      })
      .sort((a, b) => b.activeElo - a.activeElo);

    return res.json({ leaderboard: enriched });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de charger le classement.' });
  }
});
