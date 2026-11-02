import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ArrowRight, Building2, Clock3, Crosshair, Filter, Info, LocateFixed, MapPin, Navigation, RotateCcw,
  SearchX, ShieldCheck, Ticket,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorPanel, PageHeader } from '../components/app'
import { SearchBar } from '../components/SearchBar'
import { Badge, Button, Card, Checkbox, EmptyState, Input, Select, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { addDaysInZone, currency, haversineKm, toInstant } from '../lib/datetime'
import { api } from '../services/api'
import type { FacilitySummary, VehicleType } from '../types'

const VEHICLE_OPTIONS: { value: VehicleType | ''; label: string }[] = [
  { value: '', label: 'All vehicle types' },
  { value: 'CAR', label: 'Car' },
  { value: 'SUV', label: 'SUV' },
  { value: 'MOTORCYCLE', label: 'Motorcycle' },
  { value: 'EV', label: 'Electric Vehicle' },
]

const SORTS = [
  { value: 'recommended', label: 'Sort: Recommended' },
  { value: 'distance', label: 'Sort: Nearest' },
  { value: 'price', label: 'Sort: Lowest price' },
  { value: 'availability', label: 'Sort: Most bays free' },
] as const

function safeInstant(date: string, time: string, zone: string): string | null {
  try {
    const value = toInstant(date, time, zone)
    return Number.isNaN(new Date(value).getTime()) ? null : value
  } catch {
    return null
  }
}

function FacilityCard({ facility, live, loading, distanceKm, windowLabel, href }: {
  facility: FacilitySummary
  live?: { bookableSlots: number; estimatedPrice: number | null; priceExplanation: string | null }
  loading: boolean
  distanceKm: number | null
  windowLabel: string
  href: string
}) {
  const { isAdmin } = useAuth()
  const available = live?.bookableSlots ?? facility.availableSlots
  return (
    <Card as="article" className="flex h-full flex-col p-4 transition-all hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
              {facility.city}
            </span>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
              {facility.status}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold text-slate-900 truncate">{facility.name}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-emerald-700">
            {available} <span className="text-xs font-normal text-slate-500 font-medium">/ {facility.totalSlots}</span>
          </p>
          <span className="text-[10px] font-semibold text-slate-500">free for window</span>
        </div>
      </div>

      {/* Real-time Occupancy Pressure Indicator */}
      {(() => {
        const occ = Math.min(100, Math.max(0, Math.round(((facility.totalSlots - available) / (facility.totalSlots || 1)) * 100)))
        const isHigh = occ >= 80
        const isMed = occ >= 50 && occ < 80
        return (
          <div className="mt-2.5 rounded bg-slate-50 border border-slate-100 p-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium mb-1">
              <span>Occupancy</span>
              <span className={isHigh ? 'text-rose-600 font-bold' : isMed ? 'text-amber-600 font-bold' : 'text-emerald-700 font-bold'}>
                {isHigh ? 'High Demand' : isMed ? 'Moderate' : 'Low Traffic'} ({occ}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${occ}%` }}
              />
            </div>
          </div>
        )
      })()}

      <div className="mt-3 flex flex-1 flex-col">
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span className="line-clamp-2">{facility.address}</span>
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {facility.amenities.slice(0, 3).map((amenity) => (
            <span key={amenity} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {amenity}
            </span>
          ))}
          {facility.amenities.length > 3 && (
            <span className="text-[10px] font-medium text-slate-500">+{facility.amenities.length - 3}</span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-xs">
          <div>
            <span className="text-[10.5px] font-medium text-slate-500">Operating hours</span>
            <p className="mt-0.5 flex items-center gap-1 font-semibold text-slate-800">
              <Clock3 className="h-3 w-3 text-slate-500" /> {facility.opensAt.slice(0, 5)}–{facility.closesAt.slice(0, 5)}
            </p>
          </div>
          <div>
            <span className="text-[10.5px] font-medium text-slate-500">Distance</span>
            <p className="mt-0.5 flex items-center gap-1 font-semibold text-slate-800">
              <Navigation className="h-3 w-3 text-slate-500" />
              {distanceKm === null ? '—' : `${distanceKm.toFixed(1)} km`}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-3">
          <div>
            <span className="text-[10.5px] uppercase font-semibold text-slate-600">{windowLabel}</span>
            <p className="text-base font-bold text-slate-900">
              {loading ? (
                <span className="inline-block h-5 w-16 animate-pulse rounded bg-slate-200" />
              ) : live?.estimatedPrice != null ? (
                currency(live.estimatedPrice)
              ) : facility.hourlyRate != null ? (
                `${currency(facility.hourlyRate)}/hr`
              ) : (
                '—'
              )}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Link to={href}>
              <Button size="sm" variant="outline" icon={Info}>
                Details
              </Button>
            </Link>
            {isAdmin ? (
              <Link to="/admin?tab=facilities">
                <Button size="sm" variant="outline" icon={Building2}>
                  Manage
                </Button>
              </Link>
            ) : available > 0 ? (
              <Link to={`/book?facility=${facility.id}`}>
                <Button size="sm" icon={Ticket}>
                  Book Bay
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="soft" disabled>
                Full
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function Discover() {
  const [params, setParams] = useSearchParams()
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'

  const q = params.get('q') ?? ''
  const date = params.get('date') || addDaysInZone(zone, 1)
  const time = params.get('time') || '10:00'
  const duration = Math.max(1, Number(params.get('duration') || '2'))
  const vehicleType = (params.get('vehicleType') as VehicleType | '') ?? ''
  const accessible = params.get('accessible') === 'true'
  const ev = params.get('ev') === 'true'
  const city = params.get('city') ?? ''
  const maxPrice = params.get('maxPrice') ?? ''
  const radius = params.get('radius') ?? 'any'
  const sort = params.get('sort') ?? 'recommended'

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const resetFilters = () => {
    const next = new URLSearchParams({ date, time, duration: String(duration) })
    if (q) next.set('q', q)
    setParams(next, { replace: true })
  }

  const facilities = useQuery({
    queryKey: ['facilities', { q, vehicleType, accessible, ev, city, maxPrice }],
    queryFn: () => api.facilities({
      q: q || undefined,
      vehicleType: vehicleType || undefined,
      accessible: accessible ? 'true' : undefined,
      ev: ev ? 'true' : undefined,
      city: city || undefined,
      maxPrice: maxPrice || undefined,
    }),
  })

  const list = useMemo(() => facilities.data ?? [], [facilities.data])

  const availabilityQueries = useQueries({
    queries: list.map((facility) => {
      const start = safeInstant(date, time, facility.timezone)
      const end = start ? new Date(new Date(start).getTime() + duration * 60 * 60_000).toISOString() : null
      return {
        queryKey: ['facility-availability', facility.id, start, end, vehicleType, accessible, ev],
        queryFn: () => api.availability(facility.id, {
          start: start!, end: end!, vehicleType: vehicleType || undefined, accessible, ev,
        }),
        enabled: Boolean(start && end),
        staleTime: 30_000,
        retry: 0,
      }
    }),
  })

  const liveById = new Map<string, { bookableSlots: number; estimatedPrice: number | null; priceExplanation: string | null }>()
  availabilityQueries.forEach((result, index) => {
    const facility = list[index]
    if (facility && result.data) {
      liveById.set(facility.id, {
        bookableSlots: result.data.bookableSlots,
        estimatedPrice: result.data.estimatedPrice,
        priceExplanation: result.data.priceExplanation,
      })
    }
  })

  const withDistance = useMemo(() => list.map((facility) => {
    const distance = coords && facility.latitude != null && facility.longitude != null
      ? haversineKm(coords, { lat: facility.latitude, lng: facility.longitude })
      : null
    return { facility, distance }
  }), [list, coords])

  const filtered = withDistance.filter(({ distance }) => {
    if (radius === 'any' || distance === null) return true
    return distance <= Number(radius)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'distance' && a.distance !== null && b.distance !== null) return a.distance - b.distance
    if (sort === 'price') {
      const pa = liveById.get(a.facility.id)?.estimatedPrice ?? a.facility.hourlyRate ?? Number.MAX_SAFE_INTEGER
      const pb = liveById.get(b.facility.id)?.estimatedPrice ?? b.facility.hourlyRate ?? Number.MAX_SAFE_INTEGER
      return pa - pb
    }
    if (sort === 'availability') {
      return (liveById.get(b.facility.id)?.bookableSlots ?? b.facility.availableSlots)
        - (liveById.get(a.facility.id)?.bookableSlots ?? a.facility.availableSlots)
    }
    return a.facility.name.localeCompare(b.facility.name)
  })

  const cities = Array.from(new Set((facilities.data ?? []).map((f) => f.city))).sort()
  const activeFilters = [vehicleType, city, maxPrice, accessible && 'accessible', ev && 'ev'].filter(Boolean).length
  const windowLabel = `${duration} hr · ${date} ${time}`

  const locate = () => {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocating(false)
        update({ sort: 'distance' })
      },
      () => {
        setLocationError('Location permission denied.')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Facility Discovery"
        title={q ? `Parking near “${q}”` : 'Find Parking Facilities'}
        description="Verify real-time bay availability and pricing across Pune locations before arriving."
        actions={
          <Button variant="outline" size="sm" icon={LocateFixed} onClick={locate} loading={locating}>
            {coords ? 'Location active' : 'Locate near me'}
          </Button>
        }
      />

      <SearchBar compact initial={{ q, date, time, duration: String(duration) }} />

      {/* Filter Toolbar */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Filter className="h-3.5 w-3.5 text-slate-600" /> Filters
            {activeFilters > 0 && <span className="rounded bg-brand-50 border border-brand-200 px-1.5 text-[10px] text-brand-700 font-bold">{activeFilters}</span>}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Select aria-label="Vehicle type" className="h-8 w-auto min-w-[130px] py-0 text-xs" value={vehicleType} onChange={(e) => update({ vehicleType: e.target.value })}>
              {VEHICLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <Select aria-label="City" className="h-8 w-auto min-w-[110px] py-0 text-xs" value={city} onChange={(e) => update({ city: e.target.value })}>
              <option value="">All cities</option>
              {cities.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
            <Input aria-label="Maximum hourly price" type="number" min={0} step={10} placeholder="Max ₹/hr" className="h-8 w-[100px] py-0 text-xs" value={maxPrice} onChange={(e) => update({ maxPrice: e.target.value })} />
            <Select aria-label="Distance radius" className="h-8 w-auto min-w-[110px] py-0 text-xs" value={radius} onChange={(e) => update({ radius: e.target.value })}>
              <option value="any">Any distance</option>
              <option value="2">Within 2 km</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
            </Select>
            <Select aria-label="Sort results" className="h-8 w-auto min-w-[130px] py-0 text-xs" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetFilters}>Reset</Button>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2.5 text-xs">
          <Checkbox
            label="Accessible bay only"
            checked={accessible}
            onChange={(e) => update({ accessible: e.target.checked ? 'true' : undefined })}
            className="border-0 bg-transparent p-0 hover:border-transparent text-xs"
          />
          <Checkbox
            label="EV charging required"
            checked={ev}
            onChange={(e) => update({ ev: e.target.checked ? 'true' : undefined })}
            className="border-0 bg-transparent p-0 hover:border-transparent text-xs"
          />
          {locationError && <p className="ml-auto text-xs text-amber-700">{locationError}</p>}
          {coords && !locationError && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-700"><Crosshair className="h-3 w-3" /> Distances calculated</span>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>
          <strong className="font-semibold text-slate-900">{sorted.length}</strong> location{sorted.length === 1 ? '' : 's'} found
          {facilities.isFetching && <span className="ml-1 text-slate-500">updating…</span>}
        </p>
        <p className="flex items-center gap-1 text-slate-500">
          <Clock3 className="h-3.5 w-3.5 text-slate-500" /> Availability evaluated for window: {windowLabel}
        </p>
      </div>

      {facilities.isError ? (
        <div className="mt-4"><ErrorPanel error={facilities.error} onRetry={() => void facilities.refetch()} /></div>
      ) : facilities.isPending ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={SearchX}
            title="No facilities matched your filters"
            description="Try clearing your search term, adjusting your arrival time window, or resetting the vehicle requirements."
            action={<Button variant="outline" size="sm" icon={RotateCcw} onClick={resetFilters}>Clear filters</Button>}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map(({ facility, distance }) => {
            const sourceIndex = list.findIndex((item) => item.id === facility.id)
            const query = availabilityQueries[sourceIndex]
            const href = `/facilities/${facility.id}?${new URLSearchParams({ date, time, duration: String(duration) }).toString()}`
            return (
              <FacilityCard
                key={facility.id}
                facility={facility}
                live={liveById.get(facility.id)}
                loading={query?.isPending ?? false}
                distanceKm={distance}
                windowLabel={`${duration} hr from ${time}`}
                href={href}
              />
            )
          })}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p>
          <strong className="text-slate-800">Interval-Based Verification:</strong> Availability accounts for whole intervals plus turnaround buffers. A bay already reserved for part of your duration will not appear as available.
        </p>
      </div>
    </div>
  )
}
