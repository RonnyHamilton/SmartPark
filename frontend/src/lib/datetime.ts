import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export const DATE_INPUT = 'yyyy-MM-dd'
export const TIME_INPUT = 'HH:mm'

export function todayInZone(timeZone: string): string {
  return format(toZonedTime(new Date(), timeZone), DATE_INPUT)
}

export function addDaysInZone(timeZone: string, days: number): string {
  const now = toZonedTime(new Date(), timeZone)
  now.setDate(now.getDate() + days)
  return format(now, DATE_INPUT)
}

export function toInstant(date: string, time: string, timeZone: string): string {
  return fromZonedTime(`${date}T${time}:00`, timeZone).toISOString()
}

export function formatInZone(iso: string, timeZone: string, pattern = 'dd MMM yyyy, HH:mm'): string {
  try {
    return format(toZonedTime(parseISO(iso), timeZone), pattern)
  } catch {
    return iso
  }
}

export function formatTimeInZone(iso: string, timeZone: string): string {
  return formatInZone(iso, timeZone, 'HH:mm')
}

export function formatDateInZone(iso: string, timeZone: string): string {
  return formatInZone(iso, timeZone, 'EEE, dd MMM yyyy')
}

export function formatDateShortInZone(iso: string, timeZone: string): string {
  return formatInZone(iso, timeZone, 'dd MMM')
}

export function dayLabelInZone(iso: string, timeZone: string): string {
  const zoned = toZonedTime(parseISO(iso), timeZone)
  const today = toZonedTime(new Date(), timeZone)
  const diff = Math.round((zoned.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return format(zoned, 'EEE, dd MMM')
}

export function relativeFromNow(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} hr${hours > 1 ? 's' : ''}` : `${hours}h ${rest}m`
}

export function currency(amount: number, code = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

export function hhmm(value: string): string {
  return value?.slice(0, 5) ?? ''
}

export function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
