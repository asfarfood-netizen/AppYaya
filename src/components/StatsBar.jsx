import React from 'react'
import { ROOM_STATUS, TASK_TYPE } from '../constants'

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

  return (
    <div className="space-y-3">
      {/* Room stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {Object.entries(ROOM_STATUS).map(([key, val]) => (
          <div
            key={key}
            className="glass-card p-3 text-center hover:scale-105 transition-transform duration-200"
            style={{ borderColor: val.color + '30' }}
          >
            <div className="text-xl font-extrabold text-white" style={{ color: val.color }}>
              {counts[key]}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{val.label}</div>
          </div>
        ))}
      </div>

      {/* Task stats */}
      {tasks && (
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-sm">⏳</div>
            <div>
              <div className="text-lg font-bold text-yellow-400">{taskCounts.en_attente}</div>
              <div className="text-[10px] text-slate-400">En attente</div>
            </div>
          </div>
          <div className="glass-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">🔄</div>
            <div>
              <div className="text-lg font-bold text-blue-400">{taskCounts.en_cours}</div>
              <div className="text-[10px] text-slate-400">En cours</div>
            </div>
          </div>
          <div className="glass-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-sm">🚨</div>
            <div>
              <div className="text-lg font-bold text-red-400">{taskCounts.urgentes}</div>
              <div className="text-[10px] text-slate-400">Urgentes</div>
            </div>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">
          Total : <strong className="text-slate-300">{rooms.length}</strong> chambre{rooms.length > 1 ? 's' : ''}
        </span>
        <span className="text-xs text-slate-500">
          Occupation : <strong className="text-blue-400">
            {rooms.length ? Math.round((counts.occupe / rooms.length) * 100) : 0}%
          </strong>
        </span>
      </div>
    </div>
  )
}
