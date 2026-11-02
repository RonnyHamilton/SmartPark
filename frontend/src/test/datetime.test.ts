import { describe, expect, it } from 'vitest'
import {
  addDaysInZone, currency, durationLabel, formatDateInZone, formatInZone, formatTimeInZone,
  haversineKm, minutesBetween, toInstant, todayInZone,
} from '../lib/datetime'

describe('datetime helpers', () => {
  it('converts facility-local times to UTC and back', () => {
    const instant = toInstant('2026-10-21', '10:00', 'Asia/Kolkata')
    expect(instant).toBe('2026-10-21T04:30:00.000Z')
    expect(formatTimeInZone(instant, 'Asia/Kolkata')).toBe('10:00')
    expect(formatDateInZone(instant, 'Asia/Kolkata')).toContain('21 Oct 2026')
  })

  it('handles daylight-saving offsets through date-fns-tz', () => {
    const instant = toInstant('2026-07-01', '09:00', 'Europe/London')
    expect(instant).toBe('2026-07-01T08:00:00.000Z')
    expect(formatTimeInZone(instant, 'Europe/London')).toBe('09:00')
  })

  it('formats friendly durations', () => {
    expect(durationLabel(30)).toBe('30 min')
    expect(durationLabel(60)).toBe('1 hr')
    expect(durationLabel(120)).toBe('2 hrs')
    expect(durationLabel(150)).toBe('2h 30m')
  })

  it('computes minutes between instants', () => {
    expect(minutesBetween('2026-10-21T04:00:00Z', '2026-10-21T06:30:00Z')).toBe(150)
  })

  it('produces ISO dates in a timezone', () => {
    expect(todayInZone('Asia/Kolkata')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(addDaysInZone('Asia/Kolkata', 1) > todayInZone('Asia/Kolkata')).toBe(true)
  })

  it('formats currency in INR', () => {
    expect(currency(120)).toContain('120')
    expect(currency(120)).toMatch(/₹/)
    expect(formatInZone('2026-10-21T04:30:00Z', 'Asia/Kolkata', 'yyyy-MM-dd HH:mm')).toBe('2026-10-21 10:00')
  })

  it('calculates haversine distance between Pune landmarks', () => {
    const distance = haversineKm({ lat: 18.5314, lng: 73.8446 }, { lat: 18.5204, lng: 73.8567 })
    expect(distance).toBeGreaterThan(1)
    expect(distance).toBeLessThan(2)
    expect(haversineKm({ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.8 })).toBe(0)
  })
})
