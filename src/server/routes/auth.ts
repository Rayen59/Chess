// src/server/routes/auth.ts
// Routes d'authentification : Inscription (Zod + Pays ISO + Pseudo unique), Vérification Email, Connexion JWT & OAuth Google
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  getUserByEmail,
  getUserByUid,
  getUserByUsername,
  updateUserProfile,
  upsertUser,
} from '../../db/queries.ts';
import { AuthRequest, requireAuth, signAppJwt } from '../middleware/auth.ts';
import { sendVerificationEmail } from '../services/email.ts';

export const authRouter = Router();

// Schéma de validation forte Zod pour l'inscription
const registerSchema = z.object({
  email: z.string().email('Adresse email invalide.'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),
  username: z
    .string()
    .min(3, 'Le pseudo doit contenir au moins 3 caractères.')
    .max(20, 'Le pseudo ne doit pas dépasser 20 caractères.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Caractères autorisés : lettres, chiffres, tirets et underscores.'),
  countryCode: z.string().length(2, 'Le code pays ISO à 2 lettres est obligatoire.'),
  countryName: z.string().min(2, 'Le nom du pays est obligatoire.'),
  estimatedLevel: z.string().default('Intermédiaire (1200)'),
  avatarUrl: z.string().optional(),
});

const LEVEL_TO_ELO: Record<string, number> = {
  'Débutant (800)': 800,
  'Intermédiaire (1200)': 1200,
  'Avancé (1600)': 1600,
  'Expert (2000+)': 2000,
};

// 1. Vérification en temps réel de la disponibilité du pseudo
authRouter.get('/check-username', async (req: Request, res: Response) => {
  try {
    const username = String(req.query.username || '').trim();
    if (username.length < 3) {
      return res.json({ available: false, reason: 'Minimum 3 caractères requis.' });
    }
    const existing = await getUserByUsername(username);
    return res.json({
      available: !existing,
      reason: existing ? 'Ce pseudo est déjà utilisé par un joueur.' : 'Pseudo disponible !',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur lors de la vérification.' });
  }
});

// 2. Inscription complète avec choix du pays obligatoire et envoi du code de vérification Email
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Données invalides.';
      return res.status(400).json({ error: firstIssue });
    }

    const { email, password, username, countryCode, countryName, estimatedLevel, avatarUrl } =
      parsed.data;

    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse email.' });
    }

    const existingUsername = await getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris. Choisissez-en un autre.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const uid = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const initialElo = LEVEL_TO_ELO[estimatedLevel] || 1200;

    const user = await upsertUser({
      uid,
      email,
      username,
      passwordHash,
      countryCode: countryCode.toUpperCase(),
      countryName,
      avatarUrl: avatarUrl || '',
      estimatedLevel,
      emailVerified: false,
      verificationCode,
      initialElo,
    });

    const emailResult = await sendVerificationEmail(email, username, verificationCode);
    const token = signAppJwt({ uid: user.uid, email: user.email, username: user.username });

    const { passwordHash: _ph, ...safeUser } = user;
    return res.status(201).json({
      token,
      user: safeUser,
      verificationPreviewCode: emailResult.previewCode,
      message: 'Compte créé. Veuillez saisir le code de vérification pour débloquer le jeu en ligne.',
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({ error: error.message || 'Erreur lors de l’inscription.' });
  }
});

// 3. Connexion Email + Mot de passe
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = await getUserByEmail(String(email));
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    if (user.isBanned) {
      return res
        .status(403)
        .json({ error: 'Ce compte a été suspendu par la modération FIDE Fair-Play.' });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const token = signAppJwt({ uid: user.uid, email: user.email, username: user.username });
    const { passwordHash: _ph, ...safeUser } = user;

    return res.json({
      token,
      user: safeUser,
      verificationPreviewCode: user.verificationCode,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message || 'Erreur lors de la connexion.' });
  }
});

// 4. Synchronisation Google OAuth (Firebase Auth) avec PostgreSQL
authRouter.post('/oauth-sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié.' });
    }

    const existing = await getUserByUid(req.user.uid);
    if (existing) {
      const { passwordHash: _ph, ...safeUser } = existing;
      return res.json({ user: safeUser, token: signAppJwt({ uid: existing.uid, email: existing.email, username: existing.username }) });
    }

    const { countryCode = 'FR', countryName = 'France', estimatedLevel = 'Intermédiaire (1200)', username } = req.body;
    const baseName = (username || req.user.username || req.user.email.split('@')[0] || 'Joueur')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 15);
    const uniqueUsername = `${baseName}_${Math.floor(100 + Math.random() * 899)}`;
    const initialElo = LEVEL_TO_ELO[estimatedLevel] || 1200;

    const created = await upsertUser({
      uid: req.user.uid,
      email: req.user.email,
      username: uniqueUsername,
      countryCode: String(countryCode).toUpperCase(),
      countryName: String(countryName),
      estimatedLevel: String(estimatedLevel),
      emailVerified: true, // Compte Google déjà vérifié par OAuth
      initialElo,
    });

    const { passwordHash: _ph, ...safeUser } = created;
    return res.json({
      user: safeUser,
      token: signAppJwt({ uid: created.uid, email: created.email, username: created.username }),
    });
  } catch (error: any) {
    console.error('OAuth sync error:', error);
    return res.status(500).json({ error: error.message || 'Erreur de synchronisation OAuth.' });
  }
});

// 5. Vérification du code Email obligatoire pour débloquer le jeu en ligne
authRouter.post('/verify-email', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non autorisé.' });
    }

    const { code } = req.body;
    const user = await getUserByUid(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (user.emailVerified) {
      const { passwordHash: _ph, ...safeUser } = user;
      return res.json({ user: safeUser, message: 'Votre compte est déjà vérifié.' });
    }

    if (!code || String(code).trim() !== String(user.verificationCode).trim()) {
      return res.status(400).json({ error: 'Code de vérification invalide.' });
    }

    const updated = await updateUserProfile(user.uid, {
      emailVerified: true,
      verificationCode: null,
    });

    if (!updated) {
      return res.status(500).json({ error: 'Erreur lors de la validation.' });
    }

    const { passwordHash: _ph, ...safeUser } = updated;
    return res.json({
      user: safeUser,
      message: 'Adresse email vérifiée avec succès ! Le jeu en ligne est désormais débloqué.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erreur lors de la vérification email.' });
  }
});

// 6. Renvoyer un nouveau code de vérification
authRouter.post('/resend-verification', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const user = await getUserByUid(req.user.uid);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    await updateUserProfile(user.uid, { verificationCode: newCode });
    const emailRes = await sendVerificationEmail(user.email, user.username, newCode);

    return res.json({
      message: 'Un nouveau code de vérification a été généré.',
      verificationPreviewCode: emailRes.previewCode,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de renvoyer le code.' });
  }
});

// 7. Profil courant (/api/auth/me)
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non autorisé.' });
    const user = await getUserByUid(req.user.uid);
    if (!user) return res.status(404).json({ error: 'Profil non trouvé.' });

    const { passwordHash: _ph, ...safeUser } = user;
    return res.json({
      user: safeUser,
      verificationPreviewCode: user.verificationCode,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Impossible de charger le profil.' });
  }
});
