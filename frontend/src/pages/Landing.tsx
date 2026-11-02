import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, BadgeCheck, CarFront, CheckCircle2, Clock3, Compass,
  MapPin, ShieldCheck, Ticket, UserPlus, Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { SearchBar } from '../components/SearchBar'
import { Badge, Button, Card, Skeleton } from '../components/ui'
import { api } from '../services/api'
import { currency, toInstant, addDaysInZone } from '../lib/datetime'

export default function Landing() {
  const facilities = useQuery({ queryKey: ['facilities', 'landing'], queryFn: () => api.facilities() })
  const featured = facilities.data?.[0]
  const previewStart = featured ? toInstant(addDaysInZone(featured.timezone, 1), '10:00', featured.timezone) : null
  const previewEnd = featured ? toInstant(addDaysInZone(featured.timezone, 1), '12:00', featured.timezone) : null

  const preview = useQuery({
    queryKey: ['landing-preview', featured?.id, previewStart],
    queryFn: () => api.availability(featured!.id, { start: previewStart!, end: previewEnd! }),
    enabled: Boolean(featured && previewStart),
  })

  const previewSlots = preview.data?.slots.slice(0, 24) ?? []
  const total = facilities.data?.reduce((sum, f) => sum + f.totalSlots, 0) ?? 0
  const available = facilities.data?.reduce((sum, f) => sum + f.availableSlots, 0) ?? 0

  return (
    <div className="bg-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Enterprise Parking Platform
                </span>
                <span className="text-xs text-slate-500">PostgreSQL-Backed Allocations</span>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[40px] leading-tight">
                Reliable Parking Management & Guaranteed Bay Reservations
              </h1>

              <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Reserve verified parking slots before arrival. SmartPark coordinates live availability across facilities, matches vehicle specifications, and enforces database-backed reservation guarantees.
              </p>

              <div className="mt-6">
                <SearchBar initial={{}} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Database-enforced locks</span>
                <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-brand-600" /> Full-window reservation</span>
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> EV charger matching</span>
              </div>
            </div>

            {/* Live Availability Preview Card */}
            <div>
              <Card className="p-5 shadow-sm border-slate-200">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Live Snapshot</span>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">{featured?.name ?? 'Loading facility...'}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3 text-slate-500" /> {featured?.city ?? 'Pune'} · {featured?.timezone ?? 'Asia/Kolkata'}
                    </p>
                  </div>
                  <Badge tone="lime">Active DB Sync</Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-[10.5px] text-slate-500">Available bays</p>
                    <p className="mt-1 text-lg font-bold text-emerald-700">
                      {preview.data ? preview.data.bookableSlots : '—'}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-[10.5px] text-slate-500">Starting rate</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {preview.data?.estimatedPrice != null ? currency(preview.data.estimatedPrice) : '—'}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-[10.5px] text-slate-500">Sample window</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">2 hr</p>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Sample Slot Matrix</span>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Available</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Reserved</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Occupied</span>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                    {preview.isPending && Array.from({ length: 24 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 rounded bg-slate-200" />
                    ))}
                    {previewSlots.map((slot) => {
                      const color = slot.state === 'AVAILABLE'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : slot.state === 'RESERVED'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : slot.state === 'OCCUPIED'
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-slate-100 border-slate-200 text-slate-500 font-medium'
                      return (
                        <div
                          key={slot.slotId}
                          title={`${slot.slotCode} · ${slot.state}`}
                          className={`flex h-6 items-center justify-center rounded border font-mono text-[9px] font-semibold ${color}`}
                        >
                          {slot.slotCode.split('-')[1] ?? slot.slotCode}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between pt-2 text-xs">
                  <span className="text-slate-500">Verified against real-time database state</span>
                  <Link to={featured ? `/facilities/${featured.id}` : '/discover'} className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700">
                    View facility <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:grid-cols-4">
            <div>
              <span className="block text-xl font-bold text-slate-900">{facilities.data?.length ?? 0}</span>
              <span>Verified locations</span>
            </div>
            <div>
              <span className="block text-xl font-bold text-slate-900">{total || '—'}</span>
              <span>Managed bays</span>
            </div>
            <div>
              <span className="block text-xl font-bold text-emerald-700">{available || '—'}</span>
              <span>Available right now</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <BadgeCheck className="h-4 w-4 text-brand-600" />
              <span>PostgreSQL 16 Exclusion Checks</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div>
            <span className="eyebrow">Enterprise Reliability</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Engineered for Accuracy and Operational Predictability
            </h2>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-600">
              SmartPark eliminates conflicting reservations and arbitrary bay assignments through deterministic algorithms and database-level integrity constraints.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600 border border-brand-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">Database-Level Conflict Exclusion</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Double bookings are structurally impossible. A PostgreSQL exclusion constraint checks overlapping timestamps across slots simultaneously, rejecting race conditions.
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600 border border-brand-200">
                <CarFront className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">Deterministic Allocation Engine</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Allocations transparently evaluate vehicle class (CAR, SUV, EV, Motorcycle), accessibility requirements, turnaround buffers, and floor preferences.
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600 border border-brand-200">
                <Ticket className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">Official Digital Reservation Passes</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Instant confirmation reference numbers, slot identification, transparent pricing breakdown, and facility-specific check-in and checkout workflows.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-slate-200 bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <span className="eyebrow">Operational Workflow</span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Structured Reservation Process
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Simple three-step flow connecting vehicle registration, facility discovery, and guaranteed slot assignment.
              </p>
              <div className="mt-5">
                <Link to="/discover">
                  <Button variant="outline" size="sm" icon={Compass}>Browse All Facilities</Button>
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { step: '01', title: 'Specify Window & Vehicle', desc: 'Select facility location, arrival date, time, duration, and registered vehicle dimensions.' },
                { step: '02', title: 'Select Floor & Bay', desc: 'Choose between the allocator recommendation or pick directly from the live floor matrix.' },
                { step: '03', title: 'Confirm & Receive Digital Pass', desc: 'Lock the reservation with server-verified pricing and clear arrival policies.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <span className="font-mono text-xs font-bold text-brand-600">{item.step}</span>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">{item.title}</h4>
                    <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Active Facilities */}
      <section id="facilities" className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <span className="eyebrow">Operating Facilities</span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Connected Parking Locations
              </h2>
            </div>
            <Link to="/discover" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all facilities <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {facilities.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
            {facilities.data?.slice(0, 3).map((facility) => (
              <Link key={facility.id} to={`/facilities/${facility.id}`} className="group block">
                <Card className="h-full p-4 transition hover:border-brand-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone="neutral">{facility.city}</Badge>
                    <span className="text-xs font-bold text-emerald-700">
                      {facility.availableSlots} / {facility.totalSlots} free
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                    {facility.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{facility.address}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-slate-500">Rate</span>
                      <p className="font-semibold text-slate-900">
                        {facility.hourlyRate != null ? `${currency(facility.hourlyRate)}/hr` : '—'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-medium text-brand-600">
                      Explore <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Clean Call to Action Banner */}
      <section className="border-t border-slate-200 bg-white py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:p-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Ready to book a reserved parking bay?</h3>
              <p className="mt-1 text-xs text-slate-500">
                Explore real-time availability across Pune facilities or create an account to manage your fleet.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/discover">
                <Button size="md" icon={Compass}>Find Parking</Button>
              </Link>
              <Link to="/register">
                <Button variant="outline" size="md" icon={UserPlus}>Register Account</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} SmartPark — Smart Parking Management System</p>
          <div className="flex gap-4">
            <Link to="/discover" className="hover:text-slate-900">Facilities</Link>
            <a href="/#how-it-works" className="hover:text-slate-900">How It Works</a>
            <a href="http://localhost:8080/swagger-ui.html" target="_blank" rel="noreferrer" className="hover:text-slate-900">Swagger API</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
