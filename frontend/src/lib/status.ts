import type { BookingStatus, SlotState } from '../types'

export const bookingStatusStyle: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-brand-700 border-brand-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERSTAY: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse font-semibold',
  NO_SHOW: 'bg-slate-100 text-slate-700 border-slate-300',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
  CONFLICT_REQUIRES_ADMIN: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
}

export const bookingStatusLabel: Record<BookingStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  OVERSTAY: 'Overstaying',
  NO_SHOW: 'No-Show',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  CONFLICT_REQUIRES_ADMIN: 'Conflict Pending Admin',
}

export const slotStateStyle: Record<SlotState, string> = {
  AVAILABLE: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  RESERVED: 'border-amber-300 bg-amber-50 text-amber-800',
  OCCUPIED: 'border-rose-300 bg-rose-50 text-rose-800',
  OUT_OF_SERVICE: 'border-slate-300 bg-slate-100 text-slate-600 line-through font-medium',
}

export const slotStateDot: Record<SlotState, string> = {
  AVAILABLE: 'bg-emerald-600',
  RESERVED: 'bg-amber-500',
  OCCUPIED: 'bg-rose-600',
  OUT_OF_SERVICE: 'bg-slate-400',
}
