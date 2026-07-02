import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { syncAllBookings } from '../services/bookingSync';
import { SEASONS_CONFIG } from '../constants';
import {
  Calendar, RefreshCw, ChevronLeft, ChevronRight,
  Users, BedDouble, Filter, Download, X, Search,
  ChevronDown, ArrowRight
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

  // Index bookings by room number for faster lookup
  const indexedBookings = useMemo(() => {
      const index = {};
      bookings.forEach(b => {
          if (!index[b.room_number]) index[b.room_number] = [];
          index[b.room_number].push(b);
      });
      return index;
  }, [bookings]);

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
  }, [currentSeason]);

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
    const roomBookings = indexedBookings[roomNumber];
    if (!roomBookings) return null;
    return roomBookings.find(b => {
      const start = new Date(b.check_in);
      const end = new Date(b.check_out);
      return isWithinInterval(day, { start, end: addDays(end, -1) });
    });
  };

  const scrollToToday = () => {
    if (scrollContainerRef.current) {
        const todayIdx = days.findIndex(day => isSameDay(day, new Date()));
        if (todayIdx !== -1) {
            const cellWidth = 60; // Increased width for better spacing
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
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Calendar className="text-white" size={24} />
            </div>
            <div>
                <h1 className="text-3xl font-black text-white uppercase tracking-tight leading-none">
                    Planning
                </h1>
                <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        SAISON {currentSeason.label}
                    </span>
                    {lastSync && (
                    <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                        <RefreshCw size={10} className="text-slate-600" />
                        SYNCHRO À {format(new Date(lastSync), 'HH:mm', { locale: fr })}
                    </span>
                    )}
                </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Season Switcher */}
          <div className="relative">
            <select
                value={currentSeasonId}
                onChange={(e) => setCurrentSeasonId(e.target.value)}
                className="pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-white uppercase appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer transition-all hover:bg-white/10"
            >
                {SEASONS_CONFIG.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                ))}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Chercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all w-48 xl:w-72"
            />
          </div>

          <div className="flex bg-white/5 rounded-2xl p-1.5 border border-white/10">
            <button
              onClick={() => setView('grid')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${view === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            >
              Grille
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${view === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            >
              Liste
            </button>
          </div>

          <button onClick={handleSync} disabled={syncing} className="btn-primary !py-3 !px-6 !text-xs uppercase tracking-widest gap-3">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Synchronisation...' : 'Sync Excel'}
          </button>
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' && (
        <div className="glass-card overflow-hidden border border-white/5 shadow-2xl relative group/grid">
           <button
                onClick={scrollToToday}
                className="fixed bottom-10 right-10 z-50 p-5 bg-indigo-600 text-white rounded-2xl shadow-[0_20px_50px_rgba(79,70,229,0.4)] hover:bg-indigo-500 transition-all active:scale-95 border-2 border-white/20 flex items-center gap-2 group/btn"
                title="Centrer sur Aujourd'hui"
            >
                <Calendar size={24} className="group-hover/btn:scale-110 transition-transform" />
                <span className="text-xs font-black uppercase tracking-widest hidden md:block">Aujourd'hui</span>
           </button>

          <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto max-h-[75vh] custom-scrollbar scroll-smooth">
            <table className="border-collapse w-max">
              <thead className="sticky top-0 z-30">
                {/* Month Headers */}
                <tr className="bg-[#0d1117]/95 backdrop-blur-md border-b border-white/5">
                  <th className="sticky left-0 z-50 bg-[#0d1117] border-r border-white/10 w-[120px] p-0"></th>
                  {monthsInSeason.map((m, idx) => (
                      <th
                        key={idx}
                        colSpan={m.daysCount}
                        className="p-4 text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] border-r border-white/5 text-center bg-indigo-500/[0.02]"
                      >
                        {m.label}
                      </th>
                  ))}
                </tr>
                {/* Day Headers */}
                <tr className="bg-[#0d1117]/95 backdrop-blur-md border-b border-white/10 shadow-xl">
                  <th className="sticky left-0 z-50 p-4 text-[10px] font-black text-slate-500 bg-[#0d1117] border-r border-white/10 w-[120px] uppercase tracking-widest text-center shadow-[4px_0_12px_rgba(0,0,0,0.4)]">
                    Chambre
                  </th>
                  {days.map(day => (
                    <th
                      key={day.toISOString()}
                      className={`p-3 text-[10px] font-black border-r border-white/5 min-w-[60px] text-center ${isToday(day) ? 'bg-indigo-500/20 text-indigo-400 relative overflow-visible' : 'text-slate-600'}`}
                    >
                      {isToday(day) && (
                          <div className="absolute top-0 bottom-[-1000px] left-1/2 w-[2px] bg-indigo-500/30 -translate-x-1/2 pointer-events-none z-0" />
                      )}
                      <div className="uppercase opacity-40 text-[9px] mb-1">{format(day, 'EEEEEE', { locale: fr })}</div>
                      <div className={`text-base font-black ${isToday(day) ? 'text-white scale-125' : 'text-slate-400'} transition-transform`}>
                        {format(day, 'd')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.number} className="border-b border-white/[0.03] group transition-colors hover:bg-white/[0.01]">
                    <td className="sticky left-0 z-40 p-4 bg-[#0d1117] border-r border-white/10 font-black text-center group-hover:bg-[#161b22] shadow-[4px_0_12px_rgba(0,0,0,0.4)] transition-colors">
                      <div className="flex flex-col">
                        <span className="text-base text-white">{room.number}</span>
                        <span className="text-[8px] text-slate-600 uppercase tracking-tighter">Étage {room.floor}</span>
                      </div>
                    </td>
                    {days.map(day => {
                      const booking = getBookingForRoomAndDay(room.number, day);
                      if (!booking) return (
                         <td
                            key={day.toISOString()}
                            className={`grid-day-cell h-[64px] min-w-[60px] ${isToday(day) ? 'bg-indigo-500/[0.04]' : ''}`}
                         />
                      );

                      const isStart = isSameDay(new Date(booking.check_in), day);
                      const isEnd = isSameDay(addDays(new Date(booking.check_out), -1), day);
                      const isMatch = search && (
                          booking.guest_name.toLowerCase().includes(search.toLowerCase()) ||
                          booking.room_number.toString().includes(search)
                      );
                      const isSelected = selectedBooking?.id === booking.id;

                      return (
                        <td
                          key={day.toISOString()}
                          className={`grid-day-cell h-[64px] min-w-[60px] ${isToday(day) ? 'bg-indigo-500/[0.04]' : ''}`}
                        >
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className={`booking-bar
                              ${booking.season.includes('ETE')
                                ? 'bg-indigo-600 border-indigo-400/50 text-indigo-100'
                                : 'bg-blue-600 border-blue-400/50 text-blue-100'}
                              ${isStart ? 'booking-bar-start' : 'left-0'}
                              ${isEnd ? 'booking-bar-end' : 'right-0'}
                              ${isMatch ? 'z-20 brightness-150 booking-glow ring-2 ring-white scale-y-110' : ''}
                              ${isSelected ? 'z-20 brightness-150 ring-2 ring-indigo-300 scale-y-110' : 'hover:brightness-110 hover:scale-y-105'}
                            `}
                          >
                            {isStart && (
                              <div className="flex items-center gap-2 overflow-hidden w-full">
                                {booking.persons && (
                                    <div className="flex items-center gap-1 shrink-0 bg-black/20 px-1.5 py-0.5 rounded text-[9px] font-black border border-white/10">
                                        <Users size={10} />
                                        {booking.persons}
                                    </div>
                                )}
                                <span className="text-[11px] font-black uppercase whitespace-nowrap overflow-hidden text-ellipsis tracking-tighter">
                                  {booking.guest_name}
                                </span>
                                {booking.notes && (
                                    <div className="shrink-0 text-white/40 group-hover:text-white/80 transition-colors">
                                        <Filter size={10} />
                                    </div>
                                )}
                              </div>
                            )}
                          </button>
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
        <div className="space-y-8 animate-fade-in">
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
                    .sort((a,b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());

                if (monthBookings.length === 0) return null;

                return (
                    <div key={idx} className="glass-card overflow-hidden">
                        <div className="p-5 bg-white/5 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">{m.label}</h3>
                            <span className="text-[10px] text-slate-500 font-black uppercase bg-white/5 px-3 py-1 rounded-full">{monthBookings.length} RÉSERVATIONS</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5">
                                <th className="p-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Client</th>
                                <th className="p-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Chambre</th>
                                <th className="p-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Dates</th>
                                <th className="p-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Provenance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {monthBookings.map(booking => (
                                    <tr
                                    key={booking.id}
                                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                                    onClick={() => setSelectedBooking(booking)}
                                    >
                                    <td className="p-4">
                                        <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shadow-inner">
                                            <Users size={16} />
                                        </div>
                                        <span className="text-sm font-black text-white uppercase tracking-tight">{booking.guest_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-black text-indigo-300 text-sm">{booking.room_number}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-xs font-bold">
                                            <span className="text-emerald-400">{format(new Date(booking.check_in), 'dd MMM', { locale: fr })}</span>
                                            <ArrowRight size={12} className="text-slate-600" />
                                            <span className="text-red-400">{format(new Date(booking.check_out), 'dd MMM', { locale: fr })}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`text-[9px] px-3 py-1 rounded-full border font-black uppercase tracking-tighter ${booking.season.includes('ETE') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
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
          <div className="modal-box !max-w-md border-indigo-500/30 !p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-between">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <BedDouble size={24} />
                Détails
              </h2>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Client</p>
                <p className="text-xl font-black text-white uppercase tracking-tight">{selectedBooking.guest_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Chambre</p>
                  <p className="text-xl font-black text-indigo-400">{selectedBooking.room_number}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Personnes</p>
                  <p className="text-xl font-black text-white">{selectedBooking.persons || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Arrivée</p>
                  <p className="text-sm font-black text-white">{format(new Date(selectedBooking.check_in), 'dd MMMM yyyy', { locale: fr })}</p>
                </div>
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
                  <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-1">Départ</p>
                  <p className="text-sm font-black text-white">{format(new Date(selectedBooking.check_out), 'dd MMMM yyyy', { locale: fr })}</p>
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-2">Notes & Contact</p>
                  <p className="text-sm text-slate-300 leading-relaxed font-bold">{selectedBooking.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Saison de provenance</span>
                <span className={`text-[10px] px-3 py-1 rounded-full border font-black uppercase tracking-tighter ${selectedBooking.season.includes('ETE') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
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
