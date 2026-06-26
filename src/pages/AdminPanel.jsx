import React, { useEffect, useState, useCallback } from 'react'
import { UserPlus, X, Loader2, AlertTriangle, Edit2, Power, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../constants'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient'

export default function AdminPanel() {
  const { profile } = useAuth()
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm]       = useState({ email: '', password: '', full_name: '', role: 'reception' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  const fetchUsers = useCallback(async () => {
    // Left join auth.users to get email? Supabase doesn't allow joining auth.users easily without RPC.
    // We'll just list profiles.
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function createUser(e) {
    e.preventDefault()
    setSaving(true); setError(null); setSuccess(null)
    try {
      // Pour créer un compte sans déconnecter l'admin actuel,
      // nous utilisons une instance temporaire de Supabase
      const { createClient } = await import('@supabase/supabase-js')
      const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })

      const { data: { user }, error: suErr } = await tempClient.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, role: form.role } }
      })

      if (suErr) throw suErr
      
      if (user) {
        // Le trigger handle_new_user va créer le profil automatiquement.
        // On s'assure juste de forcer la mise à jour au cas où.
        await supabase.from('profiles').upsert({ id: user.id, full_name: form.full_name, role: form.role })
      }

      setSuccess(`Compte créé pour ${form.full_name}`)
      setShowNew(false)
      setForm({ email: '', password: '', full_name: '', role: 'reception' })
      setTimeout(fetchUsers, 1000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u) {
    await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id)
    fetchUsers()
  }

  async function updateRole(userId, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setEditUser(null)
    fetchUsers()
  }

  const stats = {
    total:  users.length,
    active: users.filter(u => u.is_active).length,
    byRole: Object.fromEntries(Object.keys(ROLE_LABELS).map(r => [r, users.filter(u => u.role === r).length])),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Panel Administrateur</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gestion des comptes et accès</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <UserPlus size={16} /> Nouveau compte
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
          ✓ {success}
        </div>
      )}

      {/* Role stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ROLE_LABELS).map(([role, info]) => (
          <div key={role} className="glass-card p-4 text-center">
            <div className="text-2xl mb-1">{info.icon}</div>
            <div className="text-xl font-bold text-white">{stats.byRole[role] || 0}</div>
            <div className="text-xs text-slate-400">{info.label}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">
            Comptes utilisateurs
            <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full text-xs text-slate-400">{stats.total}</span>
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="animate-spin mr-2" size={18} /> Chargement...
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {users.map(u => {
              const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.reception
              const isSelf = u.id === profile?.id
              return (
                <div key={u.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-slate-700/60 border border-white/10 flex items-center justify-center text-lg shrink-0">
                    {roleInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm truncate">{u.full_name}</span>
                      {isSelf && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md">Vous</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Créé le {format(new Date(u.created_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <span className={`status-badge border text-[10px] ${roleInfo.badge}`}>{roleInfo.label}</span>
                  <span className={`text-[10px] px-2 py-1 rounded-md font-medium ${u.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
                    {u.is_active ? 'Actif' : 'Inactif'}
                  </span>
                  {!isSelf && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditUser(u)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Modifier le rôle"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'hover:bg-red-500/10 text-slate-400 hover:text-red-400' : 'hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400'}`}
                        title={u.is_active ? 'Désactiver' : 'Activer'}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New user modal */}
      {showNew && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Créer un compte</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={16} /></button>
            </div>
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nom complet</label>
                <input required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Prénom Nom" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@hotel.com" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mot de passe</label>
                <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 caractères" className="input-field" minLength={6} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Rôle</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="select-field">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit role modal */}
      {editUser && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditUser(null)}>
          <div className="modal-box max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Modifier le rôle</h2>
              <button onClick={() => setEditUser(null)} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={16} /></button>
            </div>
            <p className="text-slate-400 text-sm mb-4">Modifier le rôle de <strong className="text-white">{editUser.full_name}</strong></p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => updateRole(editUser.id, k)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                    editUser.role === k
                      ? 'bg-indigo-600/30 border-indigo-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>{v.icon}</span> {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
