// src/server/routes/friends.ts
// Routes Sociales : Amis (demandes, acceptation, blocage), Canaux de discussion par pays, Notifications & Signalements
import { Router, Request, Response } from 'express';
import {
  createFriendRequest,
  createMessageRecord,
  createModerationReport,
  createNotificationRecord,
  getChannelMessages,
  getUserByUid,
  getUserByUsername,
  getUserFriends,
  listUserNotifications,
  updateFriendStatus,
} from '../../db/queries.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';

export const friendsRouter = Router();

// 1. Récupérer les amis, demandes en attente et notifications du joueur
friendsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const friendsList = await getUserFriends(req.user.uid);
    const notifs = await listUserNotifications(req.user.uid);
    return res.json({ friends: friendsList, notifications: notifs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de charger les données sociales.' });
  }
});

// 2. Envoyer une demande d'ami par pseudo
friendsRouter.post('/request', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const { targetUsername } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: 'Veuillez indiquer le pseudo du joueur.' });
    }

    const sender = await getUserByUid(req.user.uid);
    const target = await getUserByUsername(String(targetUsername).trim());

    if (!sender || !target) {
      return res.status(404).json({ error: 'Joueur introuvable.' });
    }
    if (sender.uid === target.uid) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous ajouter vous-même.' });
    }

    const request = await createFriendRequest({
      requesterUid: sender.uid,
      requesterUsername: sender.username,
      requesterCountry: sender.countryCode,
      addresseeUid: target.uid,
      addresseeUsername: target.username,
      addresseeCountry: target.countryCode,
    });

    await createNotificationRecord({
      userUid: target.uid,
      type: 'FRIEND_REQUEST',
      title: 'Nouvelle demande d’ami',
      body: `${sender.username} (${sender.countryCode}) souhaite vous ajouter en ami.`,
    });

    return res.status(201).json({ friendRequest: request, message: `Demande envoyée à ${target.username}.` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur lors de l’envoi de la demande.' });
  }
});

// 3. Accepter ou Bloquer un ami
friendsRouter.post('/respond', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { friendshipId, status } = req.body; // 'ACCEPTED' | 'BLOCKED'
    if (!friendshipId || !['ACCEPTED', 'BLOCKED'].includes(status)) {
      return res.status(400).json({ error: 'Paramètres invalides.' });
    }
    const updated = await updateFriendStatus(Number(friendshipId), String(status));
    return res.json({ friendship: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de mettre à jour la relation.' });
  }
});

// 4. Messages d'un canal public (ex: 'global', 'country:FR', 'room:ARENA-01')
friendsRouter.get('/messages', async (req: Request, res: Response) => {
  try {
    const channel = String(req.query.channel || 'global');
    const msgs = await getChannelMessages(channel);
    return res.json({ messages: msgs.slice(-60) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de charger les messages.' });
  }
});

// 5. Poster un message dans un canal
friendsRouter.post('/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const sender = await getUserByUid(req.user.uid);
    if (!sender) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (sender.isMuted) {
      return res.status(403).json({ error: 'Votre compte est actuellement en sourdine (Mute).' });
    }

    const { channel = 'global', content = '', recipientUid = null } = req.body;
    const cleanContent = String(content).trim().slice(0, 400);
    if (!cleanContent) {
      return res.status(400).json({ error: 'Message vide.' });
    }

    const msg = await createMessageRecord({
      senderUid: sender.uid,
      senderUsername: sender.username,
      senderCountry: sender.countryCode,
      recipientUid: recipientUid ? String(recipientUid) : null,
      channel: String(channel),
      content: cleanContent,
    });

    return res.status(201).json({ message: msg });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible d’envoyer le message.' });
  }
});

// 6. Signaler un comportement suspect ou une triche
friendsRouter.post('/report', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const reporter = await getUserByUid(req.user.uid);
    if (!reporter) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const { reportedUsername, reason, gameId } = req.body;
    if (!reportedUsername || !reason) {
      return res.status(400).json({ error: 'Pseudo signalé et motif requis.' });
    }

    const target = await getUserByUsername(String(reportedUsername).trim());
    const report = await createModerationReport({
      reporterUid: reporter.uid,
      reporterUsername: reporter.username,
      reportedUid: target ? target.uid : 'unknown',
      reportedUsername: String(reportedUsername).trim(),
      reason: String(reason).slice(0, 400),
      gameId: gameId ? Number(gameId) : undefined,
    });

    return res.status(201).json({ report, message: 'Signalement transmis aux arbitres FIDE.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible d’envoyer le signalement.' });
  }
});
