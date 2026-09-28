# ChessMaster Pro ♟️

Plateforme web complète d'échecs en ligne en temps réel inspirée de Chess.com et Lichess, dotée d'un classement **ELO FIDE adaptatif**, d'un moteur **Stockfish IA (5 niveaux)**, d'un serveur **Socket.io anti-triche** avec validation `chess.js` côté serveur, d'une base relationnelle **PostgreSQL** et de **tournois Arena/Suisse**.

---

## 🏗️ Architecture du Projet

```text
chessmaster-pro/
├── server.ts                         # Point d'entrée Full-Stack (Express + Socket.io + Vite sur Port 3000)
├── docker-compose.yml                # Orchestration PostgreSQL 16 + Redis 7 + App Full-Stack
├── server/prisma/schema.prisma       # Schéma relationnel Prisma de référence
├── src/
│   ├── db/
│   │   ├── schema.ts                 # Tables PostgreSQL (Users, EloHistory, Rooms, Games, Moves, Friends, Messages, Tournaments, Puzzles, Notifications, ModerationReports)
│   │   ├── drizzle.config.ts         # Configuration des migrations Drizzle Kit
│   │   ├── index.ts                  # Pool de connexion PostgreSQL (Object Method)
│   │   └── queries.ts                # Couche Repository typée avec gestion d'erreur à 2 niveaux
│   ├── server/
│   │   ├── middleware/
│   │   │   ├── auth.ts               # Vérification hybride JWT + Firebase Admin Auth
│   │   │   └── rateLimit.ts          # Protection anti-brute-force par IP
│   │   ├── services/
│   │   │   ├── elo.ts                # Calcul ELO FIDE (K-factor 40/20/10) + Badges GM/IM/FM/CM/M
│   │   │   ├── stockfish.ts          # Évaluation centipions, recherche Alpha-Beta & analyse post-partie
│   │   │   └── email.ts              # Envoi du code de vérification à 6 chiffres via Nodemailer
│   │   ├── routes/
│   │   │   ├── auth.ts               # Inscription (Zod + Pays obligatoire), Login, OAuth Google, Vérification Email
│   │   │   ├── users.ts              # Profils, Historique ELO et Console Admin (Ban/Mute/Reset ELO)
│   │   │   ├── games.ts              # Parties, Moteur Stockfish, Analyse Post-Partie & Puzzles
│   │   │   ├── elo.ts                # Leaderboards (Mondial, Par Pays ISO, Par Amis)
│   │   │   ├── rooms.ts              # Salles publiques/privées avec mot de passe (bloqué si email non vérifié)
│   │   │   ├── friends.ts            # Demandes d'amis, Canaux par pays, Notifications & Signalements
│   │   │   └── tournaments.ts        # Tournois Arena, Suisse, Round-Robin & Élimination (min. 4 joueurs)
│   │   └── socket/
│   │       ├── state.ts              # État serveur autoritatif & file de matchmaking ELO
│   │       ├── roomHandler.ts        # room:create, room:join, room:leave & spectateurs
│   │       ├── gameHandler.ts        # game:move (validation chess.js serveur), game:resign, game:offerDraw
│   │       ├── matchmaking.ts        # matchmaking:join (±100 à ±300 ELO)
│   │       └── chatHandler.ts        # chat:message modéré & défis directs entre amis
│   ├── components/
│   │   ├── ChessBoard.tsx            # Échiquier interactif, flèches clic droit, promotion pion, barre d'éval
│   │   ├── Timer.tsx                 # Horloges animées avec incrément Fischer & alerte < 20s
│   │   ├── MoveList.tsx              # Notation PGN en direct avec navigation (|<< < > >>|)
│   │   ├── Chat.tsx                  # Chat temps réel par salle, mondial ou par pays
│   │   ├── PlayerCard.tsx            # Carte joueur avec badge FIDE et drapeau ISO
│   │   └── CountrySelector.tsx       # Sélecteur de pays ISO avec recherche et drapeaux SVG
│   ├── pages/
│   │   ├── Lobby.tsx                 # Salon principal, cadences Bullet/Blitz/Rapid/Classique/Custom
│   │   ├── Game.tsx                  # Arène de jeu en direct + rapport d'analyse post-partie
│   │   ├── Puzzles.tsx               # Puzzle quotidien + Mode Survivre en série
│   │   ├── Tournaments.tsx           # Tournois Arena/Suisse/Round-Robin/Élimination & Brackets
│   │   ├── Leaderboard.tsx           # Classement mondial, par pays et par amis
│   │   ├── Profile.tsx               # Profil joueur + Graphique de progression ELO (Recharts)
│   │   ├── SocialAndAdmin.tsx        # Amis, Canaux publics & Console d'administration Fair-Play
│   │   ├── Login.tsx                 # Connexion JWT + OAuth Google
│   │   └── Register.tsx              # Inscription + Sélection obligatoire du pays + Vérification Email
│   └── __tests__/
│       └── elo.test.ts               # Tests unitaires Vitest (Calcul ELO FIDE & Moteur Stockfish)
```

---

## 🚀 Installation & Démarrage Pas à Pas

1. **Installer les dépendances** :
   ```bash
   npm install
   ```

2. **Configurer les variables d'environnement** :
   Copiez `.env.example` vers `.env` et renseignez les paramètres PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`) ainsi que `JWT_SECRET`.

3. **Démarrer le serveur de développement Full-Stack (Port 3000)** :
   ```bash
   npm run dev
   ```

4. **Exécuter les tests unitaires** :
   ```bash
   npm run test
   ```

5. **Déploiement Docker** :
   ```bash
   docker-compose up -d --build
   ```
