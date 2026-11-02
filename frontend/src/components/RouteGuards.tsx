import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950">
      <Logo />
      <Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-label="Loading" />
    </div>
  )
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, initializing, isAdmin } = useAuth()
  if (initializing) return <Splash />
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />
  return <>{children}</>
}

export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <Splash />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function AdminRoute() {
  const { isAuthenticated, isAdmin, initializing } = useAuth()
  if (initializing) return <Splash />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function DriverOnlyRoute({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isAdmin, initializing } = useAuth()
  if (initializing) return <Splash />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  return children ? <>{children}</> : <Outlet />
}
