import React from 'react'
import { ROOM_STATUS } from '../constants'

export default function StatsBar({ rooms, tasks }) {
  const counts = Object.keys(ROOM_STATUS).reduce((acc, key) => {
    acc[key] = rooms.filter(r => r.status === key).length
    return acc
  }, {})

  const taskCounts = {
    en_attente: tasks?.filter(t => t.status === 'en_attente').length || 0,
    en_cours:   tasks?.filter(t => t.status === 'en_cours').length || 0,
    urgentes:   tasks?.filter(t => t.priority === 'urgente' && t.status !== 'terminee').length || 0,
  }

  const occupancyRate = rooms.length ? Math.round((counts.occupe / rooms.length) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Main Stats Cards */}
        <div className="glass-card p-5 border-l-4 border-l-blue-500">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Occupation</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-white">{occupancyRate}%</span>
            <span className="text-xs font-bold text-blue-400 mb-1">{counts.occupe} / {rooms.length}</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${occupancyRate}%` }} />
          </div>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Libres</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-white">{counts.libre}</span>
            <span className="text-emerald-400 text-xl">✨</span>
          </div>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-amber-500">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">En Préparation</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-white">{counts.en_preparation}</span>
            <span className="text-amber-400 text-xl">🧹</span>
          </div>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-red-500">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tâches Urgentes</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-white">{taskCounts.urgentes}</span>
            <span className="text-red-400 text-xl">🚨</span>
          </div>
        </div>
      </div>

      {/* Mini status bar for other statuses */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ROOM_STATUS).map(([key, val]) => {
          if (['libre', 'occupe', 'en_preparation'].includes(key)) return null
          return (
            <div key={key} className="flex items-center gap-2 px-3 py-1.5 glass-card !rounded-full border-none bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: val.color }} />
              {val.label}: <span className="text-white">{counts[key]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
