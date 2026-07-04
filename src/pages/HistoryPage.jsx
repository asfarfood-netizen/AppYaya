import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { format, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BarChart3, Calendar, CheckCircle2, Clock, Wrench } from 'lucide-react'

export default function HistoryPage() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('daily_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(30)
    
    if (data) setStats(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
    const sub = supabase
      .channel('stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, () => {
        fetchStats()
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [fetchStats])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <BarChart3 className="text-indigo-400" />
          Historique Quotidien
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Évolution de l'occupation des chambres sur les 30 derniers jours
        </p>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-sm">Chargement de l'historique...</p>
          </div>
        ) : stats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Calendar className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Aucune donnée</p>
            <p className="text-sm mt-1">Les statistiques s'afficheront dès qu'une chambre changera de statut.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Libres</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Occupées</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">En prép.</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Maintenance</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Taux d'occupation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.map(row => {
                  const total = row.libre + row.occupee + row.en_preparation + row.maintenance
                  const occupancyRate = total > 0 ? Math.round((row.occupee / total) * 100) : 0

                  return (
                    <tr key={row.date} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-500" />
                          <span className="text-sm font-medium text-white capitalize">
                            {format(new Date(row.date), 'EEEE d MMMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 size={14} />
                          {row.libre}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <span className="text-xs">🛏️</span>
                          {row.occupee}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                          <Clock size={14} />
                          {row.en_preparation}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                          <Wrench size={14} />
                          {row.maintenance}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden flex">
                            <div style={{ width: `${occupancyRate}%` }} className="bg-rose-500 h-full rounded-r-full" />
                            <div style={{ width: `${total > 0 ? (row.en_preparation/total)*100 : 0}%` }} className="bg-amber-500 h-full rounded-r-full" />
                            <div style={{ width: `${total > 0 ? (row.maintenance/total)*100 : 0}%` }} className="bg-slate-500 h-full rounded-r-full" />
                            <div style={{ width: `${total > 0 ? (row.libre/total)*100 : 0}%` }} className="bg-emerald-500 h-full rounded-r-full" />
                          </div>
                          <span className="text-xs font-bold text-white w-8 text-right">{occupancyRate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
