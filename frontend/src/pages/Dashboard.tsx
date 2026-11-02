import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, CalendarClock, CalendarDays, CarFront, CheckCircle2, Clock3, Compass, DoorOpen, Download, KeyRound, MapPin,
  Plus, Ticket, TrendingUp, Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorPanel, PageHeader, Pagination, ProgressBar, Tabs } from '../components/app'
import { Badge, Button, Card, EmptyState, Skeleton, Stat, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  currency, dayLabelInZone, formatInZone, formatTimeInZone, relativeFromNow,
} from '../lib/datetime'
import { exportBookingsToCsv } from '../lib/exportCsv'
import { cn } from '../lib/cn'
import { api } from '../services/api'
import type { Booking, BookingStatus } from '../types'

const tabs: { value: BookingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CONFIRMED', label: 'Upcoming' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OVERSTAY', label: 'Overstay' },
  { value: 'NO_SHOW', label: 'No-Show' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function BookingRow({ booking }: { booking: Booking }) {
  return (
    <Link to={`/bookings/${booking.id}`} className="group block">
      <div className={cn(
        "flex flex-col gap-3 rounded-lg border bg-white p-3.5 transition hover:shadow-sm sm:flex-row sm:items-center sm:justify-between",
        booking.status === 'OVERSTAY' ? "border-rose-300 bg-rose-50/30 hover:border-rose-400" :
        booking.status === 'CONFLICT_REQUIRES_ADMIN' ? "border-amber-300 bg-amber-50/30 hover:border-amber-400" :
        "border-slate-200 hover:border-slate-300"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border text-center text-xs font-semibold',
            booking.status === 'ACTIVE'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : booking.status === 'OVERSTAY'
                ? 'border-rose-300 bg-rose-100 text-rose-800 animate-pulse'
                : booking.status === 'NO_SHOW'
                  ? 'border-slate-300 bg-slate-100 text-slate-500'
                  : booking.status === 'CONFLICT_REQUIRES_ADMIN'
                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                    : booking.status === 'CONFIRMED'
                      ? 'border-brand-200 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600',
          )}>
            <span className="text-[9.5px] uppercase">{formatInZone(booking.startTime, booking.facilityTimezone, 'MMM')}</span>
            <span className="text-base font-bold leading-none">{formatInZone(booking.startTime, booking.facilityTimezone, 'dd')}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                {booking.facilityName}
              </p>
              <StatusBadge status={booking.status} />
              {booking.reassignedFromSlotCode && (
                <span className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                  Reassigned from {booking.reassignedFromSlotCode}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock3 className="h-3 w-3 text-slate-500" />
                {formatTimeInZone(booking.startTime, booking.facilityTimezone)}–{formatTimeInZone(booking.endTime, booking.facilityTimezone)}
              </span>
              <span className="flex items-center gap-1">
                <CarFront className="h-3 w-3 text-slate-500" />
                {booking.floorName} · <span className="font-mono font-medium text-slate-700">{booking.slotCode}</span>
              </span>
              <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{booking.bookingReference}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900">
              {currency(booking.totalAmount ?? (booking.priceAmount + (booking.overstayCharge ?? 0)), booking.currency)}
            </p>
            {booking.overstayCharge && booking.overstayCharge > 0 ? (
              <p className="text-[10px] text-rose-600 font-medium">incl. {currency(booking.overstayCharge, booking.currency)} overstay</p>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600">
            View pass <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [status, setStatus] = useState<BookingStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(0)

  const stats = useQuery({ queryKey: ['booking-stats'], queryFn: api.bookingStats })
  const bookings = useQuery({
    queryKey: ['bookings', 'dashboard', status, page],
    queryFn: () => api.bookings({ status: status === 'ALL' ? undefined : status, page, size: 10 }),
  })
  const overview = useQuery({ queryKey: ['bookings', 'dashboard-overview'], queryFn: () => api.bookings({ page: 0, size: 50 }) })

  const all = overview.data?.content ?? []
  const overstaying = all.find((b) => b.status === 'OVERSTAY')
  const active = all.find((b) => b.status === 'ACTIVE')
  const next = useMemo(() => all
    .filter((b) => b.status === 'CONFIRMED' && new Date(b.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0], [all])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name.split(' ')[0] ?? 'there'

  return (
    <div>
      <PageHeader
        eyebrow={formatInZone(new Date().toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone, 'EEEE, dd MMMM')}
        title={`${greeting}, ${firstName}`}
        description={
          overstaying
            ? 'Action required: You have an overstaying vehicle. Please check out immediately to release the slot.'
            : active
              ? 'You currently have an active parking session in progress.'
              : next
                ? `Your next parking session starts ${relativeFromNow(next.startTime)}.`
                : 'Search nearby parking facilities, verify live bay availability, and reserve in advance.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Link to="/discover">
              <Button variant="outline" size="sm" icon={Compass}>Find Parking</Button>
            </Link>
            <Link to="/book">
              <Button size="sm" icon={Plus}>New Reservation</Button>
            </Link>
          </div>
        }
      />

      {/* Booking Statistics */}
      {stats.isError ? (
        <ErrorPanel error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.isPending ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />) : (
            <>
              <Stat label="Upcoming" value={stats.data?.upcomingBookings ?? 0} icon={CalendarClock} hint="Confirmed bookings" />
              <Stat label="Active now" value={(stats.data?.activeBookings ?? 0) + (overstaying ? 1 : 0)} icon={CheckCircle2} hint="Sessions in progress" tone={stats.data?.activeBookings || overstaying ? 'brand' : 'light'} />
              <Stat label="Completed" value={stats.data?.completedBookings ?? 0} icon={Ticket} hint={`${stats.data?.totalBookings ?? 0} total lifetime`} />
              <Stat label="Total spent" value={currency(stats.data?.totalSpent ?? 0)} icon={Wallet} hint="Total reservation value" />
            </>
          )}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="space-y-4">
          {/* Overstay Warning Banner */}
          {overstaying && (
            <Card className="border-rose-300 bg-rose-50/70 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                    <span className="h-2 w-2 animate-ping rounded-full bg-rose-600" />
                    Overstay Warning – Vehicle Physically Present
                  </span>
                  <h3 className="mt-2 text-base font-bold text-slate-900">{overstaying.facilityName}</h3>
                  <p className="mt-0.5 text-xs text-rose-700 font-medium">
                    Scheduled end was {formatTimeInZone(overstaying.endTime, overstaying.facilityTimezone)}. Overstay fee continues until checkout.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-rose-700" /> {overstaying.floorName} · <strong className="font-mono text-slate-900">{overstaying.slotCode}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-rose-700">
                      <Clock3 className="h-3.5 w-3.5 text-rose-600" /> Overstaying: {overstaying.overstayDurationMinutes ?? 0}m
                    </span>
                    <span className="flex items-center gap-1">
                      <CarFront className="h-3.5 w-3.5 text-slate-500" /> {overstaying.vehicleRegistration}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Total with Fee</span>
                  <p className="text-base font-bold text-rose-700">
                    {currency(overstaying.totalAmount ?? (overstaying.priceAmount + (overstaying.overstayCharge ?? 0)), overstaying.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2 border-t border-rose-200 pt-3">
                <Link to={`/bookings/${overstaying.id}?action=checkout`}>
                  <Button size="sm" variant="primary" icon={DoorOpen}>Complete Check Out</Button>
                </Link>
                <Link to={`/bookings/${overstaying.id}`}>
                  <Button size="sm" variant="outline" icon={Ticket}>View Pass Details</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Active Session Notification */}
          {active && (
            <Card className="border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                    Live Active Session
                  </span>
                  <h3 className="mt-2 text-base font-bold text-slate-900">{active.facilityName}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700" /> {active.floorName} · <strong className="font-mono text-slate-900">{active.slotCode}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5 text-slate-500" /> Ends at {formatTimeInZone(active.endTime, active.facilityTimezone)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CarFront className="h-3.5 w-3.5 text-slate-500" /> {active.vehicleRegistration}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Total</span>
                  <p className="text-base font-bold text-emerald-800">{currency(active.priceAmount, active.currency)}</p>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2 border-t border-emerald-200/60 pt-3">
                <Link to={`/bookings/${active.id}`}>
                  <Button size="sm" icon={Ticket}>View Pass</Button>
                </Link>
                <Link to={`/bookings/${active.id}?action=checkout`}>
                  <Button size="sm" variant="outline" icon={DoorOpen}>Check out</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Next Arrival Notice */}
          {!active && next && (
            <Card className="p-4 border-brand-200 bg-brand-50/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800">
                    <CalendarClock className="h-3.5 w-3.5 text-brand-600" />
                    Next upcoming arrival · {relativeFromNow(next.startTime)}
                  </span>
                  <h3 className="mt-1.5 text-base font-bold text-slate-900">{next.facilityName}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{next.facilityAddress}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                      {dayLabelInZone(next.startTime, next.facilityTimezone)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                      {formatTimeInZone(next.startTime, next.facilityTimezone)}–{formatTimeInZone(next.endTime, next.facilityTimezone)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CarFront className="h-3.5 w-3.5 text-slate-500" />
                      {next.floorName} · <strong className="font-mono text-slate-800">{next.slotCode}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={next.status} />
                  <p className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{next.bookingReference}</p>
                  <Link to={`/bookings/${next.id}`} className="mt-1">
                    <Button size="sm" variant="outline" icon={Ticket}>View Pass</Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {/* Empty State for zero bookings */}
          {!active && !next && stats.data && stats.data.totalBookings === 0 && (
            <EmptyState
              icon={Compass}
              title="No parking reservations yet"
              description="Browse Pune facilities, check real-time availability, and reserve your first parking bay in advance."
              action={
                <Link to="/discover">
                  <Button size="sm" icon={Compass}>Explore Facilities</Button>
                </Link>
              }
            />
          )}

          {/* Bookings Table / Listing */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Recent Reservations</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Tabs
                  tabs={tabs}
                  value={status}
                  onChange={(value) => { setStatus(value); setPage(0) }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  icon={Download}
                  disabled={!bookings.data?.content.length}
                  onClick={() => exportBookingsToCsv(bookings.data?.content ?? [], 'my-smartpark-reservations.csv')}
                  title="Export current table reservations as CSV"
                >
                  Export CSV
                </Button>
              </div>
            </div>

            {bookings.isError ? (
              <ErrorPanel error={bookings.error} onRetry={() => void bookings.refetch()} />
            ) : bookings.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : bookings.data?.content.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title={status === 'ALL' ? 'No reservations found' : `No ${tabs.find((tab) => tab.value === status)?.label.toLowerCase()} reservations`}
                description={status === 'ALL' ? 'When you reserve a slot, it will appear here.' : 'Try selecting another status tab or book a new bay.'}
                action={
                  <Link to="/book">
                    <Button variant="outline" size="sm" icon={Plus}>New Reservation</Button>
                  </Link>
                }
              />
            ) : (
              <>
                <div className="space-y-2">
                  {bookings.data?.content.map((booking) => <BookingRow key={booking.id} booking={booking} />)}
                </div>
                <Pagination page={page} totalPages={bookings.data?.totalPages ?? 0} onChange={setPage} totalElements={bookings.data?.totalElements} />
              </>
            )}
          </div>
        </div>

        {/* Right Sidebar Widgets */}
        <aside className="space-y-4">
          {/* Frequent Locations Widget */}
          <Card className="p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-semibold text-slate-900">Frequent Facilities</h3>
              <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
            </div>
            {stats.isPending ? (
              <div className="mt-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : stats.data?.frequentlyUsedFacilities.length ? (
              <div className="mt-3 space-y-3">
                {stats.data.frequentlyUsedFacilities.map((facility) => (
                  <div key={facility.facilityName}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{facility.facilityName}</span>
                      <span className="text-slate-500">{facility.bookings} booking{facility.bookings === 1 ? '' : 's'}</span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={facility.bookings} max={stats.data.frequentlyUsedFacilities[0]?.bookings ?? 1} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2.5 text-xs text-slate-500">Your most-used parking facilities will appear here after booking.</p>
            )}
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2.5">Quick Actions</h3>
            <div className="mt-2.5 space-y-1.5">
              {[
                { to: '/discover', icon: Compass, label: 'Browse Facilities', hint: 'Compare live slot availability' },
                { to: '/profile?tab=vehicles', icon: CarFront, label: 'Manage Vehicles', hint: 'Add or update license plates' },
                { to: '/profile?tab=security', icon: KeyRound, label: 'Security & Password', hint: 'Change account password' },
              ].map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-center gap-2.5 rounded-md border border-slate-200 p-2.5 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-50 text-brand-600 border border-brand-200">
                    <action.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">{action.label}</span>
                    <span className="block text-[10.5px] text-slate-500">{action.hint}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                </Link>
              ))}
            </div>
          </Card>

          {/* Informational Guidance */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs text-slate-600">
            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Badge tone="brand">Policy</Badge> Guaranteed Bay Hold
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Your reserved bay is held exclusively for your vehicle throughout the selected interval. Cancellations made prior to the cutoff window release the bay immediately.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
