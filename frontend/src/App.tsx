import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute, DriverOnlyRoute, GuestOnly, ProtectedRoute } from './components/RouteGuards'
import { AppLayout } from './layouts/AppLayout'
import { PublicLayout } from './layouts/PublicLayout'

const Admin = lazy(() => import('./pages/Admin'))
const Book = lazy(() => import('./pages/Book'))
const BookingDetail = lazy(() => import('./pages/BookingDetail'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Discover = lazy(() => import('./pages/Discover'))
const FacilityDetail = lazy(() => import('./pages/FacilityDetail'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Profile = lazy(() => import('./pages/Profile'))
const Register = lazy(() => import('./pages/Register'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50" role="status" aria-label="Loading page">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
        </Route>

        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/discover" element={<Discover />} />
            <Route path="/facilities" element={<Navigate to="/discover" replace />} />
            <Route path="/facilities/:id" element={<FacilityDetail />} />
            <Route path="/book" element={<DriverOnlyRoute><Book /></DriverOnlyRoute>} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bookings/:id" element={<BookingDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
