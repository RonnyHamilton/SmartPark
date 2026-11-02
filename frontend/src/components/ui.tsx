import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Loader2, X, type LucideIcon } from 'lucide-react'
import {
  forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/cn'
import { bookingStatusLabel, bookingStatusStyle } from '../lib/status'
import type { BookingStatus } from '../types'

// ---------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'soft'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'btn-primary bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 border border-blue-600 shadow-sm focus-visible:ring-blue-500 font-semibold',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-slate-900 shadow-sm focus-visible:ring-slate-900 font-semibold',
  outline: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 shadow-sm focus-visible:ring-blue-500 font-medium',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 border border-transparent focus-visible:ring-blue-500 font-medium',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-rose-600 shadow-sm focus-visible:ring-rose-500 font-semibold',
  soft: 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-blue-500 font-medium',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5 font-medium',
  md: 'h-10 px-4 text-sm rounded-md gap-2 font-medium',
  lg: 'h-11 px-5 text-sm rounded-lg gap-2.5 font-semibold',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: LucideIcon
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, icon: Icon, children, disabled, ...props }, ref,
) {
  const isIconOnly = children === undefined || children === null || children === ''
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        isIconOnly && '!px-2 aspect-square',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  )
})

// ---------------------------------------------------------------- Inputs

interface FieldShellProps {
  label?: string
  hint?: string
  error?: string
  htmlFor?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, htmlFor, required, className, children }: FieldShellProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}{required && <span className="ml-1 text-rose-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-rose-600" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'field',
          invalid && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'field appearance-none bg-[length:16px] pr-9',
          invalid && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2364748b' stroke-width='1.8' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
        {...props}
      >
        {children}
      </select>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn('field min-h-[88px] resize-y', className)} {...props} />
  },
)

export function Checkbox({ label, description, className, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  description?: string
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
      </span>
    </label>
  )
}

// ---------------------------------------------------------------- Display

export function Badge({ children, className, tone = 'neutral' }: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'brand' | 'lime' | 'teal' | 'amber' | 'rose' | 'dark'
}) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-100 text-slate-700',
    brand: 'border-brand-200 bg-brand-50 text-brand-700',
    lime: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    teal: 'border-teal-200 bg-teal-50 text-teal-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    dark: 'border-slate-800 bg-slate-900 text-white',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium', bookingStatusStyle[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'ACTIVE' ? 'animate-pulse bg-emerald-600' : 'bg-current opacity-70')} />
      {bookingStatusLabel[status]}
    </span>
  )
}

export function Card({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  const Tag = as
  return <Tag className={cn('surface', className)}>{children}</Tag>
}

export function Stat({ label, value, icon: Icon, hint, tone = 'light' }: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  hint?: string
  tone?: 'light' | 'dark' | 'lime' | 'brand'
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 transition-colors',
      tone === 'dark'
        ? 'border-slate-800 bg-slate-900 text-white'
        : tone === 'brand'
          ? 'border-brand-200 bg-brand-50/50 text-slate-900'
          : 'border-slate-200 bg-white text-slate-900',
    )}>
      <div className="flex items-center justify-between">
        <p className={cn('text-xs font-semibold uppercase tracking-wider', tone === 'dark' ? 'text-slate-300' : 'text-slate-600')}>{label}</p>
        {Icon && <Icon className={cn('h-4 w-4', tone === 'dark' ? 'text-brand-400' : 'text-slate-500')} aria-hidden />}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className={cn('mt-1 text-xs', tone === 'dark' ? 'text-slate-300' : 'text-slate-600')}>{hint}</p>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ToastIcon({ type }: { type: 'success' | 'error' }) {
  return type === 'success'
    ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>
    : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600"><X className="h-3.5 w-3.5" /></span>
}

// ---------------------------------------------------------------- Modal

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            aria-hidden="true"
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className={cn(
              'relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lift',
              size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
            )}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
            {footer && <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
