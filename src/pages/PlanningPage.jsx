import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { syncAllBookings } from '../services/bookingSync';
import {
  Calendar, RefreshCw, ChevronLeft, ChevronRight,
  Users, BedDouble, Filter, Download
} from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isWithinInterval, addDays,
  startOfWeek, endOfWeek, isToday
} from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PlanningPage() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('grid'); // 'grid' or 'list'

  const fetchRooms = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('number, floor').order('number');
    if (data) setRooms(data);
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('bookings').select('*');
    if (data) setBookings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchBookings();
  }, [fetchRooms, fetchBookings]);

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAllBookings();
      await fetchBookings();
    } catch (e) {
      alert('Erreur: ' + e.message);
    } finally {
      setSyncing(false);
    }
  }

  const getBookingForRoomAndDay = (roomNumber, day) => {
    return bookings.find(b => {
      const start = new Date(b.check_in);
      const end = new Date(b.check_out);
      return b.room_number === roomNumber && isWithinInterval(day, { start, end: addDays(end, -1) });
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Calendar className="text-indigo-400" />
            Planning des Réservations
          </h1>
          <p className="text-slate-400 text-sm mt-0.5 capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 mr-2">
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Grille
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Liste
            </button>
          </div>

          <button onClick={handleSync} disabled={syncing} className="btn-primary">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sync...' : 'Sync Excel'}
          </button>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-xs font-bold text-white hover:bg-white/10 rounded-xl transition-colors border border-white/10"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-indigo-600 rounded" />
            <span className="text-slate-400">Été</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded" />
            <span className="text-slate-400">Hiver</span>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' && (
        <div className="glass-card overflow-hidden border border-white/10 shadow-2xl">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#0f1117] border-b border-white/10">
                  <th className="sticky left-0 z-30 p-4 text-xs font-bold text-slate-400 bg-[#0f1117] border-r border-white/10 min-w-[120px]">
                    CHAMBRE
                  </th>
                  {days.map(day => (
                    <th
                      key={day.toISOString()}
                      className={`p-2 text-[10px] font-bold border-r border-white/5 min-w-[40px] ${isToday(day) ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500'}`}
                    >
                      <div className="uppercase">{format(day, 'eee', { locale: fr })}</div>
                      <div className="text-sm text-white mt-1">{format(day, 'd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.number} className="border-b border-white/5 group hover:bg-white/2 transition-colors">
                    <td className="sticky left-0 z-10 p-4 bg-[#0d1117] border-r border-white/10 font-black text-white text-sm group-hover:bg-[#161b22]">
                      {room.number}
                    </td>
                    {days.map(day => {
                      const booking = getBookingForRoomAndDay(room.number, day);
                      const isStart = booking && isSameDay(new Date(booking.check_in), day);

                      return (
                        <td
                          key={day.toISOString()}
                          className={`relative p-0 border-r border-white/5 h-12 min-w-[40px] ${isToday(day) ? 'bg-indigo-500/5' : ''}`}
                        >
                          {booking && (
                            <div
                              className={`absolute inset-y-1 left-0 right-0 z-0 flex items-center px-1 overflow-hidden
                                ${booking.season.includes('ETE') ? 'bg-indigo-600/60 border-indigo-500' : 'bg-blue-600/60 border-blue-500'}
                                ${isStart ? 'rounded-l-lg border-l-2 ml-1' : ''}
                                ${isSameDay(addDays(new Date(booking.check_out), -1), day) ? 'rounded-r-lg border-r-2 mr-1' : ''}
                                border-t border-b cursor-help transition-all hover:brightness-125
                              `}
                              title={`${booking.guest_name} (${booking.check_in} -> ${booking.check_out})`}
                            >
                              {isStart && (
                                <span className="text-[10px] font-bold text-white uppercase whitespace-nowrap overflow-hidden">
                                  {booking.guest_name}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chambre</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Arrivée</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Départ</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Saison</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bookings
                  .filter(b => isWithinInterval(new Date(b.check_in), {
                    start: startOfMonth(currentDate),
                    end: endOfMonth(currentDate)
                  }) || isWithinInterval(new Date(b.check_out), {
                    start: startOfMonth(currentDate),
                    end: endOfMonth(currentDate)
                  }))
                  .sort((a,b) => new Date(a.check_in) - new Date(b.check_in))
                  .map(booking => (
                    <tr key={booking.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-indigo-400" />
                          <span className="text-sm font-bold text-white uppercase">{booking.guest_name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-300">{booking.room_number}</td>
                      <td className="p-4 text-sm text-slate-400">{format(new Date(booking.check_in), 'dd MMM yyyy', { locale: fr })}</td>
                      <td className="p-4 text-sm text-slate-400">{format(new Date(booking.check_out), 'dd MMM yyyy', { locale: fr })}</td>
                      <td className="p-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${booking.season.includes('ETE') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                          {booking.season}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
