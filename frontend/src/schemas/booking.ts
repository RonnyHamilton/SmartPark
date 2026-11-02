import { z } from 'zod'

export const bookingDetailsSchema = z.object({
  facilityId: z.string().uuid('Choose a parking facility'),
  vehicleId: z.string().uuid('Choose a vehicle'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid start time'),
  duration: z.coerce.number().int('Duration must be a whole number of minutes').min(30, 'Minimum 30 minutes').max(24 * 60, 'Maximum 24 hours'),
  accessibilityRequired: z.boolean(),
  preferredFloorId: z.string().optional(),
  preferredSlotId: z.string().optional(),
})
export type BookingDetailsValues = z.infer<typeof bookingDetailsSchema>

export const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid start time'),
  duration: z.coerce.number().int('Duration must be a whole number of minutes').min(30, 'Minimum 30 minutes').max(24 * 60, 'Maximum 24 hours'),
})
export type RescheduleValues = z.infer<typeof rescheduleSchema>

export const facilitySearchSchema = z.object({
  q: z.string().max(80).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  duration: z.coerce.number().int().min(1).max(24).optional(),
})
