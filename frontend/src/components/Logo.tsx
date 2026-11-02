import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'

export function Logo({ variant = 'light', compact = false, className }: { variant?: 'light' | 'dark'; compact?: boolean; className?: string }) {
  const isDark = variant === 'dark'
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-2.5 select-none', className)} aria-label="SmartPark home">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white shadow-sm transition group-hover:bg-brand-700">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden>
          <path d="M7 21V3h6.5C17.6 3 20 5.4 20 9s-2.4 6-6.5 6H11v6H7Zm4-9.5h2.2c1.9 0 3-.9 3-2.5s-1.1-2.5-3-2.5H11v5Z" />
        </svg>
      </span>
      {!compact && (
        <span className={cn('text-base font-semibold tracking-tight', isDark ? 'text-white' : 'text-slate-900')}>
          Smart<span className="text-brand-600">Park</span>
        </span>
      )}
    </Link>
  )
}
