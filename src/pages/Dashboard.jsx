import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Wifi, WifiOff, RotateCcw } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import FilterBar from '../components/FilterBar'
import StatsBar from '../components/StatsBar'
import RoomGrid from '../components/RoomGrid'
import RoomModal from '../components/RoomModal'
import {
  applyPlanningStatusToRooms,
  resetAllRoomsToPlanning,
  syncAutomaticRoomStatuses
} from '../services/roomStatusSync'

export default function Dashboard() {
  const { profile } = useAuth()
  const [rooms, setRooms]         = useState([])
  const [tasks, setTasks]         = useState([])
  const [bookings, setBookings]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [bookingsLoaded, setBookingsLoaded] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [connected, setConnected] = useState(true)
  const [selected, setSelected]   = useState(null)
  const [filters, setFilters]     = useState({ search: '', status: 'all', floor: 'all', roomType: 'all' })
  const lastSync = localStorage.getItem('last_booking_sync')

  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('floor')
      .order('number')
    if (!error) setRooms(data || [])
    setLoading(false)
  }, [])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, rooms(number), assigned_profile:profiles!tasks_assigned_to_fkey(full_name)')
      .neq('status', 'terminee')
      .neq('status', 'annulee')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setTasks(data)
  }, [])

  const fetchCurrentBookings = useCallback(async () => {
    setBookingsLoaded(false)
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .lte('check_in', todayStr)
      .gt('check_out', todayStr)
    if (data) setBookings(data)
    setBookingsLoaded(true)
  }, [])

  useEffect(() => {
    fetchRooms()
    fetchTasks()
    fetchCurrentBookings()

    // Realtime subscriptions
    const roomSub = supabase
      .channel('rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms()
      })
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED')
      })

    const taskSub = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks()
      })
      .subscribe()

    const bookingSub = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchCurrentBookings()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(roomSub)
      supabase.removeChannel(taskSub)
      supabase.removeChannel(bookingSub)
    }
  }, [fetchRooms, fetchTasks, fetchCurrentBookings])

  useEffect(() => {
    if (loading || !bookingsLoaded || rooms.length === 0) return
    syncAutomaticRoomStatuses(rooms, bookings)
      .then((result) => {
        if (result.updated > 0) fetchRooms()
      })
      .catch((error) => {
        console.warn('[Rooms] Planning status sync skipped:', error)
      })
  }, [loading, bookingsLoaded, rooms, bookings, fetchRooms])

  const roomsWithPlanning = useMemo(() => {
    return applyPlanningStatusToRooms(rooms, bookings)
  }, [rooms, bookings])

  // Apply filters
  const filteredRooms = roomsWithPlanning.filter(r => {
    if (filters.search && !r.number.toLowerCase().includes(filters.search.toLowerCase()) && !r.notes?.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.status !== 'all' && r.status !== filters.status) return false
    if (filters.floor !== 'all' && r.floor !== filters.floor) return false
    if (filters.roomType !== 'all' && r.room_type !== filters.roomType) return false
    return true
  })

  async function handleResetAllRooms() {
    if (!window.confirm('Réinitialiser tous les statuts selon le planning ? Les changements manuels seront retirés.')) return
    setResetting(true)
    try {
      await resetAllRoomsToPlanning(rooms, bookings)
      await fetchRooms()
    } catch (error) {
      alert('Erreur reset planning: ' + error.message)
    } finally {
      setResetting(false)
    }
  }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white capitalize">
            Bonjour, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-0.5 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Last sync info */}
          {lastSync && (
            <div className="hidden lg:flex flex-col items-end mr-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Dernier Sync</span>
              <span className="text-xs text-indigo-400 font-medium">{new Date(lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
          {/* Connection indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            connected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Temps réel' : 'Hors ligne'}
            {connected && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full realtime-dot" />}
          </div>
          <button
            onClick={handleResetAllRooms}
            disabled={resetting}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 glass-card hover:bg-white/10 rounded-xl transition-colors text-xs font-black uppercase text-slate-300 disabled:opacity-50"
            title="Réinitialiser toutes les chambres selon le planning"
          >
            <RotateCcw size={15} className={resetting ? 'animate-spin' : ''} />
            Reset planning
          </button>
          <button
            onClick={() => { fetchRooms(); fetchTasks(); fetchCurrentBookings() }}
            className="p-2 glass-card hover:bg-white/10 rounded-xl transition-colors"
            title="Actualiser"
          >
            <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar rooms={roomsWithPlanning} tasks={tasks} />

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Results count */}
      {(filters.status !== 'all' || filters.floor !== 'all' || filters.roomType !== 'all' || filters.search) && (
        <p className="text-xs text-slate-500 -mt-2">
          {filteredRooms.length} chambre{filteredRooms.length > 1 ? 's' : ''} affichée{filteredRooms.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Rooms grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3" />
          <p className="text-sm">Chargement des chambres...</p>
        </div>
      ) : (
        <RoomGrid rooms={filteredRooms} onRoomClick={setSelected} />
      )}

      {/* Room modal */}
      {selected && (
        <RoomModal
          room={selected}
          onClose={() => setSelected(null)}
          bookings={bookings}
          onUpdated={() => { fetchRooms(); setSelected(null) }}
        />
      )}
    </div>
  )
}
