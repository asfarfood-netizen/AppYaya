import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import TasksPage from './pages/TasksPage'
import AdminPanel from './pages/AdminPanel'
import LogsPage from './pages/LogsPage'
import HistoryPage from './pages/HistoryPage'

function RequireAuth({ children, roles = [] }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-slate-500">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (roles.length > 0 && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Main content area */}
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 md:p-8 pt-16 md:pt-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user, profile } = useAuth()

  return (
    <Routes>
      {/* Public route */}
      <Route 
        path="/login" 
        element={user && profile ? <Navigate to="/" replace /> : <LoginPage />} 
      />

      {/* Protected routes */}
      <Route path="/" element={
        <RequireAuth>
          <MainLayout><Dashboard /></MainLayout>
        </RequireAuth>
      } />

      <Route path="/tasks" element={
        <RequireAuth>
          <MainLayout><TasksPage /></MainLayout>
        </RequireAuth>
      } />

      <Route path="/history" element={
        <RequireAuth roles={['admin', 'reception']}>
          <MainLayout><HistoryPage /></MainLayout>
        </RequireAuth>
      } />

      <Route path="/admin" element={
        <RequireAuth roles={['admin']}>
          <MainLayout><AdminPanel /></MainLayout>
        </RequireAuth>
      } />

      <Route path="/logs" element={
        <RequireAuth roles={['admin']}>
          <MainLayout><LogsPage /></MainLayout>
        </RequireAuth>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
