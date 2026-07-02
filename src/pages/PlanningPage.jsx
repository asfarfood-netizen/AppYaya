import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { syncAllBookings } from '../services/bookingSync';
import { Calendar, RefreshCw, Search, Users, BedDouble } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PlanningPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('check_in', { ascending: true });

    if (data) setBookings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAllBookings();
      await fetchBookings();
    } catch (e) {
      alert('Erreur lors de la synchronisation : ' + e.message);
    } finally {
      setSyncing(false);
    }
  }

  const filtered = bookings.filter(b =>
    b.guest_name.toLowerCase().includes(search.toLowerCase()) ||
    b.room_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Calendar className="text-indigo-400" />
            Planning & Réservations
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Synchronisé avec Google Sheets</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-primary"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
        <Search size={18} className="text-slate-500" />
        <input
          type="text"
          placeholder="Rechercher un client ou une chambre..."
          className="bg-transparent border-none outline-none text-white w-full text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-sm">Chargement du planning...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Calendar className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Aucune réservation</p>
            <p className="text-sm mt-1">Synchronisez avec Google Sheets pour importer les données.</p>
          </div>
        ) : (
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
                {filtered.map(booking => (
                  <tr key={booking.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-indigo-400" />
                        <span className="text-sm font-bold text-white uppercase">{booking.guest_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <BedDouble size={14} className="text-slate-500" />
                        <span className="text-sm font-medium text-slate-300">{booking.room_number}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-slate-400">
                        {format(new Date(booking.check_in), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-slate-400">
                        {format(new Date(booking.check_out), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        booking.season.includes('ETE')
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}>
                        {booking.season}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
