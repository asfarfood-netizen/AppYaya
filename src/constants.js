// Centralized room & task status helpers
export const ROOM_STATUS = {
  libre:          { label: 'Libre',          color: '#10B981', bg: 'bg-emerald-500', text: 'text-emerald-400', emoji: '🟢', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  occupe:         { label: 'Occupée',        color: '#3B82F6', bg: 'bg-blue-500',    text: 'text-blue-400',    emoji: '🔵', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  en_preparation: { label: 'En préparation', color: '#F59E0B', bg: 'bg-amber-500',   text: 'text-amber-400',   emoji: '🟡', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  non_nettoyee:   { label: 'Non nettoyée',   color: '#EF4444', bg: 'bg-red-500',     text: 'text-red-400',     emoji: '🔴', badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  bloquee:        { label: 'Bloquée',        color: '#4B5563', bg: 'bg-gray-600',    text: 'text-gray-400',    emoji: '⚫', badge: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
  special:        { label: 'Spéciale',       color: '#8B5CF6', bg: 'bg-purple-500',  text: 'text-purple-400',  emoji: '🟣', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
}

export const TASK_TYPE = {
  menage:     { label: 'Ménage',      color: '#06B6D4', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',    icon: '🧹' },
  reparation: { label: 'Réparation', color: '#92400E', badge: 'bg-amber-900/30 text-amber-300 border-amber-700/40', icon: '🔧' },
  reception:  { label: 'Réception',  color: '#4F46E5', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: '🛎️' },
}

export const TASK_STATUS = {
  en_attente: { label: 'En attente', badge: 'bg-yellow-500/20 text-yellow-300' },
  en_cours:   { label: 'En cours',   badge: 'bg-blue-500/20 text-blue-300' },
  terminee:   { label: 'Terminée',   badge: 'bg-green-500/20 text-green-300' },
  annulee:    { label: 'Annulée',    badge: 'bg-gray-500/20 text-gray-300' },
}

export const ROLE_LABELS = {
  admin:       { label: 'Directeur',  badge: 'bg-purple-500/20 text-purple-300', icon: '👑' },
  reception:   { label: 'Réception',  badge: 'bg-blue-500/20 text-blue-300',     icon: '🛎️' },
  gouvernante: { label: 'Gouvernante', badge: 'bg-emerald-500/20 text-emerald-300', icon: '🧹' },
  entretien:   { label: 'Entretien',  badge: 'bg-amber-500/20 text-amber-300',   icon: '🔧' },
}

// Which statuses can each role assign?
export const ROLE_ALLOWED_STATUSES = {
  admin:       ['libre','occupe','en_preparation','non_nettoyee','bloquee','special'],
  reception:   ['occupe','non_nettoyee','special','libre'],
  gouvernante: ['en_preparation','libre'],
  entretien:   ['bloquee','libre'],
}

// All floors present in the hotel
export const ALL_FLOORS = ['1','2','3','4','5','6','11','12','13','14','15','16','Annexe']

export const SEASONS_CONFIG = [
  {
    id: 'ETE 2026',
    label: 'Été 2026',
    start: new Date(2026, 4, 1), // May 1st
    end: new Date(2026, 9, 31),   // Oct 31st
    color: 'indigo'
  },
  {
    id: 'HIVER 2026/27',
    label: 'Hiver 2026/27',
    start: new Date(2026, 10, 1), // Nov 1st
    end: new Date(2027, 3, 30),   // Apr 30th
    color: 'blue'
  }
];
