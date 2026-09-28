// src/server/middleware/auth.ts
// Middleware d'authentification hybride : vérifie les ID Tokens Firebase Auth ET les JWT signés
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { adminAuth } from '../../lib/firebase-admin.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'chessmaster-pro-super-secret-jwt-key-2026';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  username?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function signAppJwt(payload: AuthenticatedUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAppJwt(token: string): AuthenticatedUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé : Jeton d’authentification manquant.' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Vérifier d'abord si c'est un JWT applicatif signé (connexion email/mot de passe)
  const localDecoded = verifyAppJwt(token);
  if (localDecoded && localDecoded.uid) {
    req.user = localDecoded;
    return next();
  }

  // 2. Sinon, vérifier le jeton via Firebase Admin Auth (connexion Google OAuth)
  try {
    const firebaseDecoded = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: firebaseDecoded.uid,
      email: firebaseDecoded.email || `${firebaseDecoded.uid}@chessmaster.pro`,
      username: firebaseDecoded.name,
    };
    return next();
  } catch (error) {
    console.error('Erreur de vérification du jeton Auth:', error);
    return res.status(401).json({ error: 'Non autorisé : Jeton invalide ou expiré.' });
  }
};
