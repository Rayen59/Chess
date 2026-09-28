// src/components/PlayerCard.tsx
// Barre de joueur unifiée (Adversaire ou Joueur local) : Avatar, Drapeau ISO, Titre FIDE, ELO Tabular-Nums et Horloge intégrée
import React from 'react';
import ReactCountryFlag from 'react-country-flag';
import { Cpu } from 'lucide-react';
import { Timer } from './Timer.tsx';
import botEmblemImg from '../assets/images/bot_stockfish_gm_1790540924614.jpg';

interface PlayerCardProps {
  username: string;
  countryCode: string;
  elo: number;
  avatarUrl?: string;
  isBot?: boolean;
  isActiveTurn?: boolean;
  isTurn?: boolean;
  timeMs?: number;
  initialTimeMs?: number;
  color?: 'w' | 'b';
  isThinking?: boolean;
  onClickProfile?: () => void;
}

export function getFideTitleFromElo(elo: number): string | null {
  if (elo >= 2500) return 'GM';
  if (elo >= 2400) return 'IM';
  if (elo >= 2300) return 'FM';
  if (elo >= 2200) return 'CM';
  if (elo >= 2000) return 'M';
  return null;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  username,
  countryCode,
  elo,
  isBot = false,
  isActiveTurn = false,
  isTurn = false,
  timeMs,
  initialTimeMs,
  color = 'w',
  isThinking = false,
  onClickProfile,
}) => {
  const fideTitle = getFideTitleFromElo(elo);
  const activeTurn = isActiveTurn || isTurn;

  return (
    <div
      className={`flex items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-4 py-2 rounded-xl border transition-colors ${
        activeTurn
          ? 'bg-[#262421] border-[#769656]'
          : 'bg-[#1D1B18] border-white/10'
      }`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* Avatar ou Emblème Stockfish avec indicateur de couleur des pièces */}
        <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-[#161512] border border-white/15 flex items-center justify-center shrink-0">
          {isBot ? (
            <img
              src={botEmblemImg}
              alt="Stockfish IA"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                color === 'w'
                  ? 'bg-[#EEEED2] text-[#161512]'
                  : 'bg-[#2C2A26] text-[#EEEED2]'
              }`}
            >
              {username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span
            className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border ${
              color === 'w'
                ? 'bg-[#EEEED2] border-[#161512]'
                : 'bg-[#161512] border-[#EEEED2]'
            }`}
            title={color === 'w' ? 'Pièces Blanches' : 'Pièces Noires'}
          />
        </div>

        {/* Informations joueur : Nom, Titre FIDE, Drapeau et ELO */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {fideTitle && (
              <span className="font-mono text-[11px] font-bold text-amber-400 shrink-0">
                {fideTitle}
              </span>
            )}
            <button
              type="button"
              onClick={onClickProfile}
              className="text-xs sm:text-sm font-semibold text-slate-100 hover:text-[#95BB4A] transition-colors truncate max-w-[135px] sm:max-w-[200px]"
            >
              {username}
            </button>
            {isBot ? (
              <Cpu className="w-3.5 h-3.5 text-[#769656] shrink-0" />
            ) : (
              <ReactCountryFlag
                countryCode={countryCode || 'FR'}
                svg
                title={countryCode}
                style={{ width: '1.1em', height: '0.85em', flexShrink: 0 }}
              />
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 font-mono tabular-nums mt-0.5 truncate">
            <span>{elo} ELO</span>
            <span aria-hidden="true">·</span>
            <span>{color === 'w' ? 'Blancs' : 'Noirs'}</span>
            {isThinking ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#95BB4A] font-semibold animate-pulse">
                  Réfléchit…
                </span>
              </>
            ) : activeTurn ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#769656] font-semibold">Au trait</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Horloge intégrée à droite */}
      {typeof timeMs === 'number' && typeof initialTimeMs === 'number' && (
        <Timer
          timeMs={timeMs}
          initialTimeMs={initialTimeMs}
          isActive={activeTurn}
        />
      )}
    </div>
  );
};
