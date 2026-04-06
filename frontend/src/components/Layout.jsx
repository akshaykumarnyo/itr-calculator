import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Calculator, MessageSquare, Home, IndianRupee, BarChart3, LogOut, User, LogIn, ChevronDown, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { logout } from '../utils/api'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/calculator', icon: Calculator, label: 'Calculator' },
  { to: '/chat', icon: MessageSquare, label: 'AI Assistant' },
  { to: '/result', icon: BarChart3, label: 'Results' },
]

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-heading font-bold text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#ff7514,#c7420a)' }}>
          {user.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
        </div>
        <ChevronDown size={14} className={clsx('text-slate-400 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 right-0 card p-2 z-50 space-y-1">
          {user.pan_number && (
            <div className="px-3 py-2 border-b border-white/[0.05] mb-1">
              <p className="text-[10px] text-slate-500">PAN</p>
              <p className="text-xs text-slate-300 font-mono">{user.pan_number}</p>
            </div>
          )}
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logoutUser } = useAuth()
  const nav = useNavigate()

  const handleLogout = async () => {
    try { await logout() } catch { }
    logoutUser()
    toast.success('Signed out')
    nav('/auth')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col border-r border-white/[0.05]"
        style={{ background: 'rgba(4,10,21,0.97)' }}>

        {/* Logo */}
        <div className="p-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#ff7514,#c7420a)', boxShadow: '0 4px 12px rgba(255,117,20,0.3)' }}>
              <IndianRupee size={18} className="text-white" />
            </div>
            <div>
              <p className="font-heading font-bold text-white text-sm leading-tight">ITR Calculator</p>
              <p className="text-[10px] text-slate-500 mt-0.5">AI Tax Assistant</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200',
                isActive ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              )}
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(135deg,rgba(255,117,20,0.18),rgba(199,66,10,0.1))',
                border: '1px solid rgba(255,117,20,0.18)',
              } : {}}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Cache badge */}
        <div className="px-4 mb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <Zap size={12} className="text-jade-400" />
            <div>
              <p className="text-[10px] text-jade-400 font-medium">Redis Cache Active</p>
              <p className="text-[9px] text-slate-500">SSE Streaming · gTTS Output</p>
            </div>
          </div>
        </div>

        {/* User section */}
        <div className="p-4 border-t border-white/[0.05]">
          {user ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <button onClick={() => nav('/auth')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-saffron-500/30 text-saffron-400 hover:bg-saffron-500/10 transition-all text-sm">
              <LogIn size={15} />
              Sign In / Register
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.05]"
          style={{ background: 'rgba(4,10,21,0.97)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#ff7514,#c7420a)' }}>
              <IndianRupee size={14} className="text-white" />
            </div>
            <span className="font-heading font-bold text-sm text-white">ITR Calculator</span>
          </div>
          <div className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => clsx(
                  'w-8 h-8 flex items-center justify-center rounded-lg transition-all',
                  isActive ? 'text-saffron-400' : 'text-slate-500'
                )}>
                <Icon size={15} />
              </NavLink>
            ))}
            <button onClick={() => nav(user ? '#' : '/auth')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400">
              {user ? <User size={15} /> : <LogIn size={15} />}
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
