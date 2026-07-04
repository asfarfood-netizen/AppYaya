import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { syncBookingsFromFiles } from '../services/bookingSync';
import { SEASONS_CONFIG } from '../constants';
import {
  Calendar, RefreshCw, Users, BedDouble, FileText, X, Search,
  ChevronDown, ArrowRight, LayoutGrid, List, Clock, Hotel, Info,
  Upload, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import {
  format, eachDayOfInterval, isSameDay, addDays,
  isToday, startOfMonth, endOfMonth, differenceInDays
} from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY_WIDTH = 56;
const ROOM_COL_WIDTH = 152;

function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function clampDate(date, start, end) {
  if (date < start) return start;
  if (date > end) return end;
  return date;
}

function nightsBetween(start, end) {
  return Math.max(1, differenceInDays(end, start));
}

function SyncModal({ isOpen, onClose, onComplete, profile }) {
  const [summerFile, setSummerFile] = useState(null);
  const [winterFile, setWinterFile] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleStartSync() {
    if (!summerFile || !winterFile) return;
    setSyncing(true);
    setError(null);
    try {
      await syncBookingsFromFiles({
        summer: { file: summerFile, seasonId: 'ETE 2026' },
        winter: { file: winterFile, seasonId: 'HIVER 2026/27' }
      }, (p, msg) => {
        setProgress(p);
        setStatus(msg);
      });
      setTimeout(() => {
        onComplete();
        onClose();
      }, 1000);
    } catch (e) {
      setError(e.message);
      setSyncing(false);
    }
  }

  const FileSlot = ({ label, file, setFile, icon: Icon }) => (
    <div className={`relative group p-4 rounded-xl border-2 border-dashed transition-all ${
      file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-500/50 hover:bg-white/5'
    }`}>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={e => setFile(e.target.files[0])}
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
      />
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          file ? 'bg-emerald-500 text-emerald-950' : 'bg-white/10 text-slate-400 group-hover:text-cyan-400'
        }`}>
          {file ? <CheckCircle2 size={20} /> : <Icon size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-sm font-bold text-white truncate">{file ? file.name : 'Sélectionner le fichier...'}</p>
        </div>
        {!syncing && file && (
          <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="relative z-20 p-1 hover:bg-red-500/20 rounded-md text-red-400">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={() => !syncing && onClose()}>
      <div className="modal-box !max-w-lg !p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black uppercase flex items-center gap-2">
              <RefreshCw className={syncing ? 'animate-spin' : ''} />
              Synchronisation Excel
            </h2>
            {!syncing && <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>}
          </div>
          <p className="text-cyan-100 text-xs font-bold uppercase tracking-wider">Mise à jour complète des saisons Été et Hiver</p>
        </div>

        <div className="p-6 space-y-6">
          {!syncing ? (
            <>
              <div className="space-y-3">
                <FileSlot label="Saison Été 2026" file={summerFile} setFile={setSummerFile} icon={Upload} />
                <FileSlot label="Saison Hiver 2026/27" file={winterFile} setFile={setWinterFile} icon={Upload} />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button
                onClick={handleStartSync}
                disabled={!summerFile || !winterFile}
                className="w-full py-4 rounded-xl bg-cyan-500 text-slate-950 font-black uppercase tracking-[0.2em] shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Lancer la synchronisation
              </button>
            </>
          ) : (
            <div className="py-8 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin"
                  style={{ animationDuration: '1.5s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">
                  {progress}%
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-white font-black uppercase tracking-widest">{status}</p>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanningPage() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSync, setShowSync] = useState(false);
  const [currentSeasonId, setCurrentSeasonId] = useState(SEASONS_CONFIG[0].id);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [lastSync, setLastSync] = useState(localStorage.getItem('last_booking_sync'));
  const scrollContainerRef = useRef(null);

  const isAdmin = profile?.role === 'admin';

  const currentSeason = useMemo(
    () => SEASONS_CONFIG.find((season) => season.id === currentSeasonId),
    [currentSeasonId]
  );

  const seasonEndExclusive = useMemo(() => addDays(currentSeason.end, 1), [currentSeason]);

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
    const bookingSub = supabase.channel('bookings-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings).subscribe();
    return () => supabase.removeChannel(bookingSub);
  }, [fetchRooms, fetchBookings]);

  const days = useMemo(() => eachDayOfInterval({ start: currentSeason.start, end: currentSeason.end }), [currentSeason]);

  const monthsInSeason = useMemo(() => {
    const months = [];
    let current = startOfMonth(currentSeason.start);
    const end = endOfMonth(currentSeason.end);
    while (current <= end) {
      const monthStart = current > currentSeason.start ? current : currentSeason.start;
      const monthEnd = endOfMonth(current) < currentSeason.end ? endOfMonth(current) : currentSeason.end;
      months.push({ label: format(current, 'MMMM yyyy', { locale: fr }), daysCount: differenceInDays(monthEnd, monthStart) + 1, start: monthStart, end: monthEnd });
      current = addDays(endOfMonth(current), 1);
    }
    return months;
  }, [currentSeason]);

  const seasonBookings = useMemo(() => {
    return bookings
      .filter((booking) => booking.season === currentSeason.id)
      .map((booking) => ({ ...booking, checkInDate: parseLocalDate(booking.check_in), checkOutDate: parseLocalDate(booking.check_out) }))
      .filter((booking) => booking.checkInDate < seasonEndExclusive && booking.checkOutDate > currentSeason.start);
  }, [bookings, currentSeason, seasonEndExclusive]);

  const indexedBookings = useMemo(() => {
    const index = {};
    seasonBookings.forEach((booking) => {
      if (!index[booking.room_number]) index[booking.room_number] = [];
      index[booking.room_number].push(booking);
    });
    Object.values(index).forEach((roomBookings) => roomBookings.sort((a, b) => a.checkInDate - b.checkInDate));
    return index;
  }, [seasonBookings]);

  const query = search.trim().toLowerCase();
  const roomRows = useMemo(() => {
    return rooms
      .map((room) => {
        const roomBookings = indexedBookings[room.number] || [];
        const matchesRoom = query && room.number.toString().toLowerCase().includes(query);
        const matchesBooking = query && roomBookings.some((booking) => booking.guest_name.toLowerCase().includes(query));
        return {
          room, bookings: roomBookings, visible: !query || matchesRoom || matchesBooking,
          occupancy: roomBookings.reduce((total, booking) => {
            const start = clampDate(booking.checkInDate, currentSeason.start, seasonEndExclusive);
            const end = clampDate(booking.checkOutDate, currentSeason.start, seasonEndExclusive);
            return total + nightsBetween(start, end);
          }, 0)
        };
      })
      .filter((row) => row.visible);
  }, [rooms, indexedBookings, query, currentSeason.start, seasonEndExclusive]);

  const stats = useMemo(() => {
    const arrivingToday = seasonBookings.filter((booking) => isSameDay(booking.checkInDate, new Date())).length;
    const leavingToday = seasonBookings.filter((booking) => isSameDay(booking.checkOutDate, new Date())).length;
    const occupiedNights = roomRows.reduce((sum, row) => sum + row.occupancy, 0);
    const capacity = Math.max(1, rooms.length * days.length);
    return { bookings: seasonBookings.length, rooms: roomRows.length, occupancy: Math.round((occupiedNights / capacity) * 100), todayFlow: arrivingToday + leavingToday };
  }, [seasonBookings, roomRows, rooms.length, days.length]);

  const scrollToToday = useCallback(() => {
    if (scrollContainerRef.current) {
      const todayIdx = days.findIndex((day) => isSameDay(day, new Date()));
      if (todayIdx !== -1) scrollContainerRef.current.scrollLeft = (todayIdx * DAY_WIDTH) - (scrollContainerRef.current.clientWidth / 2) + ROOM_COL_WIDTH;
    }
  }, [days]);

  useEffect(() => {
    if (!loading && view === 'grid') {
      const timeout = setTimeout(scrollToToday, 350);
      return () => clearTimeout(timeout);
    }
  }, [loading, view, currentSeasonId, scrollToToday]);

  const renderBookingBar = (booking) => {
    const visibleStart = clampDate(booking.checkInDate, currentSeason.start, currentSeason.end);
    const visibleEnd = clampDate(booking.checkOutDate, currentSeason.start, seasonEndExclusive);
    const startIdx = differenceInDays(visibleStart, currentSeason.start);
    const span = nightsBetween(visibleStart, visibleEnd);
    const isMatch = query && (booking.guest_name.toLowerCase().includes(query) || booking.room_number.toString().toLowerCase().includes(query));
    const isSelected = selectedBooking?.id === booking.id;
    const summer = booking.season.includes('ETE');

    return (
      <button
        key={booking.id}
        onClick={() => setSelectedBooking(booking)}
        className={`absolute top-2.5 z-20 h-10 min-w-10 overflow-hidden rounded-md border px-2 text-left shadow-lg transition-all
          ${summer ? 'border-cyan-300/50 bg-cyan-500/80 text-cyan-950' : 'border-sky-300/50 bg-sky-500/80 text-sky-950'}
          ${isMatch || isSelected ? 'ring-2 ring-white brightness-110' : 'hover:brightness-110 hover:-translate-y-0.5'}
        `}
        style={{ left: startIdx * DAY_WIDTH + 4, width: Math.max(DAY_WIDTH - 8, span * DAY_WIDTH - 8) }}
      >
        <div className="flex h-full items-center gap-2 whitespace-nowrap">
          {booking.persons && <span className="inline-flex shrink-0 items-center gap-1 rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-black"><Users size={11} />{booking.persons}</span>}
          <span className="truncate text-[11px] font-black uppercase tracking-normal">{booking.guest_name}</span>
          {booking.notes && <Info size={12} className="shrink-0 opacity-70" />}
        </div>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-[1800px] space-y-5">
      <div className="flex flex-col gap-4 px-1 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"><Calendar size={24} /></div>
            <div>
              <h1 className="text-3xl font-black uppercase leading-none text-white">Planning</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-cyan-300">{currentSeason.label}</span>
                {lastSync && <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"><Clock size={11} />Synchro {format(new Date(lastSync), 'dd MMM HH:mm', { locale: fr })}</span>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[ { label: 'Reservations', value: stats.bookings, icon: FileText }, { label: 'Chambres', value: stats.rooms, icon: Hotel }, { label: 'Occupation', value: `${stats.occupancy}%`, icon: BedDouble }, { label: "Aujourd'hui", value: stats.todayFlow, icon: Calendar }].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><item.icon size={12} />{item.label}</div>
                <div className="mt-1 text-lg font-black text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select value={currentSeasonId} onChange={(e) => setCurrentSeasonId(e.target.value)} className="h-11 appearance-none rounded-lg border border-white/10 bg-[#121722] pl-3 pr-9 text-xs font-black uppercase text-white outline-none transition hover:bg-white/10 focus:border-cyan-400">
              {SEASONS_CONFIG.map((season) => <option key={season.id} value={season.id}>{season.label}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input type="text" placeholder="Client ou chambre" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 w-52 rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 md:w-64" />
          </div>
          <div className="flex h-11 rounded-lg border border-white/10 bg-white/[0.04] p-1">
            <button onClick={() => setView('grid')} className={`inline-flex items-center gap-2 rounded-md px-3 text-xs font-black uppercase transition ${view === 'grid' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}><LayoutGrid size={14} />Grille</button>
            <button onClick={() => setView('list')} className={`inline-flex items-center gap-2 rounded-md px-3 text-xs font-black uppercase transition ${view === 'list' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}><List size={14} />Liste</button>
          </div>
          {isAdmin && (
            <button onClick={() => setShowSync(true)} className="btn-primary !h-11 !rounded-lg !bg-cyan-500 !px-4 !py-0 !text-xs !text-slate-950 hover:!bg-cyan-400">
              <RefreshCw size={15} /> Sync Excel
            </button>
          )}
        </div>
      </div>

      {view === 'grid' && (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0d1117] shadow-2xl">
          <button onClick={scrollToToday} className="fixed bottom-8 right-8 z-50 inline-flex h-12 items-center gap-2 rounded-lg border border-white/20 bg-cyan-500 px-4 text-xs font-black uppercase text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.25)] transition hover:bg-cyan-400 active:scale-95"><Calendar size={18} />Aujourd'hui</button>
          <div ref={scrollContainerRef} className="custom-scrollbar max-h-[76vh] overflow-auto scroll-smooth">
            <div style={{ width: ROOM_COL_WIDTH + days.length * DAY_WIDTH }}>
              <div className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur">
                <div className="flex border-b border-white/10">
                  <div className="sticky left-0 z-50 flex shrink-0 items-center border-r border-white/10 bg-[#0d1117] px-4 text-[10px] font-black uppercase tracking-widest text-slate-500" style={{ width: ROOM_COL_WIDTH }}>Chambre</div>
                  <div className="flex">{monthsInSeason.map((month) => <div key={month.label} className="border-r border-white/10 py-3 text-center text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300" style={{ width: month.daysCount * DAY_WIDTH }}>{month.label}</div>)}</div>
                </div>
                <div className="flex border-b border-white/10">
                  <div className="sticky left-0 z-50 shrink-0 border-r border-white/10 bg-[#0d1117]" style={{ width: ROOM_COL_WIDTH }} />
                  <div className="flex">{days.map((day) => (
                    <div key={day.toISOString()} className={`h-14 border-r border-white/[0.06] px-1 text-center ${isToday(day) ? 'bg-cyan-400/15' : ''}`} style={{ width: DAY_WIDTH }}>
                      <div className="pt-2 text-[9px] font-black uppercase text-slate-600">{format(day, 'EEE', { locale: fr })}</div>
                      <div className={`text-base font-black ${isToday(day) ? 'text-cyan-200' : 'text-slate-300'}`}>{format(day, 'd')}</div>
                    </div>
                  ))}</div>
                </div>
              </div>
              <div>
                {loading ? <div className="flex h-64 items-center justify-center text-slate-500"><RefreshCw className="animate-spin" size={28} /></div> : roomRows.map(({ room, bookings: roomBookings }) => (
                  <div key={room.number} className="group flex min-h-[58px] border-b border-white/[0.05] hover:bg-white/[0.025]">
                    <div className="sticky left-0 z-30 flex shrink-0 items-center justify-between border-r border-white/10 bg-[#0d1117] px-4 shadow-[6px_0_18px_rgba(0,0,0,0.35)] group-hover:bg-[#111827]" style={{ width: ROOM_COL_WIDTH }}>
                      <div><div className="text-sm font-black text-white">{room.number}</div><div className="text-[9px] font-black uppercase tracking-widest text-slate-600">Etage {room.floor}</div></div>
                      <div className="rounded bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">{roomBookings.length}</div>
                    </div>
                    <div className="relative h-[58px]" style={{ width: days.length * DAY_WIDTH }}>
                      <div className="absolute inset-0 flex">{days.map((day) => <div key={day.toISOString()} className={`h-full border-r border-white/[0.035] ${isToday(day) ? 'bg-cyan-400/[0.07]' : ''}`} style={{ width: DAY_WIDTH }} />)}</div>
                      {roomBookings.map(renderBookingBar)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-4 animate-fade-in">
          {monthsInSeason.map((month) => {
            const monthBookings = seasonBookings.filter((booking) => {
              const matchesSearch = !query || booking.guest_name.toLowerCase().includes(query) || booking.room_number.toString().toLowerCase().includes(query);
              return matchesSearch && booking.checkInDate <= month.end && booking.checkOutDate >= month.start;
            }).sort((a, b) => a.checkInDate - b.checkInDate);
            if (monthBookings.length === 0) return null;
            return (
              <div key={month.label} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] p-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{month.label}</h3>
                  <span className="rounded border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase text-slate-400">{monthBookings.length} reservations</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead><tr className="border-b border-white/5"><th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Client</th><th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Chambre</th><th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Dates</th><th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-600">Source</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.04]">{monthBookings.map((booking) => (
                      <tr key={booking.id} className="cursor-pointer transition hover:bg-white/5" onClick={() => setSelectedBooking(booking)}>
                        <td className="p-4 text-sm font-black uppercase text-white">{booking.guest_name}</td>
                        <td className="p-4 text-sm font-black text-cyan-300">{booking.room_number}</td>
                        <td className="p-4"><div className="flex items-center gap-2 text-xs font-bold"><span className="text-emerald-300">{format(booking.checkInDate, 'dd MMM', { locale: fr })}</span><ArrowRight size={12} className="text-slate-600" /><span className="text-rose-300">{format(booking.checkOutDate, 'dd MMM', { locale: fr })}</span></div></td>
                        <td className="p-4 text-right"><span className="rounded border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[9px] font-black uppercase text-cyan-300">{booking.season}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal-box !max-w-md !overflow-hidden !rounded-lg !p-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-cyan-500 p-5 text-slate-950"><h2 className="flex items-center gap-2 text-lg font-black uppercase"><BedDouble size={22} />Details</h2><button onClick={() => setSelectedBooking(null)} className="rounded-md p-2 transition hover:bg-black/10"><X size={20} /></button></div>
            <div className="space-y-4 p-6">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Client</p><p className="text-xl font-black uppercase text-white">{selectedBooking.guest_name}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Chambre</p><p className="text-xl font-black text-cyan-300">{selectedBooking.room_number}</p></div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Personnes</p><p className="text-xl font-black text-white">{selectedBooking.persons || '-'}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4"><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">Arrivee</p><p className="text-sm font-black text-white">{format(parseLocalDate(selectedBooking.check_in), 'dd MMMM yyyy', { locale: fr })}</p></div>
                <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-4"><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-rose-300">Depart</p><p className="text-sm font-black text-white">{format(parseLocalDate(selectedBooking.check_out), 'dd MMMM yyyy', { locale: fr })}</p></div>
              </div>
              {selectedBooking.notes && <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-300">Notes & contact</p><p className="text-sm font-bold leading-relaxed text-slate-300">{selectedBooking.notes}</p></div>}
            </div>
          </div>
        </div>
      )}

      <SyncModal
        isOpen={showSync}
        onClose={() => setShowSync(false)}
        onComplete={() => { setLastSync(new Date().toISOString()); fetchBookings(); }}
        profile={profile}
      />
    </div>
  );
}
