import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Package,
  CalendarCheck,
  Calendar,
  TrendingDown,
  ClipboardList,
  Trash2,
  Wallet,
  Calculator,
  FileText,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/workers', icon: Users, label: 'Workers' },
  { path: '/work-types', icon: Briefcase, label: 'Work Types' },
  { path: '/fabrics', icon: Package, label: 'Fabric Stock' },
  { path: '/attendance', icon: CalendarCheck, label: 'Attendance' },
  { path: '/attendance-history', icon: Calendar, label: 'Attendance History' },
  { path: '/daily-usage', icon: TrendingDown, label: 'Daily Usage' },
  { path: '/assignments', icon: ClipboardList, label: 'Work Allocation' },
  { path: '/waste', icon: Trash2, label: 'Waste' },
  { path: '/weekly-wages', icon: Calculator, label: 'Weekly Wages' },
  { path: '/reports', icon: FileText, label: 'Reports' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-navy-50">
      {/* Sidebar - Glassmorphism */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 72 }}
        className="fixed left-0 top-0 z-40 h-screen bg-white/80 backdrop-blur-xl border-r border-slate-200/60 shadow-glass"
      >
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-slate-200/50">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy-950 to-indigo-700 flex items-center justify-center text-white font-bold text-sm">
                  FS
                </div>
                <span className="font-semibold text-navy-900">FabricSync</span>
              </motion.div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-navy-950 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900'
                  } ${!sidebarOpen ? 'justify-center' : ''}`
                }
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 260 : 72 }}
      >
        {/* Top navbar */}
        <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu size={24} />
            </button>
            <div className="flex-1" />
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-navy-700 flex items-center justify-center text-white font-medium">
                  {user?.name?.[0] || 'A'}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden z-20"
                    >
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-red-50 text-red-600"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
