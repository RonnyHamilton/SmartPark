import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { errorMessage } from '../lib/errors'
import { Button } from './ui'

export function PageHeader({ eyebrow, title, description, actions, backTo, backLabel }: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="mb-6">
      {backTo && (
        <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[26px]">{title}</h1>
          {description && <div className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function SectionHeading({ title, description, action }: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorPanel({ error, onRetry, title = 'Could not load this view', compact = false }: {
  error: unknown
  onRetry?: () => void
  title?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50/50 text-center', compact ? 'p-5' : 'p-8')}>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
        <AlertCircle className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-rose-900">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-rose-700">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3.5 border-rose-200 bg-white text-rose-800 hover:bg-rose-50" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function InlineError({ error }: { error: unknown }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{errorMessage(error)}</span>
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> {label}
    </div>
  )
}

export function Pagination({ page, totalPages, onChange, totalElements }: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  totalElements?: number
}) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
      <p className="text-xs text-slate-500">
        Page {page + 1} of {totalPages}
        {totalElements !== undefined && <span className="text-slate-500 font-medium"> · {totalElements} total</span>}
      </p>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 0} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('scrollbar-thin flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-0.5', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === tab.value
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-[10px]', value === tab.value ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-600')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function KeyValue({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-0.5 text-xs font-medium text-slate-900">{children}</div>
    </div>
  )
}

export function ProgressBar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'emerald' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
      <div className={cn('h-full rounded-full transition-all duration-300', tone === 'brand' ? 'bg-brand-600' : 'bg-emerald-600')} style={{ width: `${pct}%` }} />
    </div>
  )
}
