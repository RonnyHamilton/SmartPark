import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, BarChart3, Building2, CalendarDays, CarFront, CheckCircle2, CircleDollarSign,
  ClipboardList, Clock3, DoorOpen, Download, Layers3, MapPin, Pencil, Plus, RefreshCw, Search, ShieldCheck,
  ShieldX, Ticket, Trash2, Users, XCircle, type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { ErrorPanel, InlineError, PageHeader, Pagination, Tabs } from '../components/app'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, StatusBadge, Textarea } from '../components/ui'
import { currency, formatInZone, formatTimeInZone, hhmm, relativeFromNow } from '../lib/datetime'
import { exportBookingsToCsv } from '../lib/exportCsv'
import { errorMessage } from '../lib/errors'
import { cn } from '../lib/cn'
import { api } from '../services/api'
import type {
  AdminUser, AuditEntry, Booking, BookingStatus, FacilitySummary, ParkingSlot, PricingRule, SlotType, VehicleType,
} from '../types'

type AdminTab = 'overview' | 'operations' | 'facilities' | 'bookings' | 'users' | 'audit'

const adminTabs: { value: AdminTab; label: string }[] = [
  { value: 'overview', label: 'Operations Overview' },
  { value: 'operations', label: 'No-Show & Overstay Operations' },
  { value: 'facilities', label: 'Facilities & Bays' },
  { value: 'bookings', label: 'All Reservations' },
  { value: 'users', label: 'User Directory' },
  { value: 'audit', label: 'System Audit Log' },
]

const allVehicleTypes: VehicleType[] = ['CAR', 'SUV', 'MOTORCYCLE', 'EV']
const slotTypes: SlotType[] = ['STANDARD', 'COMPACT', 'LARGE', 'EV', 'ACCESSIBLE', 'MOTORCYCLE']
const statuses: BookingStatus[] = [
  'PENDING', 'CONFIRMED', 'ACTIVE', 'OVERSTAY', 'NO_SHOW', 'CONFLICT_REQUIRES_ADMIN', 'COMPLETED', 'CANCELLED', 'EXPIRED'
]

interface FacilityFormState {
  name: string
  description: string
  address: string
  city: string
  latitude: string
  longitude: string
  timezone: string
  opensAt: string
  closesAt: string
  operatingDays: string
  amenities: string
  status: FacilitySummary['status']
  minDurationMinutes: string
  maxDurationMinutes: string
  advanceBookingDays: string
  cancellationCutoffMinutes: string
  checkInGracePeriodMinutes: string
  overstayMultiplier: string
  bufferMinutes: string
}

const blankFacility: FacilityFormState = {
  name: '', description: '', address: '', city: 'Pune', latitude: '', longitude: '',
  timezone: 'Asia/Kolkata', opensAt: '09:00', closesAt: '23:00',
  operatingDays: 'MON,TUE,WED,THU,FRI,SAT,SUN', amenities: '', status: 'ACTIVE',
  minDurationMinutes: '30', maxDurationMinutes: '720', advanceBookingDays: '14',
  cancellationCutoffMinutes: '60', checkInGracePeriodMinutes: '15', overstayMultiplier: '1.50',
  bufferMinutes: '15',
}

function Metric({ label, value, hint, icon: Icon, tone = 'light' }: {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone?: 'light' | 'brand'
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3.5 transition-colors',
      tone === 'brand' ? 'border-brand-200 bg-brand-50/40 text-slate-900' : 'border-slate-200 bg-white text-slate-900',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <Icon className={cn('h-4 w-4', tone === 'brand' ? 'text-brand-600' : 'text-slate-500')} />
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function OverviewTab() {
  const [range, setRange] = useState(30)
  const windowRange = useMemo(() => {
    const to = new Date()
    const from = new Date(to.getTime() - (range - 1) * 86_400_000)
    from.setHours(0, 0, 0, 0)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [range])

  const analytics = useQuery({
    queryKey: ['admin-analytics', windowRange.from, windowRange.to],
    queryFn: () => api.analytics(windowRange.from, windowRange.to),
  })

  if (analytics.isPending) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }
  if (analytics.isError) return <ErrorPanel error={analytics.error} onRetry={() => void analytics.refetch()} />

  const data = analytics.data!
  const daily = data.daily.map((point) => ({
    ...point,
    label: formatInZone(`${point.date}T00:00:00Z`, 'UTC', 'dd MMM'),
  }))

  const availableSlots = Math.max(0, data.totalSlots - data.currentlyOccupiedSlots)

  return (
    <div className="space-y-5">
      {/* 6 Core Administrative Metrics */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Database System Metrics</h2>
            <p className="text-xs text-slate-500">Live operational data from PostgreSQL</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRange(days)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition',
                    range === days ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {days}d
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => void analytics.refetch()}>
              Sync
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Metric label="Total Facilities" value={data.totalFacilities} hint="Managed locations" icon={Building2} />
          <Metric label="Total Bays" value={data.totalSlots} hint="Configured slots" icon={CarFront} />
          <Metric label="Available Bays" value={availableSlots} hint="Open for booking" icon={ShieldCheck} tone="brand" />
          <Metric label="Occupied Bays" value={data.currentlyOccupiedSlots} hint="Active sessions" icon={Activity} />
          <Metric label="Active Bookings" value={data.activeBookings} hint="Checked-in drivers" icon={Ticket} />
          <Metric label="Total Bookings" value={data.totalBookings} hint={`${data.completedBookings} completed`} icon={CalendarDays} />
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-end justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Booking Volume & Revenue Trend</h3>
              <p className="text-[11px] text-slate-500">{range}-day historical progression</p>
            </div>
            <div className="flex gap-3 text-[10.5px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-800" /> Bookings</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-600" /> Revenue</span>
            </div>
          </div>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminBookingFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={42} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }}
                  formatter={(val, name) => name === 'revenue' ? [currency(Number(val)), 'Revenue'] : [Number(val), 'Bookings']}
                />
                <Area yAxisId="left" type="monotone" dataKey="bookings" stroke="#172033" strokeWidth={1.8} fill="none" />
                <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={1.8} fill="url(#adminBookingFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Facility Revenue Breakdown */}
        <Card className="p-4 sm:p-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-semibold text-slate-900">Revenue by Facility</h3>
            <p className="text-[11px] text-slate-500">Distribution across active facilities</p>
          </div>
          <div className="mt-4 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byFacility} layout="vertical" margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="facilityName" width={100} tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={(val) => [currency(Number(val)), 'Revenue']} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
            {data.byFacility.slice(0, 4).map((f) => (
              <div key={f.facilityName} className="flex items-center justify-between text-slate-600">
                <span className="truncate">{f.facilityName}</span>
                <span className="font-semibold text-slate-900">{f.bookings} bookings</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Facility Occupancy Summary Table */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
          Facility Occupancy Summary
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Facility Name</th>
                <th className="px-3 py-2">Total Bookings</th>
                <th className="px-3 py-2">Cumulative Revenue</th>
                <th className="px-3 py-2">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byFacility.map((facility) => {
                const pct = data.revenueInRange > 0 ? ((facility.revenue / data.revenueInRange) * 100).toFixed(1) : '0'
                return (
                  <tr key={facility.facilityName} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{facility.facilityName}</td>
                    <td className="px-3 py-2.5 text-slate-600">{facility.bookings}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{currency(facility.revenue)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function OperationsTab() {
  const queryClient = useQueryClient()
  const dashboard = useQuery({
    queryKey: ['admin-overstay-dashboard'],
    queryFn: api.overstayDashboard,
    refetchInterval: 15_000,
  })

  const [resolvingBooking, setResolvingBooking] = useState<Booking | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [targetSlotId, setTargetSlotId] = useState('')

  const facilityDetail = useQuery({
    queryKey: ['admin-facility-slots', resolvingBooking?.facilityId],
    queryFn: () => api.adminFacility(resolvingBooking!.facilityId),
    enabled: Boolean(resolvingBooking?.facilityId),
  })

  const resolveMutation = useMutation({
    mutationFn: () =>
      api.resolveConflict(resolvingBooking!.id, {
        targetSlotId: targetSlotId || undefined,
        resolutionNotes: resolutionNotes.trim() || undefined,
      }),
    onSuccess: async () => {
      setResolvingBooking(null)
      setResolutionNotes('')
      setTargetSlotId('')
      toast.success('Conflict resolved successfully')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-overstay-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ])
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => api.checkOut(id),
    onSuccess: async () => {
      toast.success('Vehicle checked out and bay physically released')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-overstay-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
      ])
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const data = dashboard.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">No-Show & Overstay Operations</h2>
          <p className="text-xs text-slate-500">Live operational command center for physical occupancy overstays, no-show slot releases, and arrival conflicts.</p>
        </div>
        <Button size="sm" variant="outline" icon={RefreshCw} loading={dashboard.isFetching} onClick={() => void dashboard.refetch()}>
          Refresh Operations
        </Button>
      </div>

      {dashboard.isError && <ErrorPanel error={dashboard.error} onRetry={() => void dashboard.refetch()} />}

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Currently Overstaying"
          value={data?.activeOverstayCount ?? 0}
          icon={AlertTriangle}
          hint="Vehicles physically present past reservation end"
          tone={data?.activeOverstayCount ? 'brand' : 'light'}
        />
        <Metric
          label="Unresolved Bay Conflicts"
          value={data?.unresolvedConflictCount ?? 0}
          icon={ShieldX}
          hint="Upcoming arrivals blocked by overstaying vehicles"
          tone={data?.unresolvedConflictCount ? 'brand' : 'light'}
        />
        <Metric
          label="Lifetime No-Shows"
          value={data?.noShowCount ?? 0}
          icon={Activity}
          hint="Bookings cancelled automatically after grace period"
        />
      </div>

      {/* Section 1: Active Overstays */}
      <Card className="p-0 overflow-hidden border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Active Overstaying Vehicles ({data?.activeOverstays.length ?? 0})</h3>
            <p className="text-[11px] text-slate-500">Slots remain blocked until checkout is physically registered.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3.5 py-2.5">Facility / Bay</th>
                <th className="px-3.5 py-2.5">Vehicle</th>
                <th className="px-3.5 py-2.5">Scheduled End</th>
                <th className="px-3.5 py-2.5">Overstay Duration</th>
                <th className="px-3.5 py-2.5">Overstay Fee</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.activeOverstays.map((b) => (
                <tr key={b.id} className="hover:bg-rose-50/30">
                  <td className="px-3.5 py-3">
                    <p className="font-semibold text-slate-900">{b.facilityName}</p>
                    <p className="font-mono text-xs font-bold text-rose-700">{b.floorName} · {b.slotCode}</p>
                    <span className="font-mono text-[10px] text-slate-500">{b.bookingReference}</span>
                  </td>
                  <td className="px-3.5 py-3">
                    <p className="font-mono font-semibold text-slate-900">{b.vehicleRegistration}</p>
                    <span className="text-[11px] text-slate-500">{b.vehicleType}</span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">
                    {formatInZone(b.endTime, b.facilityTimezone, 'dd MMM HH:mm')}
                  </td>
                  <td className="px-3.5 py-3 font-semibold text-rose-600">
                    <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 border border-rose-200">
                      <Clock3 className="h-3 w-3" /> {b.overstayDurationMinutes ?? 0} min
                    </span>
                  </td>
                  <td className="px-3.5 py-3 font-bold text-slate-900">
                    {currency(b.overstayCharge ?? 0, b.currency)}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="dark"
                        icon={DoorOpen}
                        loading={checkOutMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Force check-out vehicle ${b.vehicleRegistration} from bay ${b.slotCode}?`)) {
                            checkOutMutation.mutate(b.id)
                          }
                        }}
                      >
                        Force Check-out
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.activeOverstays.length === 0 && (
          <div className="p-6">
            <EmptyState icon={CheckCircle2} title="No vehicles overstaying" description="All parking bays are operating within their scheduled reservation windows." />
          </div>
        )}
      </Card>

      {/* Section 2: Unresolved Conflicts */}
      <Card className="p-0 overflow-hidden border-slate-200">
        <div className="border-b border-slate-200 bg-amber-50/50 px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">Arrival Conflicts Requiring Admin Intervention ({data?.unresolvedConflicts.length ?? 0})</h3>
            <p className="text-[11px] text-amber-700">Reservations whose reserved bays were physically blocked and could not be auto-reallocated.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3.5 py-2.5">Customer / Ref</th>
                <th className="px-3.5 py-2.5">Facility / Target Bay</th>
                <th className="px-3.5 py-2.5">Scheduled Window</th>
                <th className="px-3.5 py-2.5">Conflict Reason</th>
                <th className="px-3.5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.unresolvedConflicts.map((b) => (
                <tr key={b.id} className="hover:bg-amber-50/30">
                  <td className="px-3.5 py-3">
                    <p className="font-mono font-bold text-slate-900">{b.bookingReference}</p>
                    <p className="text-[11px] text-slate-600">{b.vehicleRegistration} ({b.vehicleType})</p>
                  </td>
                  <td className="px-3.5 py-3">
                    <p className="font-semibold text-slate-900">{b.facilityName}</p>
                    <p className="font-mono text-xs text-amber-800">{b.floorName} · {b.slotCode}</p>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">
                    {formatInZone(b.startTime, b.facilityTimezone, 'dd MMM HH:mm')} – {formatTimeInZone(b.endTime, b.facilityTimezone)}
                  </td>
                  <td className="px-3.5 py-3 text-xs text-amber-800 font-medium">
                    {b.conflictReason ?? 'Bay physically blocked by overstaying vehicle'}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Pencil}
                      onClick={() => {
                        setResolvingBooking(b)
                        setTargetSlotId('')
                        setResolutionNotes('')
                      }}
                    >
                      Resolve Conflict
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.unresolvedConflicts.length === 0 && (
          <div className="p-6">
            <EmptyState icon={ShieldCheck} title="No unresolved conflicts" description="All upcoming reservations have verified available bays." />
          </div>
        )}
      </Card>

      {/* Section 3: Recent No-Shows */}
      <Card className="p-0 overflow-hidden border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Recent No-Show Bookings ({data?.recentNoShows.length ?? 0})</h3>
            <p className="text-[11px] text-slate-500">Bookings automatically transitioned when customer failed to arrive within grace period.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3.5 py-2.5">Booking Ref</th>
                <th className="px-3.5 py-2.5">Facility / Bay</th>
                <th className="px-3.5 py-2.5">Vehicle</th>
                <th className="px-3.5 py-2.5">Scheduled Start</th>
                <th className="px-3.5 py-2.5">No-Show Detected</th>
                <th className="px-3.5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.recentNoShows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{b.bookingReference}</td>
                  <td className="px-3.5 py-3">
                    <p className="font-semibold text-slate-900">{b.facilityName}</p>
                    <p className="text-slate-500 font-mono text-[11px]">{b.floorName} · {b.slotCode}</p>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono">{b.vehicleRegistration}</td>
                  <td className="px-3.5 py-3 text-slate-600">{formatInZone(b.startTime, b.facilityTimezone, 'dd MMM HH:mm')}</td>
                  <td className="px-3.5 py-3 text-slate-600">
                    {b.noShowDetectedAt ? formatInZone(b.noShowDetectedAt, b.facilityTimezone, 'dd MMM HH:mm:ss') : '—'}
                  </td>
                  <td className="px-3.5 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.recentNoShows.length === 0 && (
          <div className="p-6">
            <EmptyState icon={ClipboardList} title="No recent no-shows" description="No confirmed bookings have expired without check-in." />
          </div>
        )}
      </Card>

      {/* Conflict Resolution Modal */}
      <Modal
        open={Boolean(resolvingBooking)}
        onClose={() => setResolvingBooking(null)}
        title="Resolve Arrival Slot Conflict"
        description={`Resolve conflict for booking ${resolvingBooking?.bookingReference} at ${resolvingBooking?.facilityName}.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResolvingBooking(null)}>Cancel</Button>
            <Button size="sm" loading={resolveMutation.isPending} onClick={() => resolveMutation.mutate()}>
              Confirm Resolution
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-amber-900">
            Current Bay: <strong className="font-mono">{resolvingBooking?.slotCode}</strong> ({resolvingBooking?.floorName})
            <br />
            Scheduled Window: {resolvingBooking && `${formatInZone(resolvingBooking.startTime, resolvingBooking.facilityTimezone, 'HH:mm')} – ${formatTimeInZone(resolvingBooking.endTime, resolvingBooking.facilityTimezone)}`}
          </div>

          <Field label="Reassign to Alternate Bay (Optional)" hint="Select an alternate compatible bay, or leave blank to confirm original bay is now clear.">
            <Select value={targetSlotId} onChange={(e) => setTargetSlotId(e.target.value)}>
              <option value="">Keep current bay ({resolvingBooking?.slotCode}) – vehicle has cleared</option>
              {facilityDetail.data?.floors.flatMap((f) =>
                f.slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {f.name} - Bay {s.slotCode} ({s.slotType}, {s.status})
                  </option>
                ))
              )}
            </Select>
          </Field>

          <Field label="Resolution Notes" hint="Explain resolution rationale for audit log.">
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g. Overstaying vehicle departed; customer confirmed cleared into original bay."
            />
          </Field>

          {resolveMutation.isError && <InlineError error={resolveMutation.error} />}
        </div>
      </Modal>
    </div>
  )
}

function FacilitiesTab() {
  const queryClient = useQueryClient()
  const facilities = useQuery({ queryKey: ['admin-facilities'], queryFn: api.adminFacilities })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FacilitySummary | null>(null)
  const [form, setForm] = useState<FacilityFormState>(blankFacility)
  const [formError, setFormError] = useState<string | null>(null)
  const [manageId, setManageId] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => editing ? api.updateFacility(editing.id, payload) : api.createFacility(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
      ])
      setModalOpen(false)
      toast.success(editing ? 'Facility updated' : 'Facility created')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteFacility(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-facilities'] })
      toast.success('Facility deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(blankFacility)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (facility: FacilitySummary) => {
    setEditing(facility)
    setForm({
      name: facility.name, description: facility.description, address: facility.address, city: facility.city,
      latitude: facility.latitude != null ? String(facility.latitude) : '', longitude: facility.longitude != null ? String(facility.longitude) : '',
      timezone: facility.timezone, opensAt: hhmm(facility.opensAt), closesAt: hhmm(facility.closesAt),
      operatingDays: facility.operatingDays, amenities: facility.amenities.join(', '), status: facility.status,
      minDurationMinutes: String(facility.minDurationMinutes), maxDurationMinutes: String(facility.maxDurationMinutes),
      advanceBookingDays: String(facility.advanceBookingDays), cancellationCutoffMinutes: String(facility.cancellationCutoffMinutes),
      checkInGracePeriodMinutes: String(facility.checkInGracePeriodMinutes ?? 15),
      overstayMultiplier: String(facility.overstayMultiplier ?? 1.5),
      bufferMinutes: String(facility.bufferMinutes),
    })
    setFormError(null)
    setModalOpen(true)
  }

  const submit = () => {
    if (!form.name.trim() || !form.address.trim() || !form.city.trim()) {
      setFormError('Name, address and city are required.')
      return
    }
    if (!/^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/.test(form.operatingDays.trim().toUpperCase())) {
      setFormError('Operating days must be comma-separated codes such as MON,TUE.')
      return
    }
    if (Number(form.maxDurationMinutes) <= Number(form.minDurationMinutes)) {
      setFormError('Maximum duration must exceed minimum duration.')
      return
    }
    setFormError(null)
    save.mutate({
      name: form.name.trim(), description: form.description.trim(), address: form.address.trim(), city: form.city.trim(),
      latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null,
      timezone: form.timezone.trim(), opensAt: form.opensAt, closesAt: form.closesAt,
      operatingDays: form.operatingDays.trim().toUpperCase(),
      amenities: form.amenities.split(',').map((a) => a.trim()).filter(Boolean),
      status: form.status,
      minDurationMinutes: Number(form.minDurationMinutes), maxDurationMinutes: Number(form.maxDurationMinutes),
      advanceBookingDays: Number(form.advanceBookingDays), cancellationCutoffMinutes: Number(form.cancellationCutoffMinutes),
      checkInGracePeriodMinutes: Number(form.checkInGracePeriodMinutes || 15),
      overstayMultiplier: Number(form.overstayMultiplier || 1.5),
      bufferMinutes: Number(form.bufferMinutes),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Facility Master Catalog</h2>
          <p className="text-xs text-slate-500">Configure facilities, manage parking floors, individual bays and price bands.</p>
        </div>
        <Button size="sm" icon={Plus} onClick={openCreate}>Register Facility</Button>
      </div>

      {facilities.isError ? (
        <ErrorPanel error={facilities.error} onRetry={() => void facilities.refetch()} />
      ) : facilities.isPending ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3.5 py-2.5">Facility</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Capacity</th>
                  <th className="px-3.5 py-2.5">Base Rate</th>
                  <th className="px-3.5 py-2.5">Policies</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facilities.data?.map((facility) => (
                  <tr key={facility.id} className="hover:bg-slate-50/50">
                    <td className="px-3.5 py-3">
                      <p className="font-semibold text-slate-900">{facility.name}</p>
                      <p className="text-[11px] text-slate-500">{facility.city} · {facility.address}</p>
                    </td>
                    <td className="px-3.5 py-3">
                      <Badge tone={facility.status === 'ACTIVE' ? 'lime' : facility.status === 'MAINTENANCE' ? 'amber' : 'neutral'}>
                        {facility.status}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="font-bold text-slate-900">{facility.totalSlots}</span>{' '}
                      <span className="text-slate-500">({facility.availableSlots} free)</span>
                    </td>
                    <td className="px-3.5 py-3 font-medium text-slate-900">
                      {facility.hourlyRate != null ? `${currency(facility.hourlyRate)}/hr` : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-[11px] text-slate-500">
                      {facility.minDurationMinutes}–{facility.maxDurationMinutes}m · Cutoff {facility.cancellationCutoffMinutes}m
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" icon={Layers3} onClick={() => setManageId(facility.id)}>
                          Floors & Bays
                        </Button>
                        <Button size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(facility)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={Trash2}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => {
                            if (window.confirm(`Delete ${facility.name}? This action is rejected if reservations exist.`)) {
                              remove.mutate(facility.id)
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {facilities.data?.length === 0 && (
            <div className="p-6">
              <EmptyState icon={Building2} title="No facilities configured" description="Register a parking facility to begin allocating bays." action={<Button size="sm" icon={Plus} onClick={openCreate}>Register Facility</Button>} />
            </div>
          )}
        </Card>
      )}

      {/* Facility Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Facility' : 'Register New Facility'}
        description="Facility parameters determine booking window constraints and pricing resolution."
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" loading={save.isPending} onClick={submit}>{editing ? 'Save Changes' : 'Create Facility'}</Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {formError && <InlineError error={new Error(formError)} />}
          {save.isError && <InlineError error={save.error} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Facility Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="City" required><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          </div>
          <Field label="Address" required><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Latitude"><Input type="number" step="0.000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Field>
            <Field label="Longitude"><Input type="number" step="0.000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Field>
            <Field label="Opens"><Input type="time" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} /></Field>
            <Field label="Closes"><Input type="time" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Timezone"><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></Field>
            <Field label="Operating Days" hint="MON,TUE,..."><Input value={form.operatingDays} onChange={(e) => setForm({ ...form, operatingDays: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FacilitySummary['status'] })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="MAINTENANCE">Maintenance</option>
              </Select>
            </Field>
          </div>
          <Field label="Amenities" hint="Comma-separated (e.g. CCTV, EV Charging)"><Input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} /></Field>
          <div className="grid gap-2.5 sm:grid-cols-5">
            <Field label="Min Duration (m)"><Input type="number" min="15" value={form.minDurationMinutes} onChange={(e) => setForm({ ...form, minDurationMinutes: e.target.value })} /></Field>
            <Field label="Max Duration (m)"><Input type="number" min="30" value={form.maxDurationMinutes} onChange={(e) => setForm({ ...form, maxDurationMinutes: e.target.value })} /></Field>
            <Field label="Advance Days"><Input type="number" min="1" value={form.advanceBookingDays} onChange={(e) => setForm({ ...form, advanceBookingDays: e.target.value })} /></Field>
            <Field label="Cancel Cutoff (m)"><Input type="number" min="0" value={form.cancellationCutoffMinutes} onChange={(e) => setForm({ ...form, cancellationCutoffMinutes: e.target.value })} /></Field>
            <Field label="Buffer (m)"><Input type="number" min="0" value={form.bufferMinutes} onChange={(e) => setForm({ ...form, bufferMinutes: e.target.value })} /></Field>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Check-In Grace Period (min)" hint="Default 15 min. No-show marked when exceeded.">
              <Input type="number" min="5" max="60" value={form.checkInGracePeriodMinutes} onChange={(e) => setForm({ ...form, checkInGracePeriodMinutes: e.target.value })} />
            </Field>
            <Field label="Overstay Multiplier" hint="Multiplier applied to hourly rate for overstaying (e.g. 1.50).">
              <Input type="number" step="0.1" min="1.0" max="5.0" value={form.overstayMultiplier} onChange={(e) => setForm({ ...form, overstayMultiplier: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      <ManageFacilityModal facilityId={manageId} onClose={() => setManageId(null)} />
    </div>
  )
}

function ManageFacilityModal({ facilityId, onClose }: { facilityId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: ['admin-facility', facilityId], queryFn: () => api.adminFacility(facilityId!), enabled: Boolean(facilityId) })
  const [floorForm, setFloorForm] = useState({ name: '', floorNumber: '1', displayOrder: '1' })
  const [slotModal, setSlotModal] = useState<{ floorId: string; slot: ParkingSlot | null } | null>(null)
  const [slotForm, setSlotForm] = useState({
    slotCode: '', slotType: 'STANDARD' as SlotType, supportedVehicleTypes: ['CAR', 'SUV'] as VehicleType[],
    accessible: false, evCharger: false, widthM: '2.5', lengthM: '5', status: 'AVAILABLE' as 'AVAILABLE' | 'OUT_OF_SERVICE', layoutX: '', layoutY: '',
  })
  const [pricingModal, setPricingModal] = useState<{ rule: PricingRule | null } | null>(null)
  const [pricingForm, setPricingForm] = useState({
    rateType: 'HOURLY' as PricingRule['rateType'], amount: '50', minimumDurationMinutes: '30', maximumDurationMinutes: '720',
    effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', active: true,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-facility', facilityId] }),
      queryClient.invalidateQueries({ queryKey: ['admin-facilities'] }),
      queryClient.invalidateQueries({ queryKey: ['facilities'] }),
    ])
  }

  const floorMutation = useMutation({
    mutationFn: () => api.createFloor(facilityId!, { name: floorForm.name.trim(), floorNumber: Number(floorForm.floorNumber), displayOrder: Number(floorForm.displayOrder) }),
    onSuccess: async () => { setFloorForm({ name: '', floorNumber: '1', displayOrder: '1' }); await refresh(); toast.success('Floor added') },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const deleteFloor = useMutation({
    mutationFn: (id: string) => api.deleteFloor(id),
    onSuccess: async () => { await refresh(); toast.success('Floor removed') },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const slotMutation = useMutation({
    mutationFn: ({ floorId, slot }: { floorId: string; slot: ParkingSlot | null }) => {
      const body = {
        slotCode: slotForm.slotCode.trim().toUpperCase(), slotType: slotForm.slotType,
        supportedVehicleTypes: slotForm.supportedVehicleTypes,
        accessible: slotForm.accessible, evCharger: slotForm.evCharger,
        widthM: slotForm.widthM ? Number(slotForm.widthM) : null, lengthM: slotForm.lengthM ? Number(slotForm.lengthM) : null,
        status: slotForm.status, layoutX: slotForm.layoutX ? Number(slotForm.layoutX) : null, layoutY: slotForm.layoutY ? Number(slotForm.layoutY) : null,
      }
      return slot ? api.updateSlot(slot.id, body) : api.createSlot(floorId, body)
    },
    onSuccess: async () => { setSlotModal(null); await refresh(); toast.success('Bay saved') },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const deleteSlot = useMutation({
    mutationFn: (id: string) => api.deleteSlot(id),
    onSuccess: async () => { await refresh(); toast.success('Bay removed') },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const pricingMutation = useMutation({
    mutationFn: () => {
      const body = {
        rateType: pricingForm.rateType, amount: Number(pricingForm.amount),
        minimumDurationMinutes: Number(pricingForm.minimumDurationMinutes), maximumDurationMinutes: Number(pricingForm.maximumDurationMinutes),
        effectiveFrom: pricingForm.effectiveFrom, effectiveTo: pricingForm.effectiveTo || null, active: pricingForm.active,
      }
      return pricingModal?.rule ? api.updatePricing(pricingModal.rule.id, body) : api.createPricing(facilityId!, body)
    },
    onSuccess: async () => { setPricingModal(null); await refresh(); toast.success('Pricing rule saved') },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const deletePricing = useMutation({
    mutationFn: (id: string) => api.deletePricing(id),
    onSuccess: async () => { await refresh(); toast.success('Pricing rule deleted') },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const openSlot = (floorId: string, slot: ParkingSlot | null) => {
    setFormError(null)
    setSlotModal({ floorId, slot })
    if (slot) {
      setSlotForm({
        slotCode: slot.slotCode, slotType: slot.slotType, supportedVehicleTypes: slot.supportedVehicleTypes,
        accessible: slot.accessible, evCharger: slot.evCharger, widthM: slot.widthM != null ? String(slot.widthM) : '',
        lengthM: slot.lengthM != null ? String(slot.lengthM) : '', status: slot.status,
        layoutX: slot.layoutX != null ? String(slot.layoutX) : '', layoutY: slot.layoutY != null ? String(slot.layoutY) : '',
      })
    } else {
      setSlotForm({ slotCode: '', slotType: 'STANDARD', supportedVehicleTypes: ['CAR', 'SUV'], accessible: false, evCharger: false, widthM: '2.5', lengthM: '5', status: 'AVAILABLE', layoutX: '', layoutY: '' })
    }
  }

  const openPricing = (rule: PricingRule | null) => {
    setPricingModal({ rule })
    setPricingForm(rule ? {
      rateType: rule.rateType, amount: String(rule.amount), minimumDurationMinutes: String(rule.minimumDurationMinutes),
      maximumDurationMinutes: String(rule.maximumDurationMinutes), effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo ?? '', active: rule.active,
    } : {
      rateType: 'HOURLY', amount: '50', minimumDurationMinutes: '30', maximumDurationMinutes: '720',
      effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', active: true,
    })
  }

  return (
    <>
      <Modal open={Boolean(facilityId)} onClose={onClose} title={detail.data?.facility.name ?? 'Facility Configuration'} description="Manage floors, slot codes, dimension constraints and pricing tiers." size="lg">
        {detail.isError ? (
          <ErrorPanel error={detail.error} onRetry={() => void detail.refetch()} />
        ) : detail.isPending ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
        ) : (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[10px] uppercase font-semibold text-slate-500">Floors</span>
                <p className="mt-0.5 text-base font-bold text-slate-900">{detail.data?.floors.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[10.5px] uppercase font-semibold text-slate-500">Total Bays</span>
                <p className="mt-0.5 text-base font-bold text-slate-900">{detail.data?.facility.totalSlots}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[10.5px] uppercase font-semibold text-slate-500">Hours</span>
                <p className="mt-0.5 font-bold text-slate-900">{hhmm(detail.data?.facility.opensAt ?? '')}–{hhmm(detail.data?.facility.closesAt ?? '')}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[10.5px] uppercase font-semibold text-slate-500">Zone</span>
                <p className="mt-0.5 font-bold text-slate-900 truncate">{detail.data?.facility.timezone}</p>
              </div>
            </div>

            <section>
              <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">Floors & Bays</h3>
              <div className="mt-3 space-y-3">
                {detail.data?.floors.map((floor) => (
                  <div key={floor.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-bold text-slate-900">{floor.name}</span>
                        <span className="ml-2 text-slate-500">Level {floor.floorNumber} · {floor.slots.length} bays</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" icon={Plus} onClick={() => openSlot(floor.id, null)}>Add Bay</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={Trash2}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => {
                            if (window.confirm(`Delete ${floor.name} and all its slots?`)) deleteFloor.mutate(floor.id)
                          }}
                        >
                          Delete Floor
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {floor.slots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => openSlot(floor.id, slot)}
                          title="Edit bay parameters"
                          className={cn(
                            'rounded border px-2 py-1 font-mono text-[10.5px] font-semibold transition',
                            slot.status === 'AVAILABLE'
                              ? 'border-slate-200 bg-white text-slate-800 hover:border-brand-500'
                              : 'border-rose-200 bg-rose-50 text-rose-700',
                          )}
                        >
                          {slot.slotCode}
                          {slot.evCharger ? ' ⚡' : ''}
                          {slot.accessible ? ' ♿' : ''}
                        </button>
                      ))}
                      {floor.slots.length === 0 && <span className="text-slate-500">No bays created yet.</span>}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if (!floorForm.name.trim()) return; floorMutation.mutate() }} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-2.5 sm:grid-cols-[1fr_80px_80px_auto]">
                <Input placeholder="Floor Name (e.g. Level 1)" value={floorForm.name} onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })} />
                <Input type="number" placeholder="Level" value={floorForm.floorNumber} onChange={(e) => setFloorForm({ ...floorForm, floorNumber: e.target.value })} />
                <Input type="number" placeholder="Order" value={floorForm.displayOrder} onChange={(e) => setFloorForm({ ...floorForm, displayOrder: e.target.value })} />
                <Button type="submit" size="sm" loading={floorMutation.isPending} icon={Plus}>Add Floor</Button>
              </form>
            </section>

            <section>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-semibold text-slate-900">Pricing Schedule</h3>
                <Button size="sm" variant="outline" icon={Plus} onClick={() => openPricing(null)}>Add Pricing Rule</Button>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {detail.data?.pricingRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between rounded-md border border-slate-200 p-2.5">
                    <div>
                      <span className="font-bold text-slate-900">{currency(rule.amount)}</span>
                      <span className="ml-2 text-slate-500">{rule.rateType.toLowerCase()}</span>
                      <span className="ml-2">
                        <Badge tone={rule.active ? 'lime' : 'neutral'}>{rule.active ? 'Active' : 'Inactive'}</Badge>
                      </span>
                      <p className="mt-0.5 text-[10.5px] text-slate-500 font-medium">{rule.minimumDurationMinutes}–{rule.maximumDurationMinutes} min</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" icon={Pencil} onClick={() => openPricing(rule)}>Edit</Button>
                      <Button size="sm" variant="outline" icon={Trash2} className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => { if (window.confirm('Delete pricing rule?')) deletePricing.mutate(rule.id) }}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Modal>

      {/* Slot Modal */}
      <Modal
        open={Boolean(slotModal)}
        onClose={() => setSlotModal(null)}
        title={slotModal?.slot ? 'Edit Parking Slot' : 'Add Parking Slot'}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSlotModal(null)}>Cancel</Button>
            <Button
              size="sm"
              loading={slotMutation.isPending}
              onClick={() => {
                if (!slotForm.slotCode.trim() || slotForm.supportedVehicleTypes.length === 0) {
                  setFormError('Slot code and at least one vehicle type are required.')
                  return
                }
                setFormError(null)
                if (slotModal) slotMutation.mutate({ floorId: slotModal.floorId, slot: slotModal.slot })
              }}
            >
              {slotModal?.slot ? 'Save Bay' : 'Create Bay'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {formError && <InlineError error={new Error(formError)} />}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Field label="Slot Code" required><Input value={slotForm.slotCode} onChange={(e) => setSlotForm({ ...slotForm, slotCode: e.target.value })} /></Field>
            <Field label="Type" required>
              <Select value={slotForm.slotType} onChange={(e) => setSlotForm({ ...slotForm, slotType: e.target.value as SlotType })}>
                {slotTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={slotForm.status} onChange={(e) => setSlotForm({ ...slotForm, status: e.target.value as 'AVAILABLE' | 'OUT_OF_SERVICE' })}>
                <option value="AVAILABLE">Available</option>
                <option value="OUT_OF_SERVICE">Out of Service</option>
              </Select>
            </Field>
          </div>
          <Field label="Compatible Vehicle Classes">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {allVehicleTypes.map((type) => {
                const selected = slotForm.supportedVehicleTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSlotForm({ ...slotForm, supportedVehicleTypes: selected ? slotForm.supportedVehicleTypes.filter((t) => t !== type) : [...slotForm.supportedVehicleTypes, type] })}
                    className={cn('rounded border px-2.5 py-1 text-xs font-medium', selected ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold' : 'border-slate-200 bg-white text-slate-600')}
                  >
                    {type}
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSlotForm({ ...slotForm, accessible: !slotForm.accessible })} className={cn('rounded border px-2.5 py-1 text-xs font-medium', slotForm.accessible ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold' : 'border-slate-200 bg-white text-slate-600')}>Accessible Bay</button>
            <button type="button" onClick={() => setSlotForm({ ...slotForm, evCharger: !slotForm.evCharger })} className={cn('rounded border px-2.5 py-1 text-xs font-medium', slotForm.evCharger ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold' : 'border-slate-200 bg-white text-slate-600')}>EV Charger Equipped</button>
          </div>
        </div>
      </Modal>

      {/* Pricing Rule Modal */}
      <Modal
        open={Boolean(pricingModal)}
        onClose={() => setPricingModal(null)}
        title={pricingModal?.rule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPricingModal(null)}>Cancel</Button>
            <Button size="sm" loading={pricingMutation.isPending} onClick={() => pricingMutation.mutate()}>Save Pricing Rule</Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Rate Type">
              <Select value={pricingForm.rateType} onChange={(e) => setPricingForm({ ...pricingForm, rateType: e.target.value as PricingRule['rateType'] })}>
                <option value="HOURLY">Hourly</option>
                <option value="DAILY">Daily</option>
                <option value="FLAT">Flat</option>
              </Select>
            </Field>
            <Field label="Amount (₹)">
              <Input type="number" step="0.01" min="0" value={pricingForm.amount} onChange={(e) => setPricingForm({ ...pricingForm, amount: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Min Duration (m)"><Input type="number" min="15" value={pricingForm.minimumDurationMinutes} onChange={(e) => setPricingForm({ ...pricingForm, minimumDurationMinutes: e.target.value })} /></Field>
            <Field label="Max Duration (m)"><Input type="number" min="30" value={pricingForm.maximumDurationMinutes} onChange={(e) => setPricingForm({ ...pricingForm, maximumDurationMinutes: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>
    </>
  )
}

function BookingsTab() {
  const facilities = useQuery({ queryKey: ['admin-facilities'], queryFn: api.adminFacilities })
  const [status, setStatus] = useState<BookingStatus | ''>('')
  const [facilityId, setFacilityId] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const bookings = useQuery({
    queryKey: ['admin-bookings', status, facilityId, search, page],
    queryFn: () => api.adminBookings({ status: status || undefined, facilityId: facilityId || undefined, search: search || undefined, page, size: 15 }),
  })

  const cancel = useMutation({
    mutationFn: () => api.cancelBooking(cancelTarget!.id, reason.trim() || undefined),
    onSuccess: async () => {
      setCancelTarget(null)
      setReason('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
      ])
      toast.success('Reservation cancelled')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const applySearch = (e: FormEvent) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(0) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">All Reservations</h2>
          <p className="text-xs text-slate-500">Search by booking reference or driver email. Administrator cancellations bypass user cutoff.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select className="h-8 w-auto py-0 text-xs" value={status} onChange={(e) => { setStatus(e.target.value as BookingStatus | ''); setPage(0) }}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select className="h-8 w-auto py-0 text-xs" value={facilityId} onChange={(e) => { setFacilityId(e.target.value); setPage(0) }}>
            <option value="">All facilities</option>
            {facilities.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
          <form onSubmit={applySearch} className="flex gap-1.5">
            <Input className="h-8 w-[200px] py-0 text-xs" placeholder="Reference or email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <Button type="submit" size="sm" variant="outline" icon={Search}>Search</Button>
          </form>
          <Button
            size="sm"
            variant="outline"
            icon={Download}
            disabled={!bookings.data?.content.length}
            onClick={() => exportBookingsToCsv(bookings.data?.content ?? [], `smartpark-admin-bookings-${new Date().toISOString().slice(0, 10)}.csv`)}
            title="Export all visible reservations to CSV spreadsheet"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {bookings.isError ? (
        <ErrorPanel error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : bookings.isPending ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3.5 py-2.5">Reference</th>
                  <th className="px-3.5 py-2.5">Facility / Bay</th>
                  <th className="px-3.5 py-2.5">Window</th>
                  <th className="px-3.5 py-2.5">Vehicle</th>
                  <th className="px-3.5 py-2.5">Total</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.data?.content.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/50">
                    <td className="px-3.5 py-2.5">
                      <p className="font-mono font-bold text-slate-900">{booking.bookingReference}</p>
                      <p className="text-[10.5px] text-slate-500">{relativeFromNow(booking.createdAt)}</p>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <p className="font-semibold text-slate-900">{booking.facilityName}</p>
                      <p className="text-[10.5px] text-slate-500">{booking.floorName} · <span className="font-mono">{booking.slotCode}</span></p>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <p>{formatInZone(booking.startTime, booking.facilityTimezone, 'dd MMM yyyy')}</p>
                      <p className="text-[10.5px] text-slate-500">{formatTimeInZone(booking.startTime, booking.facilityTimezone)}–{formatTimeInZone(booking.endTime, booking.facilityTimezone)}</p>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <p className="font-medium">{booking.vehicleRegistration}</p>
                      <p className="text-[10.5px] text-slate-500">{booking.vehicleType}</p>
                    </td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">{currency(booking.priceAmount, booking.currency)}</td>
                    <td className="px-3.5 py-2.5"><StatusBadge status={booking.status} /></td>
                    <td className="px-3.5 py-2.5 text-right">
                      {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                        <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={XCircle} onClick={() => { setReason(''); setCancelTarget(booking) }}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bookings.data?.content.length === 0 && (
            <div className="p-6"><EmptyState icon={Ticket} title="No reservations found" description="Adjust search query or status filter." /></div>
          )}
        </Card>
      )}
      <Pagination page={page} totalPages={bookings.data?.totalPages ?? 0} onChange={setPage} totalElements={bookings.data?.totalElements} />

      {/* Cancel Reservation Modal */}
      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel Reservation as Admin" description={cancelTarget ? `${cancelTarget.bookingReference} at ${cancelTarget.facilityName}` : ''} size="sm" footer={<><Button variant="ghost" size="sm" onClick={() => setCancelTarget(null)}>Keep</Button><Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel Reservation</Button></>}>
        <Field label="Cancellation Audit Note" hint="Stored with the reservation record for audit compliance.">
          <Textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Administrative reason for cancellation..." />
        </Field>
      </Modal>
    </div>
  )
}

function UsersTab() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const users = useQuery({ queryKey: ['admin-users', q, page], queryFn: () => api.adminUsers({ q: q || undefined, page, size: 15 }) })

  const mutateUser = useMutation({
    mutationFn: ({ user, action, value }: { user: AdminUser; action: 'status' | 'role'; value: string }) =>
      action === 'status' ? api.setUserStatus(user.id, user.accountStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE') : api.setUserRole(user.id, value as 'USER' | 'ADMIN'),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ])
      toast.success('User updated')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">User Directory</h2>
          <p className="text-xs text-slate-500">Manage authorization roles and account operational status.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setQ(searchInput.trim()); setPage(0) }} className="flex gap-1.5">
          <Input className="h-8 w-[220px] py-0 text-xs" placeholder="Search name or email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <Button type="submit" size="sm" variant="outline" icon={Search}>Search</Button>
        </form>
      </div>

      {users.isError ? (
        <ErrorPanel error={users.error} onRetry={() => void users.refetch()} />
      ) : users.isPending ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3.5 py-2.5">User</th>
                  <th className="px-3.5 py-2.5">Role</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Joined</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data?.content.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50">
                    <td className="px-3.5 py-2.5">
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-[10.5px] text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={user.role === 'ADMIN' ? 'dark' : 'neutral'}>{user.role}</Badge>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={user.accountStatus === 'ACTIVE' ? 'lime' : 'rose'}>{user.accountStatus}</Badge>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500">
                      {formatInZone(user.createdAt, 'UTC', 'dd MMM yyyy')}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Select
                          className="h-7 w-auto py-0 text-[11px]"
                          value={user.role}
                          onChange={(e) => mutateUser.mutate({ user, action: 'role', value: e.target.value })}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={user.accountStatus === 'ACTIVE' ? ShieldX : ShieldCheck}
                          className={user.accountStatus === 'ACTIVE' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}
                          onClick={() => mutateUser.mutate({ user, action: 'status', value: '' })}
                        >
                          {user.accountStatus === 'ACTIVE' ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.data?.content.length === 0 && (
            <div className="p-6"><EmptyState icon={Users} title="No users found" description="Try a different search term." /></div>
          )}
        </Card>
      )}
      <Pagination page={page} totalPages={users.data?.totalPages ?? 0} onChange={setPage} totalElements={users.data?.totalElements} />
    </div>
  )
}

function AuditTab() {
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('')
  const audit = useQuery({ queryKey: ['admin-audit', page], queryFn: () => api.audit(page, 30) })
  const rows = (audit.data?.content ?? []).filter((entry: AuditEntry) => {
    if (!filter.trim()) return true
    const needle = filter.toLowerCase()
    return entry.action.toLowerCase().includes(needle) || entry.actorEmail?.toLowerCase().includes(needle)
      || entry.resourceType.toLowerCase().includes(needle) || (entry.resourceId ?? '').toLowerCase().includes(needle)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">System Audit Trail</h2>
          <p className="text-xs text-slate-500">Immutable ledger of administrative and system operations.</p>
        </div>
        <div className="flex gap-1.5">
          <Input className="h-8 w-[200px] py-0 text-xs" placeholder="Filter audit rows" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => void audit.refetch()}>Refresh</Button>
        </div>
      </div>

      {audit.isError ? (
        <ErrorPanel error={audit.error} onRetry={() => void audit.refetch()} />
      ) : audit.isPending ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3.5 py-2.5">Timestamp</th>
                  <th className="px-3.5 py-2.5">Actor</th>
                  <th className="px-3.5 py-2.5">Action</th>
                  <th className="px-3.5 py-2.5">Resource</th>
                  <th className="px-3.5 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-3.5 py-2 text-slate-600">
                      {formatInZone(entry.createdAt, 'UTC', 'dd MMM HH:mm:ss')}
                    </td>
                    <td className="px-3.5 py-2 font-medium text-slate-800">
                      {entry.actorEmail ?? 'system'}
                    </td>
                    <td className="px-3.5 py-2">
                      <Badge tone="neutral">{entry.action}</Badge>
                    </td>
                    <td className="px-3.5 py-2 text-slate-600">
                      {entry.resourceType} {entry.resourceId ? `(${entry.resourceId.slice(0, 8)})` : ''}
                    </td>
                    <td className="max-w-[280px] px-3.5 py-2 font-mono text-[10.5px] text-slate-500 truncate" title={JSON.stringify(entry.metadata)}>
                      {JSON.stringify(entry.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <div className="p-6"><EmptyState icon={ClipboardList} title="No audit records" description="Operational events will populate here as requests execute." /></div>
          )}
        </Card>
      )}
      <Pagination page={page} totalPages={audit.data?.totalPages ?? 0} onChange={setPage} totalElements={audit.data?.totalElements} />
    </div>
  )
}

export default function Admin() {
  const [params, setParams] = useSearchParams()
  const tab = (adminTabs.some((item) => item.value === params.get('tab')) ? params.get('tab') : 'overview') as AdminTab
  const setTab = (value: AdminTab) => {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations Management"
        title="Admin Console"
        description="Oversee parking facilities, manage floor slot layouts, review reservation records, and track audit trails."
        actions={<Badge tone="dark"><ShieldCheck className="h-3 w-3 text-brand-400" /> Admin Access</Badge>}
      />

      <div className="mb-5">
        <Tabs tabs={adminTabs} value={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'operations' && <OperationsTab />}
      {tab === 'facilities' && <FacilitiesTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}
