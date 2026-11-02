import type {
  ActivityEntry, AdminUser, Analytics, AuditEntry, AuthResponse, Availability, Booking, BookingStats,
  FacilityDetail, FacilitySummary, OverstayDashboard, PageResponse, PricingRule, QuoteResponse, User, Vehicle,
} from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080/api/v1'

let accessToken: string | null = null
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors?: Record<string, string>

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

async function rawRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the SmartPark API. Is the backend running?')
  }

  if (response.status === 401 && retry && accessToken) {
    const refreshed = await tryRefresh()
    if (refreshed) return rawRequest<T>(path, options, false)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try { body = JSON.parse(text) } catch { body = null }
  }

  if (!response.ok) {
    const errorBody = body as { message?: string; code?: string; fieldErrors?: Record<string, string> } | null
    if (response.status === 401) onSessionExpired?.()
    throw new ApiError(
      response.status,
      errorBody?.code ?? 'REQUEST_FAILED',
      errorBody?.message ?? `Request failed with status ${response.status}`,
      errorBody?.fieldErrors,
    )
  }
  return body as T
}

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        accessToken = null
        return false
      }
      const data = await response.json() as { accessToken: string }
      accessToken = data.accessToken
      return true
    } catch {
      accessToken = null
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export const api = {
  // Auth
  register: (body: { name: string; email: string; password: string }) =>
    rawRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    rawRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  refresh: async (): Promise<string | null> => {
    const ok = await tryRefresh()
    return ok ? accessToken : null
  },
  logout: () => rawRequest<void>('/auth/logout', { method: 'POST' }),
  me: () => rawRequest<User>('/auth/me'),
  forgotPassword: (email: string) =>
    rawRequest<{ message: string; devResetToken?: string | null }>('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    rawRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, newPassword }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    rawRequest<{ message: string }>('/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Profile
  updateProfile: (body: { name: string; accessibilityRequired: boolean }) =>
    rawRequest<User>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  activity: () => rawRequest<ActivityEntry[]>('/users/me/activity'),

  // Facilities
  facilities: (params: Record<string, string | undefined> = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 'false') query.set(key, value)
    })
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return rawRequest<FacilitySummary[]>(`/facilities${suffix}`)
  },
  facility: (id: string) => rawRequest<FacilityDetail>(`/facilities/${id}`),
  availability: (id: string, params: { start: string; end: string; vehicleType?: string; accessible?: boolean; ev?: boolean }) => {
    const query = new URLSearchParams({ start: params.start, end: params.end })
    if (params.vehicleType) query.set('vehicleType', params.vehicleType)
    if (params.accessible) query.set('accessible', 'true')
    if (params.ev) query.set('ev', 'true')
    return rawRequest<Availability>(`/facilities/${id}/availability?${query.toString()}`)
  },

  // Vehicles
  vehicles: () => rawRequest<Vehicle[]>('/vehicles'),
  addVehicle: (body: Record<string, unknown>) =>
    rawRequest<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(body) }),
  updateVehicle: (id: string, body: Record<string, unknown>) =>
    rawRequest<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteVehicle: (id: string) => rawRequest<void>(`/vehicles/${id}`, { method: 'DELETE' }),

  // Bookings
  quote: (body: Record<string, unknown>) =>
    rawRequest<QuoteResponse>('/bookings/quote', { method: 'POST', body: JSON.stringify(body) }),
  createBooking: (body: Record<string, unknown>) =>
    rawRequest<Booking>('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  bookings: (params: { status?: string; page?: number; size?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    query.set('page', String(params.page ?? 0))
    query.set('size', String(params.size ?? 20))
    return rawRequest<PageResponse<Booking>>(`/bookings/me?${query.toString()}`)
  },
  booking: (id: string) => rawRequest<Booking>(`/bookings/${id}`),
  bookingStats: () => rawRequest<BookingStats>('/bookings/me/stats'),
  reschedule: (id: string, body: Record<string, unknown>) =>
    rawRequest<Booking>(`/bookings/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(body) }),
  cancelBooking: (id: string, reason?: string) =>
    rawRequest<Booking>(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  checkIn: (id: string, token?: string) =>
    rawRequest<Booking>(`/bookings/${id}/check-in`, {
      method: 'POST', body: JSON.stringify(token ? { token } : {}),
    }),
  checkOut: (id: string) => rawRequest<Booking>(`/bookings/${id}/check-out`, { method: 'POST' }),

  // Admin
  analytics: (from?: string, to?: string) => {
    const query = new URLSearchParams()
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    return rawRequest<Analytics>(`/admin/analytics${query.toString() ? `?${query}` : ''}`)
  },
  adminFacilities: () => rawRequest<FacilitySummary[]>('/admin/facilities'),
  adminFacility: (id: string) => rawRequest<FacilityDetail>(`/admin/facilities/${id}`),
  createFacility: (body: Record<string, unknown>) =>
    rawRequest<FacilitySummary>('/admin/facilities', { method: 'POST', body: JSON.stringify(body) }),
  updateFacility: (id: string, body: Record<string, unknown>) =>
    rawRequest<FacilitySummary>(`/admin/facilities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFacility: (id: string) => rawRequest<void>(`/admin/facilities/${id}`, { method: 'DELETE' }),
  createFloor: (facilityId: string, body: Record<string, unknown>) =>
    rawRequest<unknown>(`/admin/facilities/${facilityId}/floors`, { method: 'POST', body: JSON.stringify(body) }),
  updateFloor: (id: string, body: Record<string, unknown>) =>
    rawRequest<unknown>(`/admin/floors/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFloor: (id: string) => rawRequest<void>(`/admin/floors/${id}`, { method: 'DELETE' }),
  createSlot: (floorId: string, body: Record<string, unknown>) =>
    rawRequest<unknown>(`/admin/floors/${floorId}/slots`, { method: 'POST', body: JSON.stringify(body) }),
  updateSlot: (id: string, body: Record<string, unknown>) =>
    rawRequest<unknown>(`/admin/slots/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSlot: (id: string) => rawRequest<void>(`/admin/slots/${id}`, { method: 'DELETE' }),
  createPricing: (facilityId: string, body: Record<string, unknown>) =>
    rawRequest<PricingRule>(`/admin/facilities/${facilityId}/pricing`, {
      method: 'POST', body: JSON.stringify(body),
    }),
  updatePricing: (id: string, body: Record<string, unknown>) =>
    rawRequest<PricingRule>(`/admin/pricing/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePricing: (id: string) => rawRequest<void>(`/admin/pricing/${id}`, { method: 'DELETE' }),
  adminBookings: (params: { status?: string; facilityId?: string; search?: string; page?: number; size?: number } = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value))
    })
    return rawRequest<PageResponse<Booking>>(`/admin/bookings?${query.toString()}`)
  },
  adminUsers: (params: { q?: string; page?: number; size?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    query.set('page', String(params.page ?? 0))
    query.set('size', String(params.size ?? 20))
    return rawRequest<PageResponse<AdminUser>>(`/admin/users?${query.toString()}`)
  },
  setUserStatus: (id: string, status: 'ACTIVE' | 'DISABLED') =>
    rawRequest<AdminUser>(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  setUserRole: (id: string, role: 'USER' | 'ADMIN') =>
    rawRequest<AdminUser>(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  audit: (page = 0, size = 30) =>
    rawRequest<PageResponse<AuditEntry>>(`/admin/audit?page=${page}&size=${size}`),
  overstayDashboard: () => rawRequest<OverstayDashboard>('/admin/overstay-dashboard'),
  resolveConflict: (id: string, body: { targetSlotId?: string; resolutionNotes?: string } = {}) =>
    rawRequest<Booking>(`/admin/bookings/${id}/resolve-conflict`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
