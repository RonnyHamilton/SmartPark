import { ApiError } from '../services/api'

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Cannot reach the SmartPark API. Check that the backend is running.'
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.'
    return error.message || fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function fieldErrors(error: unknown): Record<string, string> | undefined {
  return error instanceof ApiError ? error.fieldErrors : undefined
}

export function friendlyAction(action: string): string {
  const cleaned = action.replace(/[_.]/g, ' ').toLowerCase()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
