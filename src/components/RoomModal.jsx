import React, { useState } from 'react'
import { X, Save, AlertTriangle, Wrench, Sparkles } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { ROOM_STATUS, ROLE_ALLOWED_STATUSES } from '../constants'

const SPECIAL_FLAGS = ['VIP', 'Late Check-out', 'Early Check-in', 'NPC', 'sb']

export default function RoomModal({ room, onClose, onUpdated }) {
  const { profile } = useAuth()
  const [status, setStatus]         = useState(room.status)
  const [specialFlag, setSpecialFlag] = useState(room.special_flag || '')
  const [notes, setNotes]           = useState(room.notes || '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  const allowedStatuses = ROLE_ALLOWED_STATUSES[profile?.role] || []
  const canEdit = allowedStatuses.length > 0

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('rooms')
        .update({
          status,
          special_flag: specialFlag || null,
          notes,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id)
      if (err) throw err
      onUpdated()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const current = ROOM_STATUS[room.status]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box !max-w-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-2xl font-black text-white">
              {room.number}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Détails Chambre</h2>
                {room.special_flag && (
                  <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] font-black rounded-md border border-purple-500/40 uppercase">
                    {room.special_flag}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{room.room_type} · Étage {room.floor}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Current status display */}
        <div
          className="flex items-center gap-4 p-5 rounded-2xl mb-8 border-l-4"
          style={{ borderColor: current?.color, background: current?.color + '08' }}
        >
          <span className="text-3xl">{current?.emoji}</span>
          <div className="flex-1">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Statut actuel</p>
            <p className="text-lg font-black text-white uppercase">{current?.label}</p>
          </div>
          {room.current_booking && (
             <div className="text-right">
                <p className="text-[10px] text-indigo-400 font-bold uppercase mb-0.5">Client Actuel</p>
                <p className="text-sm font-black text-white">{room.current_booking.guest_name}</p>
             </div>
          )}
        </div>

        {canEdit ? (
          <div className="space-y-4">
            {/* Status selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Nouveau statut
              </label>
              <div className="grid grid-cols-2 gap-2">
                {allowedStatuses.map(s => {
                  const st = ROOM_STATUS[s]
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all duration-150 ${
                        status === s
                          ? 'border-current bg-white/10 scale-[1.02]'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                      style={status === s ? { borderColor: st.color + '80', background: st.color + '20' } : {}}
                    >
                      <span className="text-lg">{st.emoji}</span>
                      <span className="text-sm font-medium text-white">{st.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Special flag (admin + reception) */}
            {(profile?.role === 'admin' || profile?.role === 'reception') && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  <Sparkles size={12} className="inline mr-1" /> Indicateur spécial
                </label>
                <select
                  value={specialFlag}
                  onChange={e => setSpecialFlag(e.target.value)}
                  className="select-field"
                >
                  <option value="">— Aucun —</option>
                  {SPECIAL_FLAGS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Ajouter une note..."
                className="input-field resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                <Save size={14} />
                {saving ? 'Enregistrement...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Wrench size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Votre rôle ne permet pas de modifier cette chambre.</p>
          </div>
        )}
      </div>
    </div>
  )
}
