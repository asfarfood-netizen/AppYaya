import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { syncAllBookings } from '../services/bookingSync';
import { SEASONS_CONFIG } from '../constants';
import {
  Calendar, RefreshCw, ChevronLeft, ChevronRight,
  Users, BedDouble, Filter, Download, X, Search,
  ChevronDown
} from 'lucide-react';
import {
  format, eachDayOfInterval, isSameDay, isWithinInterval, addDays,
  isToday, startOfMonth, endOfMonth, differenceInDays
} from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PlanningPage() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentSeasonId, setCurrentSeasonId] = useState(SEASONS_CONFIG[0].id);
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [lastSync, setLastSync] = useState(localStorage.getItem('last_booking_sync'));

  const scrollContainerRef = useRef(null);

  const currentSeason = useMemo(() =>
    SEASONS_CONFIG.find(s => s.id === currentSeasonId),
  [currentSeasonId]);

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

    const bookingSub = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bookingSub);
    };
  }, [fetchRooms, fetchBookings]);

  const days = useMemo(() => {
    return eachDayOfInterval({ start: currentSeason.start, end: currentSeason.end });
  }, [currentSeason]);

  const monthsInSeason = useMemo(() => {
    const months = [];
    let current = startOfMonth(currentSeason.start);
    const end = endOfMonth(currentSeason.end);

    while (current <= end) {
      const monthStart = current > currentSeason.start ? current : currentSeason.start;
      const monthEnd = endOfMonth(current) < currentSeason.end ? endOfMonth(current) : currentSeason.end;

      months.push({
        label: format(current, 'MMMM yyyy', { locale: fr }),
        daysCount: differenceInDays(monthEnd, monthStart) + 1,
        start: monthStart,
        end: monthEnd
      });
      current = addDays(endOfMonth(current), 1);
    }
    return months;
  }, [currentSeason, days]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAllBookings();
      await fetchBookings();
      const now = new Date().toISOString();
      setLastSync(now);
      localStorage.setItem('last_booking_sync', now);
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

  const scrollToToday = () => {
    if (scrollContainerRef.current) {
        const todayIdx = days.findIndex(day => isSameDay(day, new Date()));
        if (todayIdx !== -1) {
            const cellWidth = 44; // min-w-[44px]
            const roomColWidth = 120; // sticky room column
            scrollContainerRef.current.scrollLeft = (todayIdx * cellWidth) - (scrollContainerRef.current.clientWidth / 2) + roomColWidth;
        }
    }
  };

  useEffect(() => {
      if (!loading && view === 'grid') {
          setTimeout(scrollToToday, 500);
      }
  }, [loading, view, currentSeasonId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Calendar className="text-indigo-400" />
            Planning des Réservations
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-slate-400 text-sm font-bold uppercase tracking-tight">
              Saison: {currentSeason.label}
            </p>
            {lastSync && (
              <span className="text-[10px] text-slate-500 font-medium">
                • Sync: {format(new Date(lastSync), 'HH:mm', { locale: fr })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Season Switcher */}
          <div className="relative group">
            <select
                value={currentSeasonId}
                onChange={(e) => setCurrentSeasonId(e.target.value)}
                className="pl-4 pr-10 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
                {SEASONS_CONFIG.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Rechercher client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all w-48 md:w-64"
            />
          </div>

          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
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

      {/* Grid View */}
      {view === 'grid' && (
        <div className="glass-card overflow-hidden border border-white/10 shadow-2xl relative">
           <button
                onClick={scrollToToday}
                className="absolute bottom-6 right-6 z-30 p-3 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-500 transition-all active:scale-90 md:hidden"
                title="Aujourd'hui"
            >
                <Calendar size={20} />
           </button>

          <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto max-h-[75vh]">
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-20">
                {/* Month Headers */}
                <tr className="bg-[#0f1117] border-b border-white/5">
                  <th className="sticky left-0 z-30 bg-[#0f1117] border-r border-white/10 w-[120px]"></th>
                  {monthsInSeason.map((m, idx) => (
                      <th
                        key={idx}
                        colSpan={m.daysCount}
                        className="p-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-white/5 text-center bg-white/[0.02]"
                      >
                        {m.label}
                      </th>
                  ))}
                </tr>
                {/* Day Headers */}
                <tr className="bg-[#0f1117] border-b border-white/10 shadow-sm">
                  <th className="sticky left-0 z-30 p-4 text-[10px] font-black text-slate-500 bg-[#0f1117] border-r border-white/10 w-[120px] uppercase tracking-tighter">
                    CHAMBRE
                  </th>
                  {days.map(day => (
                    <th
                      key={day.toISOString()}
                      className={`p-1.5 text-[9px] font-bold border-r border-white/5 min-w-[44px] ${isToday(day) ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500'}`}
                    >
                      <div className="uppercase opacity-60">{format(day, 'eee', { locale: fr })}</div>
                      <div className="text-sm text-white mt-0.5">{format(day, 'd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.number} className="border-b border-white/5 group hover:bg-white/2 transition-colors">
                    <td className="sticky left-0 z-10 p-4 bg-[#0d1117] border-r border-white/10 font-black text-white text-sm group-hover:bg-[#161b22] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]">
                      {room.number}
                    </td>
                    {days.map(day => {
                      const booking = getBookingForRoomAndDay(room.number, day);
                      const isStart = booking && isSameDay(new Date(booking.check_in), day);
                      const isMatch = search && booking?.guest_name.toLowerCase().includes(search.toLowerCase());
                      const isSelected = selectedBooking?.id === booking?.id;

                      return (
                        <td
                          key={day.toISOString()}
                          className={`relative p-0 border-r border-white/5 h-12 min-w-[44px] ${isToday(day) ? 'bg-indigo-500/10' : ''}`}
                        >
                          {isToday(day) && (
                            <div className="absolute inset-y-0 left-1/2 w-[2px] bg-indigo-500/30 z-10 pointer-events-none" />
                          )}
                          {booking && (
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className={`absolute inset-y-1.5 left-0 right-0 z-0 flex items-center px-1.5 overflow-hidden transition-all
                                ${booking.season.includes('ETE')
                                  ? 'bg-indigo-600/80 border-indigo-500'
                                  : 'bg-blue-600/80 border-blue-500'}
                                ${isStart ? 'rounded-l-lg border-l-2 ml-1' : ''}
                                ${isSameDay(addDays(new Date(booking.check_out), -1), day) ? 'rounded-r-lg border-r-2 mr-1' : ''}
                                ${isMatch ? 'ring-2 ring-white ring-inset brightness-125 z-20 shadow-lg shadow-white/20' : ''}
                                ${isSelected ? 'brightness-150 scale-y-105 z-20 ring-1 ring-white/50' : 'hover:brightness-110'}
                                border-t border-b text-left
                              `}
                            >
                              {isStart && (
                                <span className="text-[10px] font-bold text-white uppercase whitespace-nowrap overflow-hidden">
                                  {booking.guest_name}
                                </span>
                              )}
                            </button>
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
        <div className="space-y-8">
            {monthsInSeason.map((m, idx) => {
                const monthBookings = bookings
                    .filter(b => {
                        const matchesSearch = !search || b.guest_name.toLowerCase().includes(search.toLowerCase());
                        const start = new Date(b.check_in);
                        const end = new Date(b.check_out);
                        // Show in list if any part of booking is in this month
                        const isInMonth = (start >= m.start && start <= m.end) || (end >= m.start && end <= m.end);
                        return matchesSearch && isInMonth;
                    })
                    .sort((a,b) => new Date(a.check_in) - new Date(b.check_in));

                if (monthBookings.length === 0) return null;

                return (
                    <div key={idx} className="glass-card overflow-hidden">
                        <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">{m.label}</h3>
                            <span className="text-xs text-slate-500 font-bold">{monthBookings.length} réservations</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5">
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client</th>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chambre</th>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arrivée</th>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Départ</th>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saison</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {monthBookings.map(booking => (
                                    <tr
                                    key={booking.id}
                                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                                    onClick={() => setSelectedBooking(booking)}
                                    >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                            <Users size={14} />
                                        </div>
                                        <span className="text-sm font-bold text-white uppercase">{booking.guest_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-black text-slate-300">{booking.room_number}</td>
                                    <td className="p-4 text-xs font-bold text-emerald-400">{format(new Date(booking.check_in), 'dd MMM yyyy', { locale: fr })}</td>
                                    <td className="p-4 text-xs font-bold text-red-400">{format(new Date(booking.check_out), 'dd MMM yyyy', { locale: fr })}</td>
                                    <td className="p-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${booking.season.includes('ETE') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                                        {booking.season}
                                        </span>
                                    </td>
                                    </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal-box !max-w-md border-indigo-500/30" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Détails Réservation</h2>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Client</p>
                <p className="text-lg font-black text-white uppercase">{selectedBooking.guest_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Chambre</p>
                  <p className="text-lg font-black text-white">{selectedBooking.room_number}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Personnes</p>
                  <p className="text-lg font-black text-white">{selectedBooking.persons || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">Arrivée</p>
                  <p className="text-sm font-bold text-white">{format(new Date(selectedBooking.check_in), 'dd MMMM yyyy', { locale: fr })}</p>
                </div>
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mb-1">Départ</p>
                  <p className="text-sm font-bold text-white">{format(new Date(selectedBooking.check_out), 'dd MMMM yyyy', { locale: fr })}</p>
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1">Notes / Contact</p>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">{selectedBooking.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Provenance</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${selectedBooking.season.includes('ETE') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                  {selectedBooking.season}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
