import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import TaskCard from '../components/TaskCard'
import { TASK_TYPE, TASK_STATUS } from '../constants'

export default function TasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks]     = useState([])
  const [rooms, setRooms]     = useState([])
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // New task form state
  const [form, setForm] = useState({
    title: '', description: '', task_type: 'menage', priority: 'normale',
    room_id: '', assigned_to: ''
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, rooms(number), assigned_profile:profiles!tasks_assigned_to_fkey(full_name)')
      .order('created_at', { ascending: false })
    if (data) setTasks(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
    supabase.from('rooms').select('id,number,floor').order('number').then(({ data }) => setRooms(data || []))
    supabase.from('profiles').select('id,full_name,role').eq('is_active', true).then(({ data }) => setUsers(data || []))

    const sub = supabase
      .channel('tasks-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [fetchTasks])

  async function createTask(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        title:       form.title,
        description: form.description || null,
        task_type:   form.task_type,
        priority:    form.priority,
        room_id:     form.room_id  || null,
        assigned_to: form.assigned_to || null,
        created_by:  profile.id,
        status:      'en_attente',
      }
      const { error } = await supabase.from('tasks').insert(payload)
      if (error) throw error
      setShowNew(false)
      setForm({ title: '', description: '', task_type: 'menage', priority: 'normale', room_id: '', assigned_to: '' })
      fetchTasks()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateTaskStatus(id, newStatus) {
    const update = {
      status: newStatus,
      ...(newStatus === 'terminee' ? { completed_at: new Date().toISOString() } : {}),
    }
    await supabase.from('tasks').update(update).eq('id', id)
    fetchTasks()
  }

  const filtered = tasks.filter(t => {
    if (filterType !== 'all' && t.task_type !== filterType) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    return true
  })

  const grouped = {
    urgentes:   filtered.filter(t => t.priority === 'urgente' && t.status !== 'terminee' && t.status !== 'annulee'),
    en_attente: filtered.filter(t => t.status === 'en_attente' && t.priority !== 'urgente'),
    en_cours:   filtered.filter(t => t.status === 'en_cours'   && t.priority !== 'urgente'),
    terminee:   filtered.filter(t => t.status === 'terminee'),
    annulee:    filtered.filter(t => t.status === 'annulee'),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Tâches</h1>
          <p className="text-slate-400 text-sm mt-0.5">{tasks.length} tâche{tasks.length > 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus size={16} /> Nouvelle tâche
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select-field w-auto">
          <option value="all">Tous types</option>
          {Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field w-auto">
          <option value="all">Tous statuts</option>
          {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="animate-spin mr-2" size={20} /> Chargement...
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.urgentes.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                🚨 Urgentes <span className="px-2 py-0.5 bg-red-500/20 rounded-full text-xs">{grouped.urgentes.length}</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped.urgentes.map(t => <TaskCard key={t.id} task={t} onUpdate={updateTaskStatus} />)}
              </div>
            </section>
          )}

          {grouped.en_attente.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                ⏳ En attente <span className="px-2 py-0.5 bg-yellow-500/20 rounded-full text-xs">{grouped.en_attente.length}</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped.en_attente.map(t => <TaskCard key={t.id} task={t} onUpdate={updateTaskStatus} />)}
              </div>
            </section>
          )}

          {grouped.en_cours.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                🔄 En cours <span className="px-2 py-0.5 bg-blue-500/20 rounded-full text-xs">{grouped.en_cours.length}</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped.en_cours.map(t => <TaskCard key={t.id} task={t} onUpdate={updateTaskStatus} />)}
              </div>
            </section>
          )}

          {grouped.terminee.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                ✅ Terminées <span className="px-2 py-0.5 bg-emerald-500/20 rounded-full text-xs">{grouped.terminee.length}</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped.terminee.map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-base font-medium">Aucune tâche trouvée</p>
            </div>
          )}
        </div>
      )}

      {/* New Task Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Nouvelle tâche</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={16} /></button>
            </div>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Titre *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Description courte de la tâche"
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Type</label>
                  <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))} className="select-field">
                    {Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Priorité</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="select-field">
                    <option value="normale">Normale</option>
                    <option value="urgente">🚨 Urgente</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Chambre</label>
                  <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} className="select-field">
                    <option value="">— Aucune —</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.number} (Ét. {r.floor})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Assignée à</label>
                  <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="select-field">
                    <option value="">— Non assignée —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Détails supplémentaires..."
                  className="input-field resize-none"
                />
              </div>
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertTriangle size={14} /> {formError}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Création...' : 'Créer la tâche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
