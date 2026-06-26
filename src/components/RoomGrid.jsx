import React from 'react'
import RoomCard from './RoomCard'
import { ALL_FLOORS } from '../constants'

export default function RoomGrid({ rooms, onRoomClick, compact = false }) {
  // Group rooms by floor
  const byFloor = {}
  rooms.forEach(r => {
    if (!byFloor[r.floor]) byFloor[r.floor] = []
    byFloor[r.floor].push(r)
  })

  // Sort floors in defined order
  const orderedFloors = ALL_FLOORS.filter(f => byFloor[f]?.length > 0)

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <span className="text-5xl mb-4">🏨</span>
        <p className="text-lg font-medium">Aucune chambre trouvée</p>
        <p className="text-sm mt-1">Modifiez les filtres pour afficher des chambres.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {orderedFloors.map(floor => (
        <section key={floor}>
          {/* Floor header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-300">
                {floor === 'Annexe' ? 'AX' : floor}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-slate-300">
              {floor === 'Annexe' ? 'Annexe — Appartements' : `Étage ${floor}`}
            </h2>
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-xs text-slate-500">{byFloor[floor].length} chambre{byFloor[floor].length > 1 ? 's' : ''}</span>
          </div>

          {/* Rooms grid */}
          {compact ? (
            <div className="flex flex-wrap gap-2">
              {byFloor[floor].map(room => (
                <RoomCard key={room.id} room={room} onClick={onRoomClick} compact />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {byFloor[floor].map(room => (
                <RoomCard key={room.id} room={room} onClick={onRoomClick} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
