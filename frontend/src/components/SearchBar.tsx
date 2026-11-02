import { CalendarDays, Clock3, MapPin, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui'
import { cn } from '../lib/cn'
import { addDaysInZone, todayInZone } from '../lib/datetime'

const durations = [
  { value: '1', label: '1 hour' },
  { value: '2', label: '2 hours' },
  { value: '3', label: '3 hours' },
  { value: '4', label: '4 hours' },
  { value: '6', label: '6 hours' },
  { value: '8', label: '8 hours' },
]

function nextHour(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:00`
}

export function SearchBar({ compact = false, initial, className }: {
  dark?: boolean
  compact?: boolean
  initial?: { q?: string; date?: string; time?: string; duration?: string }
  className?: string
}) {
  const navigate = useNavigate()
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  const [q, setQ] = useState(initial?.q ?? '')
  const [date, setDate] = useState(initial?.date ?? addDaysInZone(zone, 1))
  const [time, setTime] = useState(initial?.time ?? nextHour())
  const [duration, setDuration] = useState(initial?.duration ?? '2')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams({ date, time, duration })
    if (q.trim()) params.set('q', q.trim())
    navigate(`/discover?${params.toString()}`)
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_auto] lg:items-center',
        className,
      )}
      aria-label="Search parking"
    >
      <div className="px-3 py-1">
        <label htmlFor="search-location" className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
          <MapPin className="h-3 w-3 text-slate-500" /> Location
        </label>
        <input
          id="search-location"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Area, venue or city"
          className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
          maxLength={80}
        />
      </div>
      <div className="border-t border-slate-200 px-3 py-1 lg:border-l lg:border-t-0 lg:pl-3">
        <label htmlFor="search-date" className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
          <CalendarDays className="h-3 w-3 text-slate-500" /> Date
        </label>
        <input
          id="search-date"
          type="date"
          value={date}
          min={todayInZone(zone)}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none focus:ring-0"
          required
        />
      </div>
      <div className="border-t border-slate-200 px-3 py-1 lg:border-l lg:border-t-0 lg:pl-3">
        <label htmlFor="search-time" className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
          <Clock3 className="h-3 w-3 text-slate-500" /> Start time
        </label>
        <input
          id="search-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none focus:ring-0"
          required
        />
      </div>
      <div className="border-t border-slate-200 px-3 py-1 lg:border-l lg:border-t-0 lg:pl-3">
        <label htmlFor="search-duration" className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
          Duration
        </label>
        <select
          id="search-duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none focus:ring-0"
        >
          {durations.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>
      <Button type="submit" size={compact ? 'sm' : 'md'} icon={Search} className="w-full lg:w-auto">
        Search
      </Button>
    </form>
  )
}
