import React from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle2, Clock, AlertCircle, XCircle, User } from 'lucide-react'
import { TASK_TYPE, TASK_STATUS } from '../constants'

const PRIORITY_BADGE = {
  normale:  'bg-slate-700/50 text-slate-300 border-slate-600/40',
  urgente:  'bg-red-500/20 text-red-300 border-red-500/40',
}

const STATUS_ICONS = {
  en_attente: <Clock size={14} className="text-yellow-400" />,
  en_cours:   <AlertCircle size={14} className="text-blue-400" />,
  terminee:   <CheckCircle2 size={14} className="text-emerald-400" />,
  annulee:    <XCircle size={14} className="text-slate-500" />,
}

export default function TaskCard({ task, onUpdate }) {
  const type     = TASK_TYPE[task.task_type] || TASK_TYPE.reception
  const status   = TASK_STATUS[task.status]  || TASK_STATUS.en_attente

  return (
    <div className={`glass-card p-4 border space-y-3 ${task.priority === 'urgente' ? 'ring-1 ring-red-500/30' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base">{type.icon}</span>
          <p className="font-semibold text-white text-sm truncate">{task.title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {STATUS_ICONS[task.status]}
        </div>
      </div>

      {/* Type + priority badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`status-badge border text-[10px] ${
          task.task_type === 'menage'     ? 'task-menage' :
          task.task_type === 'reparation' ? 'task-reparation' :
          'task-reception'
        }`}>
          {type.label}
        </span>
        <span className={`status-badge border text-[10px] ${PRIORITY_BADGE[task.priority]}`}>
          {task.priority === 'urgente' ? '🚨 Urgent' : 'Normale'}
        </span>
        <span className={`status-badge border text-[10px] ${status.badge}`}>
          {status.label}
        </span>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
      )}

      {/* Room + assignee */}
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          {task.rooms?.number && (
            <span className="px-1.5 py-0.5 bg-slate-700/60 rounded-md font-mono">
              🛏 {task.rooms.number}
            </span>
          )}
        </div>
        {task.assigned_profile?.full_name && (
          <div className="flex items-center gap-1">
            <User size={10} />
            <span className="truncate max-w-[100px]">{task.assigned_profile.full_name}</span>
          </div>
        )}
      </div>

      {/* Date */}
      <div className="text-[10px] text-slate-600">
        Créée le {format(new Date(task.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
      </div>

      {/* Action buttons */}
      {onUpdate && task.status !== 'terminee' && task.status !== 'annulee' && (
        <div className="flex gap-2 pt-1">
          {task.status === 'en_attente' && (
            <button
              onClick={() => onUpdate(task.id, 'en_cours')}
              className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
            >
              Démarrer
            </button>
          )}
          {task.status === 'en_cours' && (
            <button
              onClick={() => onUpdate(task.id, 'terminee')}
              className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              ✓ Terminer
            </button>
          )}
          <button
            onClick={() => onUpdate(task.id, 'annulee')}
            className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:bg-slate-600/50 transition-colors"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}
