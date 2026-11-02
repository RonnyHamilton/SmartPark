import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, CalendarDays, CalendarPlus, CalendarRange, CarFront, CheckCircle2, Clock3, Copy, CreditCard,
  DoorOpen, Download, LogIn, MapPin, Printer, RefreshCw, ShieldCheck, Ticket, XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorPanel, InlineError, KeyValue, PageHeader } from '../components/app'
import { Badge, Button, Card, Field, Modal, Skeleton, StatusBadge, Textarea } from '../components/ui'
import { currency, durationLabel, formatInZone, formatTimeInZone, relativeFromNow, toInstant } from '../lib/datetime'
import { cn } from '../lib/cn'
import { rescheduleSchema } from '../schemas/booking'
import { api } from '../services/api'
import type { Booking } from '../types'

const statusCopy: Record<Booking['status'], string> = {
  PENDING: 'This reservation is awaiting confirmation.',
  CONFIRMED: 'Your bay is held exclusively for this window. Check in upon arrival.',
  ACTIVE: 'Your session is active. Check out when you depart so the bay is released.',
  OVERSTAY: 'Your scheduled reservation period has ended, but your vehicle has not been checked out. The bay remains physically occupied, and overstay charges are accruing.',
  NO_SHOW: 'The check-in grace period expired without arrival. This reservation has been marked as a no-show and the slot has been released.',
  COMPLETED: 'This session has been marked completed. Thank you for parking with SmartPark.',
  CANCELLED: 'This reservation was cancelled. The bay has been released.',
  EXPIRED: 'This reservation expired before check-in was registered.',
  CONFLICT_REQUIRES_ADMIN: 'An overstay conflict occurred on your scheduled bay. Facility administration is currently resolving a compatible bay assignment for you.',
}

function Timeline({ booking }: { booking: Booking }) {
  const entries = [
    { label: 'Reservation created', time: booking.createdAt, icon: Ticket, done: true },
    { label: 'Window starts', time: booking.startTime, icon: CalendarDays, done: new Date(booking.startTime) <= new Date() },
    ...(booking.noShowDetectedAt ? [{ label: 'Marked No-Show (Grace expired)', time: booking.noShowDetectedAt, icon: AlertTriangle, done: true }] : []),
    { label: 'Checked in', time: booking.checkInTime, icon: LogIn, done: Boolean(booking.checkInTime) },
    ...(booking.overstayStartTime ? [{ label: 'Overstay commenced', time: booking.overstayStartTime, icon: AlertTriangle, done: true }] : []),
    {
      label: booking.cancelledAt ? 'Cancelled' : 'Checked out',
      time: booking.cancelledAt ?? booking.checkOutTime,
      icon: booking.cancelledAt ? XCircle : DoorOpen,
      done: Boolean(booking.cancelledAt ?? booking.checkOutTime),
    },
  ]
  return (
    <ol className="space-y-0 text-xs">
      {entries.map((entry, index) => (
        <li key={entry.label} className="relative flex gap-3 pb-4 last:pb-0">
          {index < entries.length - 1 && (
            <span className={cn('absolute left-3.5 top-7 h-full w-px', entry.done ? 'bg-brand-600' : 'bg-slate-200')} />
          )}
          <span className={cn(
            'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
            entry.done
              ? 'border-brand-600 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-slate-50 text-slate-500',
          )}>
            <entry.icon className="h-3.5 w-3.5" />
          </span>
          <div className="pt-0.5 min-w-0">
            <p className={cn('font-semibold', entry.done ? 'text-slate-900' : 'text-slate-500')}>{entry.label}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{entry.time ? formatInZone(entry.time, booking.facilityTimezone) : 'Pending'}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function BookingDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const bookingQuery = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.booking(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'ACTIVE' || s === 'OVERSTAY' ? 15_000 : false
    },
  })
  const booking = bookingQuery.data

  const [cancelOpen, setCancelOpen] = useState(params.get('action') === 'cancel')
  const [checkoutOpen, setCheckoutOpen] = useState(params.get('action') === 'checkout')
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reschedule, setReschedule] = useState({ date: '', time: '', duration: '120' })
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  useEffect(() => {
    if (booking && rescheduleOpen) {
      setReschedule({
        date: formatInZone(booking.startTime, booking.facilityTimezone, 'yyyy-MM-dd'),
        time: formatTimeInZone(booking.startTime, booking.facilityTimezone),
        duration: String(booking.durationMinutes),
      })
    }
  }, [booking, rescheduleOpen])

  const syncBooking = (updated: Booking) => {
    queryClient.setQueryData(['booking', id], updated)
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    void queryClient.invalidateQueries({ queryKey: ['booking-stats'] })
  }

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelBooking(id, reason.trim() || undefined),
    onSuccess: (updated) => {
      syncBooking(updated)
      setCancelOpen(false)
      toast.success('Reservation cancelled and bay released')
    },
  })

  const checkInMutation = useMutation({
    mutationFn: () => api.checkIn(id),
    onSuccess: (updated) => {
      syncBooking(updated)
      toast.success('Checked in. Your session is now active.')
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: () => api.checkOut(id),
    onSuccess: (updated) => {
      syncBooking(updated)
      setCheckoutOpen(false)
      toast.success('Checked out. Session completed.')
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.reschedule(id, body),
    onSuccess: (updated) => {
      syncBooking(updated)
      setRescheduleOpen(false)
      toast.success('Reservation moved to the new window')
    },
  })

  const rescheduleWindow = useMemo<{ start: string | null; end: string | null; error: string | null }>(() => {
    if (!booking) return { start: null, end: null, error: 'Reservation is loading.' }
    const parsed = rescheduleSchema.safeParse(reschedule)
    if (!parsed.success) return { start: null, end: null, error: parsed.error.issues[0]?.message ?? 'Check the new window.' }
    if (parsed.data.duration < 30 || parsed.data.duration > 24 * 60) return { start: null, end: null, error: 'Duration must be between 30 minutes and 24 hours.' }
    try {
      const start = toInstant(reschedule.date, reschedule.time, booking.facilityTimezone)
      const end = new Date(new Date(start).getTime() + parsed.data.duration * 60_000).toISOString()
      return { start, end, error: null }
    } catch {
      return { start: null, end: null, error: 'Choose a valid date and time.' }
    }
  }, [booking, reschedule])

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Clipboard access not permitted.')
    }
  }

  const downloadIcs = () => {
    if (!booking) return
    const formatIcs = (iso: string) => {
      try {
        return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      } catch {
        return ''
      }
    }
    const start = formatIcs(booking.startTime)
    const end = formatIcs(booking.endTime)
    const now = formatIcs(new Date().toISOString())

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SmartPark Parking Management//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:smartpark-${booking.bookingReference}@smartpark.local`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:SmartPark: ${booking.facilityName} (${booking.slotCode})`,
      `DESCRIPTION:Parking Reservation\\nRef: ${booking.bookingReference}\\nBay: ${booking.floorName} - ${booking.slotCode}\\nVehicle: ${booking.vehicleRegistration}\\nAddress: ${booking.facilityAddress}`,
      `LOCATION:${booking.facilityAddress}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:SmartPark parking reservation starts in 30 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smartpark-${booking.bookingReference}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Calendar event (.ics) downloaded')
  }

  const printGatePass = () => {
    window.print()
  }

  if (bookingQuery.isError) {
    return (
      <div>
        <PageHeader title="Reservation Details" backTo="/dashboard" backLabel="Back to dashboard" />
        <ErrorPanel error={bookingQuery.error} onRetry={() => void bookingQuery.refetch()} title="Could not load reservation" />
      </div>
    )
  }

  if (bookingQuery.isPending || !booking) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Reference: ${booking.bookingReference}`}
        title={booking.facilityName}
        backTo="/dashboard"
        backLabel="Back to dashboard"
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-500" /> {booking.facilityAddress}</span>
            <span className="flex items-center gap-1"><CarFront className="h-3.5 w-3.5 text-slate-500" /> {booking.floorName} · <strong className="font-mono text-slate-800">{booking.slotCode}</strong></span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            <Button size="sm" variant="outline" icon={CalendarPlus} onClick={downloadIcs} title="Add to Google, Outlook, or Apple Calendar">
              Sync Calendar
            </Button>
            <Button size="sm" variant="outline" icon={Printer} onClick={printGatePass} title="Print physical gate pass or save PDF">
              Print Pass
            </Button>
            {booking.canCheckIn && (
              <Button size="sm" icon={LogIn} loading={checkInMutation.isPending} onClick={() => checkInMutation.mutate()}>
                Check in
              </Button>
            )}
            {booking.canCheckOut && (
              <Button size="sm" variant="dark" icon={DoorOpen} onClick={() => setCheckoutOpen(true)}>
                Check out
              </Button>
            )}
            {booking.canModify && (
              <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => setRescheduleOpen(true)}>
                Modify
              </Button>
            )}
            {booking.canCancel && (
              <Button size="sm" variant="outline" icon={XCircle} className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      {checkInMutation.isError && <div className="mb-4"><InlineError error={checkInMutation.error} /></div>}
      {checkOutMutation.isError && <div className="mb-4"><InlineError error={checkOutMutation.error} /></div>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-4">
          {/* Overstay Alert Banner */}
          {booking.status === 'OVERSTAY' && (
            <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-200 text-rose-800">
                  <AlertTriangle className="h-5 w-5 animate-pulse text-rose-700" />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-rose-900">Overstay Alert – Vehicle Physically Present in Bay {booking.slotCode}</h4>
                  <p className="mt-1 text-xs text-rose-800">
                    Your scheduled reservation ended at {formatTimeInZone(booking.endTime, booking.facilityTimezone)}. This bay is held exclusively by your vehicle until checkout.
                    An overstay fee of {currency(booking.overstayCharge ?? 0, booking.currency)} has accrued for {booking.overstayDurationMinutes ?? 0} minutes of overstay.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="danger" icon={DoorOpen} onClick={() => setCheckoutOpen(true)}>
                      Check Out & Release Bay
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No Show Alert Banner */}
          {booking.status === 'NO_SHOW' && (
            <div className="rounded-lg border border-slate-300 bg-slate-100 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <XCircle className="h-5 w-5 text-slate-600" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Reservation Declared No-Show</h4>
                  <p className="mt-1 text-xs text-slate-600">
                    Check-in was not registered within the {booking.facilityName} check-in grace period (15 minutes). Bay {booking.slotCode} has been released back into circulation.
                    {booking.noShowDetectedAt && ` Detected at ${formatInZone(booking.noShowDetectedAt, booking.facilityTimezone)}.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conflict Alert Banner */}
          {booking.status === 'CONFLICT_REQUIRES_ADMIN' && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Slot Conflict – Administration Assistance Required</h4>
                  <p className="mt-1 text-xs text-amber-800">
                    Bay {booking.slotCode} remains physically occupied due to an overstay. Facility supervisors have been alerted and will manually assign an alternate bay for your arrival. Your reservation is intact.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Slot Reassignment Notification */}
          {booking.reassignedFromSlotCode && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3.5">
              <div className="flex items-start gap-2.5">
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                <div className="text-xs text-purple-900">
                  <span className="font-semibold">Automatic Bay Reassignment: </span>
                  Your bay was automatically moved from <span className="font-mono font-bold">{booking.reassignedFromSlotCode}</span> to <span className="font-mono font-bold text-purple-800">{booking.slotCode}</span> because the previous occupant overstayed. Your reservation window remains unchanged.
                </div>
              </div>
            </div>
          )}

          {/* Overstay & Billing Breakdown */}
          {((booking.overstayCharge && booking.overstayCharge > 0) || booking.status === 'OVERSTAY') && (
            <Card className="p-4 border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                Itemized Pricing & Overstay Calculation
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Original Scheduled Duration</span>
                  <span className="font-medium text-slate-900">{durationLabel(booking.durationMinutes)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Base Reservation Charge</span>
                  <span className="font-medium text-slate-900">{currency(booking.priceAmount, booking.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Scheduled End Time</span>
                  <span className="font-mono text-slate-800">{formatTimeInZone(booking.endTime, booking.facilityTimezone)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Actual Departure / Check-out</span>
                  <span className="font-mono text-slate-800">
                    {booking.checkOutTime ? formatTimeInZone(booking.checkOutTime, booking.facilityTimezone) : 'Currently overstaying'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-rose-700 font-medium">Overstay Duration</span>
                  <span className="font-semibold text-rose-700">{booking.overstayDurationMinutes ?? 0} minutes</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-rose-700 font-medium">Additional Overstay Charge</span>
                  <span className="font-bold text-rose-700">{currency(booking.overstayCharge ?? 0, booking.currency)}</span>
                </div>
                <div className="flex justify-between pt-2 text-sm font-bold text-slate-900">
                  <span>Total Amount Due</span>
                  <span className="text-base text-brand-700">
                    {currency(booking.totalAmount ?? (booking.priceAmount + (booking.overstayCharge ?? 0)), booking.currency)}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Digital Pass Overview Card */}
          <Card className="p-0 overflow-hidden border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                    {booking.status === 'ACTIVE' ? 'Active Parking Session' : 'Scheduled Interval'}
                  </span>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    {formatTimeInZone(booking.startTime, booking.facilityTimezone)} – {formatTimeInZone(booking.endTime, booking.facilityTimezone)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarRange className="h-3.5 w-3.5 text-slate-500" />
                    {formatInZone(booking.startTime, booking.facilityTimezone, 'EEEE, dd MMMM yyyy')} · {durationLabel(booking.durationMinutes)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-right">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">{booking.status === 'ACTIVE' ? 'Ends' : 'Starts'}</span>
                  <p className="text-xs font-bold text-slate-800">{relativeFromNow(booking.status === 'ACTIVE' ? booking.endTime : booking.startTime)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Bay</span>
                  <p className="font-mono text-sm font-bold text-brand-700">{booking.slotCode}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Floor</span>
                  <p className="font-medium text-slate-800">{booking.floorName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Vehicle</span>
                  <p className="font-medium text-slate-800">{booking.vehicleRegistration}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Type</span>
                  <p className="font-medium text-slate-800">{booking.slotType}</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <p className="text-xs leading-relaxed text-slate-600">{statusCopy[booking.status]}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4 text-xs">
                <KeyValue label="Reference"><span className="font-mono text-xs font-semibold text-slate-900">{booking.bookingReference}</span></KeyValue>
                <KeyValue label="Created">{relativeFromNow(booking.createdAt)}</KeyValue>
                <KeyValue label="Amount">{currency(booking.priceAmount, booking.currency)}</KeyValue>
                <KeyValue label="Payment">Pay at facility</KeyValue>
              </div>

              {booking.allocationReason && (
                <div className="mt-3.5 rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <span className="text-[10.5px] font-semibold uppercase text-slate-500">Allocation Reason</span>
                  <p className="mt-0.5 text-slate-700">{booking.allocationReason}</p>
                </div>
              )}

              {booking.cancellationReason && (
                <div className="mt-3.5 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  <span className="text-[10.5px] font-semibold uppercase text-rose-600">Cancellation Note</span>
                  <p className="mt-0.5 text-rose-900">{booking.cancellationReason}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline and Policy Information */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">Reservation Timeline</h3>
              <div className="mt-3">
                <Timeline booking={booking} />
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">Arrival & Policies</h3>
              <div className="mt-3 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span>Free cancellation permitted up to {booking.cancellationCutoffMinutes} min prior to start time.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span>Direct bay access guaranteed for the entire reserved duration.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span>Settle billing at facility gate. No card details stored.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>Bay reserved via PostgreSQL database interval lock.</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Sidebar Digital Reference Card */}
        <aside className="space-y-4">
          <Card className="p-4 text-center">
            <span className="text-xs font-semibold uppercase text-slate-500">Digital Reservation Pass</span>
            <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="text-[10.5px] uppercase font-semibold text-slate-500">Bay Code</span>
              <p className="font-mono text-3xl font-bold text-slate-900 mt-0.5">{booking.slotCode}</p>
              <p className="text-xs text-slate-600">{booking.floorName}</p>
              <div className="mt-2.5 flex justify-center">
                <StatusBadge status={booking.status} />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-800">{booking.bookingReference}</span>
              <button
                type="button"
                onClick={() => void copy(booking.bookingReference, 'Booking reference')}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Present reference at the {booking.facilityName} barrier.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">Available Actions</h3>
            <div className="mt-3 space-y-1.5">
              {booking.canCheckIn && (
                <Button className="w-full" size="sm" icon={LogIn} loading={checkInMutation.isPending} onClick={() => checkInMutation.mutate()}>
                  Check In Now
                </Button>
              )}
              {booking.canCheckOut && (
                <Button className="w-full" size="sm" variant="dark" icon={DoorOpen} onClick={() => setCheckoutOpen(true)}>
                  Complete Session
                </Button>
              )}
              <Button className="w-full" size="sm" variant="outline" icon={MapPin} onClick={() => navigate(`/facilities/${booking.facilityId}`)}>
                Facility Details
              </Button>
              {booking.canModify && (
                <Button className="w-full" size="sm" variant="outline" icon={RefreshCw} onClick={() => setRescheduleOpen(true)}>
                  Reschedule Window
                </Button>
              )}
              {booking.canCancel && (
                <Button className="w-full border-rose-200 text-rose-700 hover:bg-rose-50" size="sm" variant="outline" icon={XCircle} onClick={() => setCancelOpen(true)}>
                  Cancel Reservation
                </Button>
              )}
            </div>
            {!booking.canCancel && (booking.status === 'CONFIRMED' || booking.status === 'PENDING') && (
              <p className="mt-2.5 flex items-start gap-1 text-[11px] text-slate-500">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                The free-cancellation cutoff has elapsed.
              </p>
            )}
          </Card>
        </aside>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Reservation?"
        description="The allocated slot will be released back into the available pool immediately."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>Keep Reservation</Button>
            <Button variant="danger" size="sm" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>Confirm Cancellation</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            {booking.canCancel
              ? 'You are within the free cancellation window. No fee applies.'
              : 'The cancellation cutoff has passed. The facility may charge a late cancellation fee.'}
          </div>
          <Field label="Reason (optional)" htmlFor="cancel-reason" hint="Recorded for facility operational audit.">
            <Textarea id="cancel-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation..." />
          </Field>
          {cancelMutation.isError && <InlineError error={cancelMutation.error} />}
        </div>
      </Modal>

      {/* Checkout Confirmation Modal */}
      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Check out & End Session?"
        description="Your parking session will be marked as complete and your bay will be made available for subsequent drivers."
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCheckoutOpen(false)}>Not yet</Button>
            <Button variant="dark" size="sm" loading={checkOutMutation.isPending} onClick={() => checkOutMutation.mutate()}>Check Out</Button>
          </>
        }
      >
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">{booking.facilityName}</p>
          <p className="text-slate-500">{booking.floorName} · Bay {booking.slotCode}</p>
          <p className="mt-2 text-slate-600">
            Checked in at {booking.checkInTime ? formatInZone(booking.checkInTime, booking.facilityTimezone) : '—'}
          </p>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Reschedule Reservation Window"
        description="Verify new window availability. If your current bay is still free, it will be retained."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRescheduleOpen(false)}>Keep Current</Button>
            <Button
              size="sm"
              loading={rescheduleMutation.isPending}
              disabled={Boolean(rescheduleWindow?.error)}
              onClick={() => {
                const parsed = rescheduleSchema.safeParse(reschedule)
                if (!parsed.success || !rescheduleWindow || rescheduleWindow.error) {
                  setRescheduleError(parsed.success ? rescheduleWindow?.error ?? 'Check the window.' : parsed.error.issues[0]?.message ?? 'Check the window.')
                  return
                }
                setRescheduleError(null)
                rescheduleMutation.mutate({ startTime: rescheduleWindow.start, endTime: rescheduleWindow.end })
              }}
            >
              Update Window
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Field label="Date" htmlFor="reschedule-date" required>
              <input id="reschedule-date" type="date" className="field" value={reschedule.date} onChange={(e) => setReschedule((v) => ({ ...v, date: e.target.value }))} />
            </Field>
            <Field label="Start Time" htmlFor="reschedule-time" required>
              <input id="reschedule-time" type="time" className="field" value={reschedule.time} onChange={(e) => setReschedule((v) => ({ ...v, time: e.target.value }))} />
            </Field>
            <Field label="Duration (min)" htmlFor="reschedule-duration" required>
              <input id="reschedule-duration" type="number" min={30} max={1440} step={15} className="field" value={reschedule.duration} onChange={(e) => setReschedule((v) => ({ ...v, duration: e.target.value }))} />
            </Field>
          </div>
          {rescheduleWindow?.start && rescheduleWindow?.end && !rescheduleWindow.error && (
            <p className="rounded-md bg-slate-50 border border-slate-200 p-2 text-xs text-slate-600">
              New Window: {formatInZone(rescheduleWindow.start, booking.facilityTimezone)} → {formatTimeInZone(rescheduleWindow.end, booking.facilityTimezone)}
            </p>
          )}
          {(rescheduleError || rescheduleWindow?.error) && <p className="text-xs font-medium text-rose-600">{rescheduleError ?? rescheduleWindow?.error}</p>}
          {rescheduleMutation.isError && <InlineError error={rescheduleMutation.error} />}
        </div>
      </Modal>
    </div>
  )
}
