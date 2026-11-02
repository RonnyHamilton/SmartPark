import { useQuery } from '@tanstack/react-query'
import {
  Accessibility, ArrowRight, Calculator, CalendarDays, CarFront, CheckCircle2, Clock3, Info, Layers3,
  MapPin, RefreshCw, ShieldCheck, Sparkles, Ticket, Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ErrorPanel, KeyValue, PageHeader } from '../components/app'
import { Badge, Button, Card, EmptyState, Field, Select, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { addDaysInZone, currency, formatDateInZone, formatInZone, formatTimeInZone, hhmm, toInstant } from '../lib/datetime'
import { cn } from '../lib/cn'
import { api } from '../services/api'
import type { SlotAvailability, SlotState, SlotType, VehicleType } from '../types'

const stateLabel: Record<SlotState, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  OCCUPIED: 'Occupied',
  OUT_OF_SERVICE: 'Out of service',
}

const typeLabel: Record<SlotType, string> = {
  STANDARD: 'Standard',
  COMPACT: 'Compact',
  LARGE: 'Large',
  EV: 'EV',
  ACCESSIBLE: 'Accessible',
  MOTORCYCLE: 'Motorcycle',
}

function SlotButton({ slot, selected, onSelect }: { slot: SlotAvailability; selected: boolean; onSelect: () => void }) {
  const getSlotStyle = () => {
    if (selected) {
      return 'border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-600 shadow-sm'
    }
    switch (slot.state) {
      case 'AVAILABLE':
        return 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400'
      case 'RESERVED':
        return 'border-amber-300 bg-amber-50 text-amber-800 cursor-not-allowed opacity-90'
      case 'OCCUPIED':
        return 'border-rose-300 bg-rose-50 text-rose-800 cursor-not-allowed opacity-90'
      case 'OUT_OF_SERVICE':
      default:
        return 'border-slate-300 bg-slate-100 text-slate-600 line-through font-medium cursor-not-allowed'
    }
  }

  return (
    <button
      type="button"
      disabled={!slot.bookable}
      onClick={onSelect}
      title={`${slot.slotCode} · ${typeLabel[slot.slotType]} · ${stateLabel[slot.state]}${slot.reason ? ` — ${slot.reason}` : ''}`}
      aria-pressed={selected}
      className={cn(
        'relative flex min-h-[56px] flex-col justify-between rounded-lg border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        getSlotStyle(),
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-xs font-bold tracking-tight">{slot.slotCode}</span>
        <span className="flex gap-0.5">
          {slot.evCharger && <Zap className="h-3 w-3 text-amber-500" />}
          {slot.accessible && <Accessibility className="h-3 w-3 text-brand-600" />}
        </span>
      </div>
      <span className="text-[9.5px] uppercase tracking-wide opacity-75">{typeLabel[slot.slotType]}</span>
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
          <CheckCircle2 className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}

export default function FacilityDetail() {
  const { isAdmin } = useAuth()
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  const initialDate = params.get('date') || addDaysInZone(zone, 1)
  const initialTime = params.get('time') || '10:00'
  const initialDuration = params.get('duration') || '2'

  const [draftDate, setDraftDate] = useState(initialDate)
  const [draftTime, setDraftTime] = useState(initialTime)
  const [draftDuration, setDraftDuration] = useState(initialDuration)
  const [applied, setApplied] = useState({ date: initialDate, time: initialTime, duration: initialDuration })

  const [vehicleType, setVehicleType] = useState<VehicleType | ''>((params.get('vehicleType') as VehicleType) || '')
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [evOnly, setEvOnly] = useState(false)
  const [activeFloor, setActiveFloor] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(params.get('slot'))

  const facilityQuery = useQuery({ queryKey: ['facility', id], queryFn: () => api.facility(id), enabled: Boolean(id) })

  const start = useMemo(() => {
    try { return toInstant(applied.date, applied.time, facilityQuery.data?.facility.timezone ?? zone) } catch { return null }
  }, [applied, facilityQuery.data?.facility.timezone, zone])
  const end = useMemo(() => start ? new Date(new Date(start).getTime() + Number(applied.duration) * 60 * 60_000).toISOString() : null, [start, applied.duration])

  const availability = useQuery({
    queryKey: ['facility-availability', id, start, end, vehicleType, accessibleOnly, evOnly],
    queryFn: () => api.availability(id, { start: start!, end: end!, vehicleType: vehicleType || undefined, accessible: accessibleOnly, ev: evOnly }),
    enabled: Boolean(id && start && end),
    retry: 0,
  })

  const facility = facilityQuery.data?.facility
  const floors = facilityQuery.data?.floors ?? []
  const slots = availability.data?.slots ?? []
  const bySlot = new Map(slots.map((slot) => [slot.slotId, slot]))
  const grouped = useMemo(() => {
    const map = new Map<string, { floorId: string; floorName: string; floorNumber: number; slots: SlotAvailability[] }>()
    for (const slot of slots) {
      const entry = map.get(slot.floorId) ?? { floorId: slot.floorId, floorName: slot.floorName, floorNumber: slot.floorNumber, slots: [] }
      entry.slots.push(slot)
      map.set(slot.floorId, entry)
    }
    return Array.from(map.values()).sort((a, b) => a.floorNumber - b.floorNumber)
  }, [slots])

  const selected = selectedSlot ? bySlot.get(selectedSlot) : undefined
  const hrefBase = new URLSearchParams({
    facility: id,
    date: applied.date,
    time: applied.time,
    duration: applied.duration,
  })

  const [calcHours, setCalcHours] = useState(2)

  const applyWindow = () => {
    setApplied({ date: draftDate, time: draftTime, duration: draftDuration })
    const next = new URLSearchParams(params)
    next.set('date', draftDate)
    next.set('time', draftTime)
    next.set('duration', draftDuration)
    setParams(next, { replace: true })
  }

  if (facilityQuery.isError) {
    return (
      <div>
        <PageHeader title="Parking Facility" backTo="/discover" backLabel="Back to facilities" />
        <ErrorPanel error={facilityQuery.error} onRetry={() => void facilityQuery.refetch()} title="This facility could not be loaded" />
      </div>
    )
  }

  if (facilityQuery.isPending || !facility) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-32 rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    )
  }

  const bookHref = (slotId?: string | null) => {
    const next = new URLSearchParams(hrefBase)
    if (slotId) next.set('slot', slotId)
    if (vehicleType) next.set('vehicleType', vehicleType)
    return `/book?${next.toString()}`
  }

  const windowLabel = `${applied.duration} hr · ${formatInZone(applied.date, facility.timezone, 'dd MMM yyyy')} from ${applied.time}`

  return (
    <div>
      <PageHeader
        backTo="/discover"
        backLabel="Back to facilities"
        eyebrow={`${facility.city} · ${facility.timezone}`}
        title={facility.name}
        description={facility.address}
        actions={
          isAdmin ? (
            <Link to="/admin?tab=facilities">
              <Button size="sm" variant="outline" icon={Layers3}>Manage Facility</Button>
            </Link>
          ) : (
            <Link to={bookHref(selectedSlot)}>
              <Button size="sm" icon={Sparkles}>Book at this facility</Button>
            </Link>
          )
        }
      />

      {/* Facility Summary Strip */}
      <Card className="mb-4 p-4">
        {(() => {
          const avail = availability.data?.bookableSlots ?? facility.availableSlots
          const occ = Math.min(100, Math.max(0, Math.round(((facility.totalSlots - avail) / (facility.totalSlots || 1)) * 100)))
          const isHigh = occ >= 80
          const isMed = occ >= 50 && occ < 80
          return (
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div>
                  <span className="text-[10.5px] uppercase font-semibold text-slate-500">Total bays</span>
                  <p className="mt-0.5 text-base font-bold text-slate-900">{facility.totalSlots} slots</p>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-semibold text-slate-500">Operating hours</span>
                  <p className="mt-0.5 text-base font-bold text-slate-900">{facility.opensAt.slice(0, 5)}–{facility.closesAt.slice(0, 5)}</p>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-semibold text-slate-500">Hourly rate</span>
                  <p className="mt-0.5 text-base font-bold text-slate-900">{facility.hourlyRate != null ? currency(facility.hourlyRate) : '—'}</p>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-semibold text-slate-500">Available For Window</span>
                  <p className="mt-0.5 text-base font-bold text-emerald-700">{avail} slots free</p>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-2.5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-600 font-medium">Real-Time Facility Demand</span>
                  <span className={isHigh ? 'font-bold text-rose-600' : isMed ? 'font-bold text-amber-600' : 'font-bold text-emerald-700'}>
                    {isHigh ? 'High Demand / Reserve Promptly' : isMed ? 'Moderate Traffic' : 'Optimal Availability'} ({occ}% Occupied)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${occ}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })()}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-4">
          {/* Interactive Live Bay Map */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Floor Plan & Slot Availability</h2>
                <p className="mt-0.5 text-xs text-slate-500">{windowLabel}</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Date" htmlFor="avail-date" className="w-[124px]">
                  <input id="avail-date" type="date" className="field h-8 py-0 text-xs" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
                </Field>
                <Field label="Start" htmlFor="avail-time" className="w-[88px]">
                  <input id="avail-time" type="time" className="field h-8 py-0 text-xs" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} />
                </Field>
                <Field label="Hours" htmlFor="avail-duration" className="w-[70px]">
                  <input id="avail-duration" type="number" min={1} max={12} className="field h-8 py-0 text-xs" value={draftDuration} onChange={(e) => setDraftDuration(e.target.value)} />
                </Field>
                <Button size="sm" icon={RefreshCw} onClick={applyWindow}>Check</Button>
              </div>
            </div>

            {/* Filter and Legend Bar */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 text-xs">
              <Select aria-label="Vehicle type" className="h-7 w-auto py-0 text-xs" value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType | '')}>
                <option value="">All vehicle types</option>
                <option value="CAR">Car</option>
                <option value="SUV">SUV</option>
                <option value="MOTORCYCLE">Motorcycle</option>
                <option value="EV">Electric Vehicle</option>
              </Select>
              <button
                type="button"
                onClick={() => setAccessibleOnly((v) => !v)}
                className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition', accessibleOnly ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                <Accessibility className="h-3 w-3" /> Accessible
              </button>
              <button
                type="button"
                onClick={() => setEvOnly((v) => !v)}
                className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition', evOnly ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                <Zap className="h-3 w-3" /> EV charger
              </button>

              {/* Required Legend Colors */}
              <div className="ml-auto flex flex-wrap items-center gap-2.5 text-[10.5px] text-slate-600">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Green (Available)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Amber (Reserved)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" /> Red (Occupied)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> Grey (Out of service)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-600" /> Blue (Selected)</span>
              </div>
            </div>

            {availability.isError && (
              <div className="mt-3"><ErrorPanel compact error={availability.error} onRetry={() => void availability.refetch()} title="Availability check error" /></div>
            )}

            {availability.isPending && (
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {Array.from({ length: 24 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            )}

            {!availability.isPending && !availability.isError && (
              <>
                {/* Floor Switcher */}
                <div className="scrollbar-thin mt-3 flex gap-1.5 overflow-x-auto pb-1">
                  {floors.map((floor) => {
                    const floorSlots = grouped.find((group) => group.floorId === floor.id)?.slots ?? []
                    const free = floorSlots.filter((s) => s.bookable).length
                    const isActive = activeFloor === floor.id || (activeFloor === null && floors[0]?.id === floor.id)
                    return (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => setActiveFloor(activeFloor === floor.id ? null : floor.id)}
                        className={cn(
                          'shrink-0 rounded-md border px-2.5 py-1.5 text-left transition',
                          isActive
                            ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700',
                        )}
                      >
                        <span className="block text-xs font-semibold">{floor.name}</span>
                        <span className="block text-[10px] text-slate-500">{free} of {floorSlots.length} free</span>
                      </button>
                    )
                  })}
                </div>

                {/* Slots Grid */}
                <div className="mt-4 space-y-4">
                  {grouped.filter((group) => activeFloor === null || group.floorId === activeFloor).map((group) => (
                    <div key={group.floorId}>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <Layers3 className="h-3.5 w-3.5 text-slate-500" /> {group.floorName}
                        </p>
                        <span className="text-slate-500 font-medium">{group.slots.filter((s) => s.bookable).length} bookable</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                        {group.slots.map((slot) => (
                          <SlotButton
                            key={slot.slotId}
                            slot={slot}
                            selected={selectedSlot === slot.slotId}
                            onSelect={() => setSelectedSlot(selectedSlot === slot.slotId ? null : slot.slotId)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {grouped.length === 0 && (
                  <EmptyState icon={CarFront} title="No bays matched your filters" description="Try clearing vehicle or accessibility filters to see available slots on this floor." />
                )}
              </>
            )}

            {/* Selected Slot Drawer */}
            {selected && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 font-mono text-xs font-bold text-white">
                    {selected.slotCode}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selected.floorName} · {typeLabel[selected.slotType]}</p>
                    <p className="text-[11px] text-slate-500">Held exclusively for your window upon booking.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedSlot(null)}>Clear</Button>
                  {isAdmin ? (
                    <Link to="/admin?tab=facilities">
                      <Button size="sm" variant="outline" icon={Layers3}>Manage Bay in Admin</Button>
                    </Link>
                  ) : (
                    <Link to={bookHref(selected.slotId)}>
                      <Button size="sm" icon={Ticket}>Book Selected Bay</Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Pricing Rules Table */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-900">Pricing Schedule</h2>
            <p className="mt-0.5 text-xs text-slate-500">Applicable rates calculated by the database pricing engine.</p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Rate Type</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Duration Band</th>
                    <th className="px-3 py-2">Validity</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(facilityQuery.data?.pricingRules ?? []).map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-800">{rule.rateType}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{currency(rule.amount)}</td>
                      <td className="px-3 py-2 text-slate-500">{rule.minimumDurationMinutes}–{rule.maximumDurationMinutes} min</td>
                      <td className="px-3 py-2 text-slate-500">{rule.effectiveFrom}{rule.effectiveTo ? ` → ${rule.effectiveTo}` : ''}</td>
                      <td className="px-3 py-2">
                        {rule.active ? <Badge tone="lime">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Sidebar Cards */}
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-semibold uppercase text-slate-500">Estimated Total</span>
              <Badge tone="brand"><ShieldCheck className="h-3 w-3" /> Verified Rate</Badge>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-slate-900">
                {currency(availability.data?.estimatedPrice ?? facility.hourlyRate ?? 0)}
                <span className="text-xs font-medium text-slate-500">
                  {availability.data?.estimatedPrice != null ? ` / ${applied.duration} hr` : ' / hr'}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {availability.data?.priceExplanation ?? 'Server-quoted pricing based on active pricing rules for this facility.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              {isAdmin ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-xs font-semibold text-slate-800">Admin Mode Active</p>
                  <p className="mt-1 text-[11px] text-slate-500">Reservations are disabled for admin accounts. Use the console to manage floors, bays, and rates.</p>
                  <Link to="/admin?tab=facilities" className="mt-2.5 block">
                    <Button size="sm" variant="outline" className="w-full" icon={Layers3}>Configure in Admin Console</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <Link to={bookHref(selected?.slotId)} className="block">
                    <Button className="w-full" size="md" icon={Ticket}>
                      {selected ? `Continue with bay ${selected.slotCode}` : 'Continue to Booking'}
                    </Button>
                  </Link>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    No upfront card collection. Settle at the facility gate.
                  </p>
                </>
              )}
            </div>
          </Card>

          {/* Quick Fare Calculator USP Widget */}
          <Card className="p-4 border-brand-100 bg-brand-50/20">
            <div className="flex items-center justify-between border-b border-brand-100 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-900">
                <Calculator className="h-3.5 w-3.5 text-brand-600" /> Quick Fare Estimator
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{currency(facility.hourlyRate ?? 50)}/hr base</span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] text-slate-600 mb-2">Simulate estimated parking charges for target stay:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 4, 8].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setCalcHours(h)}
                    className={cn(
                      'rounded-md border py-1.5 text-xs font-medium transition',
                      calcHours === h
                        ? 'border-brand-600 bg-brand-600 text-white font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    )}
                  >
                    {h} {h === 1 ? 'hr' : 'hrs'}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-md bg-white border border-slate-200 p-2.5">
                <span className="text-xs text-slate-500">Projected Fare ({calcHours} hrs)</span>
                <span className="text-base font-bold text-slate-900">
                  {currency(calcHours * (facility.hourlyRate ?? 50))}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">Facility Specifications</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <KeyValue label="Advance Booking">{facility.advanceBookingDays} days</KeyValue>
              <KeyValue label="Buffer Minutes">{facility.bufferMinutes} min</KeyValue>
              <KeyValue label="Cancel Cutoff">{facility.cancellationCutoffMinutes} min</KeyValue>
              <KeyValue label="Timezone">{facility.timezone}</KeyValue>
            </div>
            <div className="mt-3.5 border-t border-slate-100 pt-3">
              <span className="text-[10.5px] font-semibold uppercase text-slate-500">Amenities</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {facility.amenities.map((amenity) => (
                  <span key={amenity} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-md bg-slate-50 p-2.5 text-xs text-slate-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>Full window protection: If your plans change, cancellations prior to the cutoff window release your bay with no penalty.</span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
