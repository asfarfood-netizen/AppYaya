import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ScrollText, RefreshCw, Search } from 'lucide-react'
import { ROOM_STATUS, ROLE_LABELS } from '../constants'

const ACTION_LABELS = {
  status_change: 'Changement de statut',
  task_created:  'Tâche créée',
  user_created:  'Compte créé',
}

export default function LogsPage() {
  const [logs, setLogs]     = useState([])
  const [users, setUsers]   = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setLogs(data)

    const { data: profiles } = await supabase.from('profiles').select('id,full_name,role')
    if (profiles) {
      const map = {}
      profiles.forEach(p => { map[p.id] = p })
      setUsers(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLogs()
    const sub = supabase
      .channel('logs-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => fetchLogs())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [fetchLogs])

  const filtered = logs.filter(l => {
    if (!search) return true
    const u = users[l.user_id]
    const s = search.toLowerCase()
    return (
      u?.full_name?.toLowerCase().includes(s) ||
      l.action?.toLowerCase().includes(s) ||
      JSON.stringify(l.new_value || '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Historique</h1>
          <p className="text-slate-400 text-sm mt-0.5">{logs.length} entrées enregistrées</p>
        </div>
        <button onClick={fetchLogs} className="p-2 glass-card hover:bg-white/10 rounded-xl transition-colors">
          <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Chercher par utilisateur, action, chambre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
          <ScrollText size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Journal des activités</span>
          <span className="ml-auto text-xs text-slate-500">{filtered.length} résultats</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mr-2" />
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <span className="text-3xl mb-2">📋</span>
            <p className="text-sm">Aucun log trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {filtered.map(log => {
              const u = users[log.user_id]
              const roleInfo = u ? ROLE_LABELS[u.role] : null
              const oldStatus = log.old_value?.status
              const newStatus = log.new_value?.status
              const roomNum   = log.new_value?.number

              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors">
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center text-sm shrink-0 mt-0.5">
                    {log.entity_type === 'room' ? '🛏️' : log.entity_type === 'task' ? '📋' : '👤'}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* User */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{u?.full_name || 'Système'}</span>
                      {roleInfo && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${roleInfo.badge}`}>{roleInfo.label}</span>
                      )}
                    </div>

                    {/* Action */}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ACTION_LABELS[log.action] || log.action}
                      {roomNum && <span className="font-mono ml-1 text-slate-300">· Ch. {roomNum}</span>}
                    </p>

                    {/* Status change */}
                    {oldStatus && newStatus && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${ROOM_STATUS[oldStatus]?.badge || 'text-slate-400'}`}>
                          {ROOM_STATUS[oldStatus]?.emoji} {ROOM_STATUS[oldStatus]?.label}
                        </span>
                        <span className="text-slate-600 text-[10px]">→</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${ROOM_STATUS[newStatus]?.badge || 'text-slate-400'}`}>
                          {ROOM_STATUS[newStatus]?.emoji} {ROOM_STATUS[newStatus]?.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-[10px] text-slate-600 shrink-0 mt-0.5 text-right">
                    <div>{format(new Date(log.created_at), 'dd MMM', { locale: fr })}</div>
                    <div className="text-slate-700">{format(new Date(log.created_at), 'HH:mm')}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
