import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Accessibility, ArrowLeft, ArrowRight, CalendarDays, CarFront, Check, CheckCircle2, ChevronRight, Clock3,
  CreditCard, Info, MapPin, RefreshCw, ShieldCheck, Sparkles, Ticket, Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorPanel, InlineError, KeyValue, PageHeader } from '../components/app'
import { Badge, Button, Card, EmptyState, Field, Select, Skeleton, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { addDaysInZone, currency, durationLabel, formatDateInZone, formatInZone, formatTimeInZone, hhmm, toInstant } from '../lib/datetime'
import { cn } from '../lib/cn'
import { bookingDetailsSchema } from '../schemas/booking'
import { api } from '../services/api'
import type { Booking, QuoteResponse, SlotAvailability } from '../types'

const durations = [30, 60, 90, 120, 180, 240, 360, 480, 720]
const steps = [
  { label: 'Trip Details', hint: 'Facility & Window' },
  { label: 'Select Bay', hint: 'Smart or Manual' },
  { label: 'Confirm', hint: 'Review & Lock' },
]

function safeStart(date: string, time: string, zone: string): string | null {
  try { return toInstant(date, time, zone) } catch { return null }
}

function StepRail({ step }: { step: number }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
      {steps.map((item, index) => {
        const done = step > index
        const active = step === index
        return (
          <li key={item.label} className="flex flex-1 items-center gap-2.5">
            <span className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors',
              done
                ? 'border-brand-600 bg-brand-600 text-white'
                : active
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-500',
            )}>
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0">
              <p className={cn('text-xs font-semibold', active ? 'text-brand-700' : done ? 'text-slate-900' : 'text-slate-500')}>
                {item.label}
              </p>
              <p className="hidden text-[10.5px] text-slate-500 sm:block">{item.hint}</p>
            </div>
            {index < steps.length - 1 && (
              <span className={cn('mx-3 hidden h-px flex-1 sm:block', done ? 'bg-brand-600' : 'bg-slate-200')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function SlotPill({ slot, selected, onSelect }: { slot: SlotAvailability; selected: boolean; onSelect: () => void }) {
  const getPillStyle = () => {
    if (selected) {
      return 'border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-600 font-bold'
    }
    switch (slot.state) {
      case 'AVAILABLE':
        return 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400'
      case 'RESERVED':
        return 'border-amber-300 bg-amber-50 text-amber-800 cursor-not-allowed opacity-80'
      case 'OCCUPIED':
        return 'border-rose-300 bg-rose-50 text-rose-800 cursor-not-allowed opacity-80'
      case 'OUT_OF_SERVICE':
      default:
        return 'border-slate-300 bg-slate-100 text-slate-600 line-through cursor-not-allowed font-medium'
    }
  }

  return (
    <button
      type="button"
      disabled={!slot.bookable}
      onClick={onSelect}
      title={slot.reason}
      className={cn(
        'flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition',
        getPillStyle(),
      )}
    >
      {slot.slotCode}
      {slot.evCharger && <Zap className="h-2.5 w-2.5 text-amber-500" />}
      {slot.accessible && <Accessibility className="h-2.5 w-2.5 text-brand-600" />}
    </button>
  )
}

export default function Book() {
  const [params] = useSearchParams()
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  const initialHours = Math.max(0.5, Number(params.get('duration') || '2') || 2)

  const [step, setStep] = useState(0)
  const [facilityId, setFacilityId] = useState(params.get('facility') ?? '')
  const [vehicleId, setVehicleId] = useState(params.get('vehicle') ?? '')
  const [date, setDate] = useState(params.get('date') || addDaysInZone(zone, 1))
  const [time, setTime] = useState(params.get('time') || '10:00')
  const [duration, setDuration] = useState(String(Math.round(initialHours * 60)))
  const [accessibilityRequired, setAccessibilityRequired] = useState(user?.accessibilityRequired ?? false)
  const [preferredSlotId, setPreferredSlotId] = useState(params.get('slot') ?? '')
  const [preferredFloorId, setPreferredFloorId] = useState(params.get('floor') ?? '')
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<unknown>(null)

  const facilitiesQuery = useQuery({ queryKey: ['facilities', 'booking'], queryFn: () => api.facilities() })
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: () => api.vehicles() })

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data?.length) setFacilityId(facilitiesQuery.data[0].id)
  }, [facilityId, facilitiesQuery.data])

  useEffect(() => {
    if (!vehicleId && vehiclesQuery.data?.length) {
      const preferred = vehiclesQuery.data.find((v) => v.isDefault) ?? vehiclesQuery.data[0]
      setVehicleId(preferred.id)
    }
  }, [vehicleId, vehiclesQuery.data])

  const facility = facilitiesQuery.data?.find((item) => item.id === facilityId)
  const vehicle = vehiclesQuery.data?.find((item) => item.id === vehicleId)
  const facilityQuery = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => api.facility(facilityId),
    enabled: Boolean(facilityId),
  })

  const start = useMemo(() => facility ? safeStart(date, time, facility.timezone) : null, [facility, date, time])
  const end = useMemo(() => start ? new Date(new Date(start).getTime() + Number(duration) * 60_000).toISOString() : null, [start, duration])

  const durationError = useMemo(() => {
    if (!facility) return null
    const minutes = Number(duration)
    if (Number.isNaN(minutes)) return 'Choose a duration.'
    if (minutes < facility.minDurationMinutes) return `This facility requires at least ${durationLabel(facility.minDurationMinutes)}.`
    if (minutes > facility.maxDurationMinutes) return `This facility allows at most ${durationLabel(facility.maxDurationMinutes)}.`
    return null
  }, [facility, duration])

  const availabilityQuery = useQuery({
    queryKey: ['booking-availability', facilityId, start, end, vehicle?.vehicleType],
    queryFn: () => api.availability(facilityId, { start: start!, end: end!, vehicleType: vehicle?.vehicleType }),
    enabled: Boolean(facilityId && start && end && step === 1),
    retry: 0,
  })

  const quoteMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.quote(body),
    onError: (error) => setQuoteError(error),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createBooking(body),
    onSuccess: async (created) => {
      setBooking(created)
      setStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success(`Reservation ${created.bookingReference} confirmed`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['facility'] }),
      ])
    },
  })

  const validate = () => {
    const parsed = bookingDetailsSchema.safeParse({
      facilityId, vehicleId, date, time, duration: Number(duration),
      accessibilityRequired, preferredSlotId: preferredSlotId || undefined, preferredFloorId: preferredFloorId || undefined,
    })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the details above.')
      return false
    }
    if (!start || !end) {
      setFormError('Choose a valid date and start time.')
      return false
    }
    if (durationError) {
      setFormError(durationError)
      return false
    }
    setFormError(null)
    return true
  }

  const runQuote = async (overrides: { date?: string; time?: string; slot?: string } = {}) => {
    if (!validate() || !facility) return
    const effectiveDate = overrides.date ?? date
    const effectiveTime = overrides.time ?? time
    const effectiveSlot = overrides.slot !== undefined ? overrides.slot : preferredSlotId
    const effectiveStart = safeStart(effectiveDate, effectiveTime, facility.timezone)
    if (!effectiveStart) {
      setFormError('Choose a valid date and start time.')
      return
    }
    const effectiveEnd = new Date(new Date(effectiveStart).getTime() + Number(duration) * 60_000).toISOString()
    setQuoteError(null)
    try {
      const result = await quoteMutation.mutateAsync({
        facilityId,
        vehicleId,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        accessibilityRequired,
        preferredSlotId: effectiveSlot || undefined,
        preferredFloorId: preferredFloorId || undefined,
      })
      setDate(effectiveDate)
      setTime(effectiveTime)
      setPreferredSlotId(effectiveSlot)
      setQuote(result)
      setStep(1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setStep(1)
      setQuote(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const chooseSlot = async (slotId: string) => {
    setPreferredSlotId(slotId)
    await runQuote({ slot: slotId })
  }

  const adjustDuration = (minutes: number) => {
    setDuration(String(minutes))
    setFormError(null)
  }

  const confirm = () => {
    if (!quote) return
    if (!quote.allocation) {
      setFormError('No bay is available for this window. Choose an alternative or a new time.')
      return
    }
    createMutation.mutate({
      facilityId,
      vehicleId,
      startTime: quote.startTime,
      endTime: quote.endTime,
      accessibilityRequired,
      preferredSlotId: quote.allocation.slotId ?? (preferredSlotId || undefined),
      preferredFloorId: preferredFloorId || undefined,
    })
  }

  const resetAll = () => {
    setBooking(null)
    setQuote(null)
    setPreferredSlotId('')
    setStep(0)
  }

  const floorGroups = useMemo(() => {
    const rows = availabilityQuery.data?.slots ?? []
    const map = new Map<string, { floorName: string; slots: SlotAvailability[] }>()
    for (const slot of rows) {
      const group = map.get(slot.floorId) ?? { floorName: slot.floorName, slots: [] }
      group.slots.push(slot)
      map.set(slot.floorId, group)
    }
    return Array.from(map.entries())
  }, [availabilityQuery.data?.slots])

  if (isAdmin) {
    return (
      <div className="py-4">
        <PageHeader
          eyebrow="Access Restricted"
          title="Administrative Operations Mode"
          description="Slot reservations are reserved exclusively for customer accounts."
        />
        <Card className="p-6 text-center max-w-lg mx-auto border-brand-200 bg-brand-50/20">
          <ShieldCheck className="mx-auto h-12 w-12 text-brand-600 mb-3" />
          <h2 className="text-base font-bold text-slate-900">Administrators Cannot Book Parking Slots</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Your account possesses full administrative privileges for managing facilities, configuring floors and bays, adjusting pricing tariffs, and reviewing real-time system audit trails. Slot reservations require a customer driver profile.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/admin?tab=overview">
              <Button size="sm">Go to Admin Dashboard</Button>
            </Link>
            <Link to="/admin?tab=facilities">
              <Button size="sm" variant="outline">Manage Facilities</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (vehiclesQuery.isPending || facilitiesQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    )
  }

  if (facilitiesQuery.isError) {
    return <ErrorPanel error={facilitiesQuery.error} onRetry={() => void facilitiesQuery.refetch()} />
  }

  if (!vehiclesQuery.data?.length && !booking) {
    return (
      <div>
        <PageHeader eyebrow="Reservation" title="Vehicle Required" backTo="/discover" backLabel="Back to facilities" />
        <EmptyState
          icon={CarFront}
          title="No registered vehicles on your account"
          description="Every parking reservation requires a registered vehicle to ensure bay dimension compatibility and gate verification."
          action={
            <Link to="/profile?tab=vehicles">
              <Button size="sm">Register a vehicle</Button>
            </Link>
          }
        />
      </div>
    )
  }

  // Step 3: Confirmed Reservation Digital Pass
  if (step === 3 && booking) {
    return (
      <div className="mx-auto max-w-2xl py-4">
        <Card className="p-0 overflow-hidden border-slate-200">
          <div className="border-b border-slate-200 bg-emerald-50/60 p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-4 w-4" />
              </span>
              <Badge tone="lime">Reservation Confirmed</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              Your Bay Is Held, {user?.name.split(' ')[0]}
            </h1>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Your parking slot is locked into the database for the entire booked interval. Present this pass upon arrival.
            </p>
          </div>

          <div className="p-6">
            <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-center">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Booking Reference</span>
                <p className="mt-0.5 font-mono text-base font-bold text-brand-700">{booking.bookingReference}</p>
                <h3 className="mt-3 text-lg font-bold text-slate-900">{booking.facilityName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{booking.facilityAddress}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <KeyValue label="Arrival Date">{formatDateInZone(booking.startTime, booking.facilityTimezone)}</KeyValue>
                  <KeyValue label="Interval">{formatTimeInZone(booking.startTime, booking.facilityTimezone)}–{formatTimeInZone(booking.endTime, booking.facilityTimezone)}</KeyValue>
                  <KeyValue label="Reserved Bay">{booking.floorName} · <strong className="font-mono">{booking.slotCode}</strong></KeyValue>
                  <KeyValue label="Vehicle">{booking.vehicleRegistration}</KeyValue>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-500">Allocated Slot</span>
                <p className="font-mono text-3xl font-bold text-slate-900 mt-1">{booking.slotCode}</p>
                <p className="text-xs text-slate-600">{booking.floorName}</p>
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Total Due At Gate</span>
                  <p className="text-base font-bold text-slate-900">{currency(booking.priceAmount, booking.currency)}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Link to={`/bookings/${booking.id}`}>
                <Button size="sm" icon={Ticket}>View Full Details</Button>
              </Link>
              <Link to="/dashboard">
                <Button size="sm" variant="outline">My Dashboard</Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={resetAll}>New Reservation</Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reservation Workflow"
        title={step === 0 ? 'Configure Your Reservation' : step === 1 ? 'Choose Your Parking Bay' : 'Review & Confirm'}
        description={
          step === 0
            ? 'Select target facility, registered vehicle, date, and reservation duration.'
            : step === 1
              ? 'Select the automatically recommended bay or override with your preferred slot.'
              : 'Verify your reservation interval, bay details, and server-quoted pricing.'
        }
        backTo="/discover"
        backLabel="Back to facilities"
      />

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
        <StepRail step={step} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="space-y-4">
          {/* STEP 0: Trip Details */}
          {step === 0 && (
            <Card className="p-4 sm:p-5">
              {facilitiesQuery.data?.length === 0 ? (
                <EmptyState icon={MapPin} title="No facilities available" description="An administrator must register at least one parking facility." />
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); void runQuote() }}
                  className="space-y-4"
                  noValidate
                >
                  {formError && <InlineError error={new Error(formError)} />}

                  <div>
                    <label className="label">1. Select Facility</label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {facilitiesQuery.data?.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => { setFacilityId(item.id); setPreferredSlotId(''); setPreferredFloorId(''); setFormError(null) }}
                          className={cn(
                            'rounded-lg border p-3 text-left transition',
                            facilityId === item.id
                              ? 'border-brand-600 bg-brand-50/50 text-slate-900 ring-1 ring-brand-600'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-slate-900">{item.name}</p>
                              <p className="text-[11px] text-slate-500">{item.city} · {item.address}</p>
                            </div>
                            {facilityId === item.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />}
                          </div>
                          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10.5px] text-slate-500">
                            <span>{item.totalSlots} slots</span>
                            <span>{item.hourlyRate != null ? `${currency(item.hourlyRate)}/hr` : 'Dynamic rate'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="2. Registered Vehicle" htmlFor="vehicle" error={vehiclesQuery.data?.length ? undefined : 'Add a vehicle first'} required>
                      <Select id="vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                        {vehiclesQuery.data?.map((item) => (
                          <option key={item.id} value={item.id}>{item.registrationNumber} · {item.vehicleType}{item.isDefault ? ' (default)' : ''}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Floor Preference" htmlFor="floor" hint="Optional preference for floor sorting">
                      <Select id="floor" value={preferredFloorId} onChange={(e) => setPreferredFloorId(e.target.value)}>
                        <option value="">No floor preference</option>
                        {(facilityQuery.data?.floors ?? []).map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                      </Select>
                    </Field>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2.5">
                      <CalendarDays className="h-3.5 w-3.5 text-brand-600" /> 3. Select Reservation Window
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <Field label="Date" htmlFor="book-date" required>
                        <input id="book-date" type="date" min={addDaysInZone(facility?.timezone ?? zone, 0)} className="field" value={date} onChange={(e) => setDate(e.target.value)} />
                      </Field>
                      <Field label="Start Time" htmlFor="book-time" required>
                        <input id="book-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
                      </Field>
                      <Field label="Duration" htmlFor="book-duration" required>
                        <Select id="book-duration" value={duration} onChange={(e) => adjustDuration(Number(e.target.value))}>
                          {durations.map((minutes) => <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>)}
                          {!durations.includes(Number(duration)) && <option value={duration}>{durationLabel(Number(duration))}</option>}
                        </Select>
                      </Field>
                    </div>
                    {durationError && <p className="mt-2 text-xs font-medium text-rose-600">{durationError}</p>}
                  </div>

                  <div className="pt-1">
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300">
                      <input type="checkbox" checked={accessibilityRequired} onChange={(e) => setAccessibilityRequired(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-brand-600" />
                      <span className="text-xs">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Accessibility className="h-3.5 w-3.5 text-brand-600" /> Accessible Bay Required
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">Prioritizes ramps and wide bay access near elevators.</span>
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">Server validates availability across full duration</p>
                    <Button type="submit" size="md" icon={ArrowRight} loading={quoteMutation.isPending}>
                      Check Availability
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}

          {/* STEP 1: Select Bay */}
          {step === 1 && (
            <>
              {quoteError != null && (
                <ErrorPanel compact error={quoteError} title="No bay available for that window" onRetry={() => void runQuote()} />
              )}

              {/* Recommended Bay Card */}
              {quote?.allocation && (
                <Card className="p-4 sm:p-5 border-brand-200 bg-brand-50/20">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-100 pb-3">
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                        <Sparkles className="h-3 w-3" /> Recommended Bay
                      </span>
                      <h3 className="mt-2 text-xl font-bold text-slate-900">
                        {quote.allocation.slotCode} <span className="text-sm font-normal text-slate-500">· {quote.allocation.floorName}</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        {quote.allocation.slotType} bay · {quote.allocation.accessible ? 'Accessible' : 'Standard'}
                        {quote.allocation.evCharger ? ' · EV charger' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10.5px] uppercase font-semibold text-slate-500">Estimated Total</span>
                      <p className="text-xl font-bold text-slate-900">{currency(quote.estimatedPrice ?? 0)}</p>
                      <span className="text-[10px] text-slate-500 font-medium">{durationLabel(quote.durationMinutes)}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs">
                    <span className="text-[10.5px] uppercase font-semibold text-slate-500">Allocation Reason</span>
                    <p className="mt-1 text-slate-700 font-medium">{quote.allocation.reason}</p>
                    {quote.priceExplanation && (
                      <p className="mt-2 rounded bg-white border border-slate-200 p-2 text-slate-500 text-[11px]">
                        {quote.priceExplanation}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-brand-100 pt-3">
                    <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => { setStep(0); setQuoteError(null) }}>
                      Change Window
                    </Button>
                    <Button size="md" icon={ArrowRight} onClick={() => setStep(2)}>
                      Proceed to Review
                    </Button>
                  </div>
                </Card>
              )}

              {/* Slot Override Grid */}
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Manual Bay Selection</h3>
                    <p className="text-[11px] text-slate-500">You can override the recommendation by selecting any available bay.</p>
                  </div>
                  {availabilityQuery.data && (
                    <Badge tone="lime">{availabilityQuery.data.bookableSlots} available</Badge>
                  )}
                </div>

                {availabilityQuery.isPending ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Array.from({ length: 16 }).map((_, i) => <Skeleton key={i} className="h-7 w-14 rounded" />)}
                  </div>
                ) : availabilityQuery.isError ? (
                  <div className="mt-3"><ErrorPanel compact error={availabilityQuery.error} onRetry={() => void availabilityQuery.refetch()} /></div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {floorGroups.map(([floorId, group]) => (
                      <div key={floorId}>
                        <p className="text-[10.5px] font-semibold uppercase text-slate-500 mb-1.5">{group.floorName}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.slots.map((slot) => (
                            <SlotPill
                              key={slot.slotId}
                              slot={slot}
                              selected={preferredSlotId === slot.slotId}
                              onSelect={() => void chooseSlot(slot.slotId)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[10.5px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Green (Available)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Amber (Reserved)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" /> Red (Occupied)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-600" /> Blue (Selected)</span>
                  {preferredSlotId && (
                    <button type="button" className="ml-auto text-xs font-semibold text-brand-600 hover:underline" onClick={() => void runQuote({ slot: '' })}>
                      Reset to smart allocation
                    </button>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* STEP 2: Review & Confirm */}
          {step === 2 && quote?.allocation && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-bold text-slate-900">Review & Confirm Reservation</h2>
              <p className="mt-0.5 text-xs text-slate-500">Confirming writes the record to PostgreSQL and locks your bay immediately.</p>

              <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
                <KeyValue label="Facility">{quote.facilityName}<p className="text-[11px] font-normal text-slate-500">{facility?.address}</p></KeyValue>
                <KeyValue label="Allocated Bay">{quote.allocation.floorName} · <strong className="font-mono text-slate-900">{quote.allocation.slotCode}</strong></KeyValue>
                <KeyValue label="Date">{formatDateInZone(quote.startTime, quote.facilityTimezone)}</KeyValue>
                <KeyValue label="Interval">{formatTimeInZone(quote.startTime, quote.facilityTimezone)}–{formatTimeInZone(quote.endTime, quote.facilityTimezone)} ({durationLabel(quote.durationMinutes)})</KeyValue>
                <KeyValue label="Vehicle">{vehicle?.registrationNumber} ({vehicle?.vehicleType})</KeyValue>
                <KeyValue label="Price Due At Gate">{currency(quote.estimatedPrice ?? 0)}</KeyValue>
              </div>

              <div className="mt-3.5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <Info className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                <p>Free cancellation is permitted up to {facility?.cancellationCutoffMinutes ?? 60} minutes prior to the start time.</p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => setStep(1)}>
                  Back to Bays
                </Button>
                <Button size="md" icon={CheckCircle2} loading={createMutation.isPending} onClick={confirm}>
                  Confirm & Reserve Bay
                </Button>
              </div>
              {createMutation.isError && <div className="mt-3"><InlineError error={createMutation.error} /></div>}
            </Card>
          )}
        </div>

        {/* Sidebar Summary */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">Booking Summary</h3>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Facility</span><span className="font-medium text-slate-900">{facility?.name ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Vehicle</span><span className="font-medium text-slate-900">{vehicle?.registrationNumber ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium text-slate-900">{date}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Window</span><span className="font-medium text-slate-900">{time} ({durationLabel(Number(duration))})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Bay</span><span className="font-mono font-bold text-brand-700">{quote?.allocation?.slotCode ?? 'Auto-allocated'}</span></div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3 flex items-baseline justify-between">
              <span className="text-xs uppercase text-slate-500 font-semibold">Total</span>
              <span className="text-xl font-bold text-slate-900">
                {quote?.estimatedPrice != null ? currency(quote.estimatedPrice) : '—'}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Payment is settled directly at the facility upon entry or departure.
            </p>
          </Card>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs text-slate-500">
            <p className="flex items-center gap-1 font-semibold text-slate-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Database-Level Concurrency Lock
            </p>
            <p className="mt-1 text-[11px] leading-relaxed">
              PostgreSQL exclusion constraint guarantees that two users cannot simultaneously reserve the same bay for overlapping intervals.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
