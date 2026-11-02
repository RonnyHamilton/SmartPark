import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, Building2, Car, Compass, LayoutDashboard, LogOut, Menu, Plus,
  ShieldCheck, Ticket, UserRound, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'

const userNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/discover', label: 'Find Parking', icon: Compass },
  { to: '/book', label: 'New Booking', icon: Plus },
  { to: '/profile?tab=vehicles', label: 'My Vehicles', icon: Car },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export function AppLayout() {
  const { user, logout, isAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  const signOut = async () => {
    await logout()
    navigate('/login')
  }

  const adminNavItems = [
    { to: '/admin?tab=overview', label: 'Operations Overview', icon: LayoutDashboard },
    { to: '/admin?tab=facilities', label: 'Facilities & Bays', icon: Building2 },
    { to: '/admin?tab=bookings', label: 'All Reservations', icon: Ticket },
    { to: '/admin?tab=users', label: 'Users Directory', icon: Users },
    { to: '/admin?tab=audit', label: 'System Audit Log', icon: Activity },
    { to: '/profile', label: 'Admin Profile', icon: UserRound },
  ]

  const driverNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/discover', label: 'Find Parking', icon: Compass },
    { to: '/book', label: 'New Booking', icon: Plus },
    { to: '/profile?tab=vehicles', label: 'My Vehicles', icon: Car },
    { to: '/profile', label: 'Profile', icon: UserRound },
  ]

  const renderNavLinks = () => (
    <div className="flex flex-1 flex-col gap-6">
      {isAdmin ? (
        <div>
          <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Administration Console</p>
          <div className="space-y-1">
            {adminNavItems.map((item) => {
              const tabParam = new URLSearchParams(item.to.split('?')[1] ?? '').get('tab')
              const currentTab = new URLSearchParams(location.search).get('tab') ?? 'overview'
              const isProfile = item.to === '/profile'
              const isActive = isProfile
                ? location.pathname === '/profile'
                : location.pathname === '/admin' && (tabParam === currentTab || (!location.search && tabParam === 'overview'))

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold border-l-2 border-brand-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-600' : 'text-slate-500')} aria-hidden />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </div>
      ) : (
        <div>
          <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Navigation</p>
          <div className="space-y-1">
            {driverNavItems.map((item) => {
              const isVehicleLink = item.to.includes('tab=vehicles')
              const isActive = isVehicleLink
                ? location.pathname === '/profile' && location.search.includes('tab=vehicles')
                : location.pathname === item.to && !location.search.includes('tab=vehicles')

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold border-l-2 border-brand-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-600' : 'text-slate-500')} aria-hidden />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  const renderUserProfile = () => (
    <div className="border-t border-slate-200 pt-3">
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 border border-brand-200 text-xs font-bold text-brand-700">
          {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-900">{user?.name}</p>
          <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 px-1">
        <Link
          to="/profile"
          className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          Account
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          title="Sign out"
        >
          <LogOut className="h-3 w-3" />
          <span>Exit</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 pb-3 pt-5 lg:flex">
        <div className="px-3 pb-4">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col overflow-y-auto pt-2 scrollbar-thin">
          {renderNavLinks()}
        </nav>
        {renderUserProfile()}
      </aside>

      {/* Main Container */}
      <div className="lg:pl-60">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="lg:hidden">
                <Logo />
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                Smart parking management system
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isAdmin && (
                <Link to="/book">
                  <Button size="sm" icon={Plus}>
                    New reservation
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 sm:inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                  Admin Console
                </span>
              )}
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-800">
                  {user?.name?.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[100px] truncate sm:inline">{user?.name?.split(' ')[0]}</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="relative flex h-full w-64 flex-col border-r border-slate-200 bg-white p-4 shadow-lift"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between pb-4">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col overflow-y-auto pt-2 scrollbar-thin">
                {renderNavLinks()}
              </nav>
              {renderUserProfile()}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
