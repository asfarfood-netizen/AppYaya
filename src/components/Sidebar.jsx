import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Users, ScrollText, BarChart3,
  LogOut, Menu, X, Wifi
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../constants'

const NAV_ITEMS = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard',    roles: ['admin','reception','gouvernante','entretien'] },
  { path: '/tasks',     icon: CheckSquare,     label: 'Tâches',       roles: ['admin','reception','gouvernante','entretien'] },
  { path: '/history',   icon: BarChart3,       label: 'Statistiques', roles: ['admin','reception'] },
  { path: '/admin',     icon: Users,           label: 'Admin',        roles: ['admin'] },
  { path: '/logs',      icon: ScrollText,      label: 'Historique',   roles: ['admin'] },
]

export default function Sidebar({ open, onToggle }) {
  const { profile, signOut } = useAuth()
  const navigate   = useNavigate()
  const { pathname } = useLocation()

  const role     = profile?.role || 'reception'
  const roleInfo = ROLE_LABELS[role]

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))

  function go(path) {
    navigate(path)
    if (window.innerWidth < 768) onToggle()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-40
        w-64 bg-[#0d1117] border-r border-white/10
        flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-extrabold text-white text-lg leading-tight">
                🏨 Résidence
              </h1>
              <p className="text-gradient font-bold text-sm">Yasmina</p>
            </div>
            {/* Realtime indicator */}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-400 rounded-full realtime-dot" />
              <Wifi size={12} className="text-emerald-400" />
            </div>
          </div>
        </div>

        {/* User profile */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center text-base">
              {roleInfo?.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'Utilisateur'}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${roleInfo?.badge}`}>
                {roleInfo?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`nav-item w-full ${active ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={signOut}
            className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut size={18} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 md:hidden p-2.5 bg-slate-800 border border-white/10 rounded-xl shadow-lg"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
    </>
  )
}
