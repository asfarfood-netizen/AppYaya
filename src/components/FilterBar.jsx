import React from 'react'
import { Search, SlidersHorizontal, X, Filter, Layers } from 'lucide-react'
import { ROOM_STATUS, ALL_FLOORS } from '../constants'

export default function FilterBar({ filters, onChange }) {
  const { search, status, floor, roomType } = filters

  function reset() {
    onChange({ search: '', status: 'all', floor: 'all', roomType: 'all' })
  }

  const isFiltered = search || status !== 'all' || floor !== 'all' || roomType !== 'all'

  return (
    <div className="glass-card p-2 rounded-2xl border-white/[0.05] flex flex-col md:flex-row gap-3">
      {/* Search Field */}
      <div className="relative flex-1 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
        <input
          type="text"
          placeholder="Rechercher une chambre ou une note..."
          value={search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          className="w-full bg-[#161b22] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition-all"
        />
        {search && (
          <button onClick={() => onChange({ ...filters, search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {/* Status Dropdown */}
        <div className="relative flex-1 md:w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <select
            value={status}
            onChange={e => onChange({ ...filters, status: e.target.value })}
            className="select-field pl-9 !py-3.5 !text-xs font-bold uppercase tracking-wider"
          >
            <option value="all">Tous les Statuts</option>
            {Object.entries(ROOM_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Floor Dropdown */}
        <div className="relative flex-1 md:w-40">
          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <select
            value={floor}
            onChange={e => onChange({ ...filters, floor: e.target.value })}
            className="select-field pl-9 !py-3.5 !text-xs font-bold uppercase tracking-wider"
          >
            <option value="all">Tous les Étages</option>
            {ALL_FLOORS.map(f => (
              <option key={f} value={f}>{f === 'Annexe' ? 'Annexe' : `Étage ${f}`}</option>
            ))}
          </select>
        </div>

        {/* Reset Button (only shown when filtered) */}
        {isFiltered && (
          <button
            onClick={reset}
            className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
            title="Réinitialiser les filtres"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
