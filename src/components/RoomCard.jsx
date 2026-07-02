import React from 'react'
import { ROOM_STATUS } from '../constants'

const TYPE_ICONS = {
  Standard:    '🛏️',
  Grand:       '🛏️✨',
  Appartement: '🏠',
}

export default function RoomCard({ room, onClick, compact = false }) {
  const st = ROOM_STATUS[room.status] || ROOM_STATUS.libre
  const dotColor = st.color

  if (compact) {
    return (
      <button
        onClick={() => onClick(room)}
        title={`${room.number} — ${st.label}`}
        className={`
          relative w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center
          transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer
          room-${room.status}
        `}
        style={{ borderColor: dotColor + '60', background: dotColor + '18' }}
      >
        <span className="text-xs font-bold text-white leading-none">{room.number}</span>
        <span className="text-[9px] text-white/60 mt-0.5">{st.emoji}</span>
        {room.special_flag && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full border border-slate-900" />
        )}
      </button>
    )
  }

  return (
    <button
      onClick={() => onClick(room)}
      className={`
        relative group w-full text-left border-2 rounded-2xl p-4
        transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer
        room-${room.status}
      `}
      style={{ borderColor: dotColor + '50' }}
    >
      {/* Status dot */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <span className="text-lg">{st.emoji}</span>
      </div>

      {/* Room number */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-2xl font-extrabold text-white tracking-tight">{room.number}</span>
        {room.special_flag && (
          <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] font-bold rounded-md border border-purple-500/40 mt-1">
            {room.special_flag}
          </span>
        )}
      </div>

      {/* Type + floor */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{TYPE_ICONS[room.room_type] || '🛏️'}</span>
        <span className="text-xs text-slate-400">{room.room_type}</span>
        <span className="text-slate-600">·</span>
        <span className="text-xs text-slate-400">Ét. {room.floor}</span>
      </div>

      {/* Status badge */}
      <span className={`status-badge border ${st.badge} text-[11px]`}>
        {st.label}
      </span>

      {/* Notes preview */}
      {room.notes && (
        <p className="mt-2 text-[11px] text-slate-400 line-clamp-1 italic">
          {room.notes}
        </p>
      )}

      {/* Guest info from planning */}
      {room.current_booking && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <p className="text-[10px] font-bold text-indigo-400 uppercase truncate">
            👤 {room.current_booking.guest_name}
          </p>
        </div>
      )}

      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 20px ${dotColor}20` }}
      />
    </button>
  )
}
