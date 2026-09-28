// src/components/CountrySelector.tsx
// Sélecteur de pays ISO avec recherche instantanée et affichage des drapeaux via react-country-flag
import React, { useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { ChevronDown, Search } from 'lucide-react';
import { ISO_COUNTRIES, CountryOption } from '../lib/countries.ts';

interface CountrySelectorProps {
  selectedCode: string;
  onSelect: (country: CountryOption) => void;
  label?: string;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  selectedCode,
  onSelect,
  label = 'Pays représenté (Obligatoire FIDE)',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected =
    ISO_COUNTRIES.find((c) => c.code === selectedCode.toUpperCase()) || ISO_COUNTRIES[0];

  const filtered = ISO_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      {label && (
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#1B1A17] border border-white/10 rounded-lg text-sm text-slate-100 hover:border-[#769656] transition-colors"
      >
        <span className="flex items-center gap-2.5 truncate">
          <ReactCountryFlag
            countryCode={selected.code}
            svg
            aria-label={selected.name}
            title={selected.name}
          />
          <span className="font-medium">{selected.name}</span>
          <span className="text-xs text-slate-400 font-mono">({selected.code})</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-[#23211D] border border-white/15 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-white/10 flex items-center gap-2 bg-[#1B1A17]">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un pays ou code ISO (FR, MA, CA...)"
              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
            {filtered.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onSelect(country);
                  setOpen(false);
                  setSearch('');
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition-colors hover:bg-white/5 ${
                  country.code === selected.code ? 'bg-[#769656]/20 text-white font-semibold' : 'text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ReactCountryFlag countryCode={country.code} svg />
                  <span>{country.name}</span>
                </span>
                <span className="font-mono text-slate-400">{country.code}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-3 text-xs text-slate-400 text-center">Aucun pays trouvé.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
