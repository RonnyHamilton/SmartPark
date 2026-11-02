import { z } from 'zod'

const password = z.string()
  .min(10, 'Password must be at least 10 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Include at least one lower-case letter')
  .regex(/[A-Z]/, 'Include at least one upper-case letter')
  .regex(/\d/, 'Include at least one number')

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().min(2, 'Enter your full name').max(120, 'Name is too long'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password,
  confirmPassword: z.string().min(1, 'Confirm your password'),
  acceptTerms: z.boolean().refine((value) => value, { message: 'Please accept the booking terms' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})
export type ForgotValues = z.infer<typeof forgotSchema>

export const resetSchema = z.object({
  token: z.string().min(10, 'Paste the reset token from your email'),
  newPassword: password,
  confirmPassword: z.string().min(1, 'Confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
export type ResetValues = z.infer<typeof resetSchema>

export const profileSchema = z.object({
  name: z.string().min(2, 'Enter your name').max(120, 'Name is too long'),
  accessibilityRequired: z.boolean(),
})
export type ProfileValues = z.infer<typeof profileSchema>

export const vehicleSchema = z.object({
  registrationNumber: z.string()
    .min(4, 'Enter a valid registration number')
    .max(20, 'Registration number is too long')
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,18}[A-Za-z0-9]$/, 'Use letters, numbers, spaces or hyphens'),
  vehicleType: z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'EV']),
  widthM: z.coerce.number().min(0.5, 'Minimum 0.5 m').max(5, 'Maximum 5 m').optional(),
  lengthM: z.coerce.number().min(0.5, 'Minimum 0.5 m').max(15, 'Maximum 15 m').optional(),
  isDefault: z.boolean().optional(),
})
export type VehicleValues = z.infer<typeof vehicleSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
  confirmPassword: z.string().min(1, 'Confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
