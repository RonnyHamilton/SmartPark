import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'

export function PublicLayout() {
  const { isAuthenticated, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-xs font-medium md:flex">
            <NavLink to="/discover" className="text-slate-600 transition hover:text-slate-900">
              Find Parking
            </NavLink>
            <a href="/#how-it-works" className="text-slate-600 transition hover:text-slate-900">
              How It Works
            </a>
            <a href="/#facilities" className="text-slate-600 transition hover:text-slate-900">
              Locations
            </a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm">Admin Console</Button>
                  </Link>
                )}
                <Link to="/dashboard">
                  <Button variant="primary" size="sm">Dashboard</Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">Create Account</Button>
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-200 bg-white md:hidden"
            >
              <div className="flex flex-col gap-1 px-4 py-3">
                <Link to="/discover" className="rounded-md px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>Find Parking</Link>
                <a href="/#how-it-works" className="rounded-md px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>How It Works</a>
                <a href="/#facilities" className="rounded-md px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>Locations</a>
                <div className="mt-2 flex gap-2 pt-2 border-t border-slate-100">
                  {isAuthenticated ? (
                    <Button className="flex-1" size="sm" onClick={() => { setOpen(false); navigate('/dashboard') }}>Dashboard</Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setOpen(false); navigate('/login') }}>Sign In</Button>
                      <Button size="sm" className="flex-1" onClick={() => { setOpen(false); navigate('/register') }}>Create Account</Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <Outlet />
    </div>
  )
}
