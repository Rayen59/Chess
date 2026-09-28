// src/server/middleware/rateLimit.ts
// Middleware de limitation de débit (Rate Limiting) en mémoire pour protéger l'API contre les abus
import { Request, Response, NextFunction } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

export function createRateLimiter(maxRequests = 120, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl}`;
    const now = Date.now();

    const current = buckets.get(key);
    if (!current || now > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({
        error: 'Trop de requêtes. Veuillez patienter quelques secondes avant de réessayer.',
      });
    }

    current.count += 1;
    return next();
  };
}
