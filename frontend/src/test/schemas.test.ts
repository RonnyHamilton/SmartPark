import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, vehicleSchema } from '../schemas/auth'
import { bookingDetailsSchema, rescheduleSchema } from '../schemas/booking'

describe('authentication schemas', () => {
  it('accepts a valid login', () => {
    expect(loginSchema.safeParse({ email: 'demo@smartpark.local', password: 'Demo@12345!' }).success).toBe(true)
  })

  it('rejects malformed email addresses', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['email'])
  })

  it('requires a strong password during registration', () => {
    const base = {
      name: 'Maya Kapoor', email: 'maya@example.com', confirmPassword: 'weakpass', acceptTerms: true,
    }
    expect(registerSchema.safeParse({ ...base, password: 'weakpass' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: 'StrongPass1', confirmPassword: 'StrongPass1' }).success).toBe(true)
  })

  it('reports mismatched registration passwords', () => {
    const result = registerSchema.safeParse({
      name: 'Maya Kapoor', email: 'maya@example.com', password: 'StrongPass1',
      confirmPassword: 'StrongPass2', acceptTerms: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'confirmPassword')).toBe(true)
    }
  })

  it('requires acceptance of terms', () => {
    const result = registerSchema.safeParse({
      name: 'Maya Kapoor', email: 'maya@example.com', password: 'StrongPass1',
      confirmPassword: 'StrongPass1', acceptTerms: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === 'acceptTerms')).toBe(true)
  })

  it('validates vehicle registrations and optional dimensions', () => {
    expect(vehicleSchema.safeParse({
      registrationNumber: 'MH 12 AB 3456', vehicleType: 'CAR', isDefault: true,
    }).success).toBe(true)
    expect(vehicleSchema.safeParse({
      registrationNumber: 'MH 12 AB 3456', vehicleType: 'CAR', widthM: 1.8, lengthM: 4.4,
    }).success).toBe(true)
    expect(vehicleSchema.safeParse({
      registrationNumber: 'MH 12 AB 3456', vehicleType: 'CAR', widthM: 9,
    }).success).toBe(false)
    expect(vehicleSchema.safeParse({ registrationNumber: '!!', vehicleType: 'CAR' }).success).toBe(false)
  })
})

describe('booking schemas', () => {
  const facilityId = '11111111-1111-4111-8111-111111111111'
  const vehicleId = '22222222-2222-4222-8222-222222222222'

  it('coerces duration strings from form controls', () => {
    const result = bookingDetailsSchema.safeParse({
      facilityId, vehicleId, date: '2026-10-21', time: '10:00', duration: '120', accessibilityRequired: false,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.duration).toBe(120)
  })

  it('rejects malformed windows and durations', () => {
    expect(bookingDetailsSchema.safeParse({
      facilityId, vehicleId, date: '21-10-2026', time: '25:00', duration: '0', accessibilityRequired: false,
    }).success).toBe(false)
    expect(rescheduleSchema.safeParse({ date: '2026-10-21', time: '25:00', duration: '120' }).success).toBe(false)
    expect(rescheduleSchema.safeParse({ date: '2026-10-21', time: '18:30', duration: '90' }).success).toBe(true)
  })
})
