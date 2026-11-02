import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../components/Logo'

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-[430px] space-y-3.5">
        {/* Top Header */}
        <div className="flex items-center justify-between px-1">
          <Logo />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </div>

        {/* Main Centered Auth Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          <div className="mt-1 text-xs text-slate-600 leading-relaxed">{subtitle}</div>

          <div className="mt-4">{children}</div>

          {footer && (
            <div className="mt-4 border-t border-slate-100 pt-3 text-center text-xs text-slate-600">
              {footer}
            </div>
          )}
        </div>

        {/* Subtle Bottom Footer */}
        <div className="text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} SmartPark Parking Management System
        </div>
      </div>
    </div>
  )
}
