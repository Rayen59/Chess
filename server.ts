// server.ts
// Serveur Full-Stack ChessMaster Pro : Express API + Socket.io Temps Réel + Vite Middleware (Port 3000)
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { createRateLimiter } from './src/server/middleware/rateLimit.ts';
import { authRouter } from './src/server/routes/auth.ts';
import { usersRouter } from './src/server/routes/users.ts';
import { gamesRouter } from './src/server/routes/games.ts';
import { eloRouter } from './src/server/routes/elo.ts';
import { roomsRouter } from './src/server/routes/rooms.ts';
import { friendsRouter } from './src/server/routes/friends.ts';
import { tournamentsRouter } from './src/server/routes/tournaments.ts';

import { registerRoomHandlers } from './src/server/socket/roomHandler.ts';
import { registerGameHandlers } from './src/server/socket/gameHandler.ts';
import { registerMatchmakingHandlers } from './src/server/socket/matchmaking.ts';
import { registerChatHandlers } from './src/server/socket/chatHandler.ts';
import { matchmakingQueue } from './src/server/socket/state.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Configuration de Socket.io sur le même serveur HTTP (Port 3000)
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createRateLimiter(300, 60_000));

  // Montage des routes REST API
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/elo', eloRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/tournaments', tournamentsRouter);

  // Gestion des connexions temps réel Socket.io
  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerMatchmakingHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      const idx = matchmakingQueue.findIndex((q) => q.socketId === socket.id);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
      }
    });
  });

  // Intégration Vite (Développement) ou Fichiers Statiques (Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ChessMaster Pro Server (HTTP + Socket.io) listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
