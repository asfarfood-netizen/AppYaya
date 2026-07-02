import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Users, ScrollText, BarChart3,
  LogOut, Menu, X, Wifi, Calendar, Palette
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { ROLE_LABELS } from '../constants'
const NAV_ITEMS = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard',    roles: ['admin','reception','gouvernante','entretien'] },
  { path: '/tasks',     icon: CheckSquare,     label: 'Tâches',       roles: ['admin','reception','gouvernante','entretien'] },
  { path: '/planning',  icon: Calendar,        label: 'Planning',     roles: ['admin','reception'] },
  { path: '/history',   icon: BarChart3,       label: 'Statistiques', roles: ['admin','reception'] },
  { path: '/admin',     icon: Users,           label: 'Admin',        roles: ['admin'] },
  { path: '/logs',      icon: ScrollText,      label: 'Historique',   roles: ['admin'] },
]
export default function Sidebar({ open, onToggle }) {
  const { profile, signOut } = useAuth()
  const { currentTheme, setTheme, themes } = useTheme()
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
        w-64 border-r border-white/10
        flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="group cursor-pointer">
              <h1 className="font-black text-white text-xl tracking-tighter leading-none group-hover:scale-105 transition-transform">
                YASMINA
              </h1>
              <p className="text-indigo-400 font-bold text-[10px] tracking-[0.2em] uppercase mt-1">
                Résidence
              </p>
            </div>
            {/* Realtime indicator */}
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full realtime-dot" />
              <Wifi size={10} className="text-emerald-400" />
            </div>
          </div>
        </div>
        {/* User profile */}
        <div className="p-4 mx-3 my-4 bg-white/[0.03] rounded-2xl border border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-lg">
              {roleInfo?.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile?.full_name || 'Utilisateur'}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                {roleInfo?.label}
              </p>
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
        {/* Theme Selector */}
        <div className="px-6 py-4 border-t border-white/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Palette size={12} />
            Thème
          </p>
          <div className="flex items-center gap-3">
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  currentTheme === key ? 'border-indigo-500 scale-110 shadow-lg shadow-indigo-500/20' : 'border-white/10 hover:border-white/30'
                }`}
                style={{ backgroundColor: theme.bg }}
                title={theme.label}
              />
            ))}
          </div>
        </div>
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
