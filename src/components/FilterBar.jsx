import React from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { ROOM_STATUS, ALL_FLOORS } from '../constants'

export default function FilterBar({ filters, onChange }) {
  const { search, status, floor, roomType } = filters

  function reset() {
    onChange({ search: '', status: 'all', floor: 'all', roomType: 'all' })
  }

  const isFiltered = search || status !== 'all' || floor !== 'all' || roomType !== 'all'

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal size={14} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtres</span>
        {isFiltered && (
          <button
            onClick={reset}
            className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            <X size={12} /> Réinitialiser
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Chercher chambre..."
            value={search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            className="input-field pl-9 py-2"
          />
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={e => onChange({ ...filters, status: e.target.value })}
          className="select-field flex-1 min-w-[140px]"
        >
          <option value="all">Tous statuts</option>
          {Object.entries(ROOM_STATUS).map(([key, val]) => (
            <option key={key} value={key}>{val.emoji} {val.label}</option>
          ))}
        </select>

        {/* Floor filter */}
        <select
          value={floor}
          onChange={e => onChange({ ...filters, floor: e.target.value })}
          className="select-field flex-1 min-w-[120px]"
        >
          <option value="all">Tous étages</option>
          {ALL_FLOORS.map(f => (
            <option key={f} value={f}>{f === 'Annexe' ? 'Annexe' : `Étage ${f}`}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={roomType}
          onChange={e => onChange({ ...filters, roomType: e.target.value })}
          className="select-field flex-1 min-w-[120px]"
        >
          <option value="all">Tous types</option>
          <option value="Standard">🛏️ Standard</option>
          <option value="Grand">🛏️✨ Grand</option>
          <option value="Appartement">🏠 Appartement</option>
        </select>
      </div>

      {/* Quick status buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(ROOM_STATUS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => onChange({ ...filters, status: status === key ? 'all' : key })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
              status === key
                ? 'bg-white/15 border-white/30 text-white scale-105'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>{val.emoji}</span>
            <span>{val.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
