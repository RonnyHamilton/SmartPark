export type Role = 'USER' | 'ADMIN'
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'OVERSTAY'
  | 'NO_SHOW'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'CONFLICT_REQUIRES_ADMIN'
export type VehicleType = 'CAR' | 'SUV' | 'MOTORCYCLE' | 'EV'
export type SlotType = 'STANDARD' | 'COMPACT' | 'LARGE' | 'EV' | 'ACCESSIBLE' | 'MOTORCYCLE'
export type SlotState = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'OUT_OF_SERVICE'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  accountStatus: 'ACTIVE' | 'DISABLED'
  accessibilityRequired: boolean
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  expiresIn: number
  user: User
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface FacilitySummary {
  id: string
  name: string
  description: string
  address: string
  city: string
  latitude: number | null
  longitude: number | null
  timezone: string
  opensAt: string
  closesAt: string
  operatingDays: string
  amenities: string[]
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  minDurationMinutes: number
  maxDurationMinutes: number
  advanceBookingDays: number
  cancellationCutoffMinutes: number
  checkInGracePeriodMinutes?: number
  overstayMultiplier?: number
  bufferMinutes: number
  totalSlots: number
  availableSlots: number
  hourlyRate: number | null
}

export interface ParkingSlot {
  id: string
  slotCode: string
  floorId: string
  floorName: string
  floorNumber: number
  slotType: SlotType
  supportedVehicleTypes: VehicleType[]
  accessible: boolean
  evCharger: boolean
  widthM: number
  lengthM: number
  status: 'AVAILABLE' | 'OUT_OF_SERVICE'
  layoutX: number | null
  layoutY: number | null
}

export interface Floor {
  id: string
  name: string
  floorNumber: number
  displayOrder: number
  slots: ParkingSlot[]
}

export interface PricingRule {
  id: string
  rateType: 'HOURLY' | 'DAILY' | 'FLAT'
  amount: number
  minimumDurationMinutes: number
  maximumDurationMinutes: number
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
}

export interface FacilityDetail {
  facility: FacilitySummary
  floors: Floor[]
  pricingRules: PricingRule[]
}

export interface SlotAvailability {
  slotId: string
  slotCode: string
  floorId: string
  floorName: string
  floorNumber: number
  slotType: SlotType
  accessible: boolean
  evCharger: boolean
  widthM: number
  lengthM: number
  physicalStatus: string
  state: SlotState
  bookable: boolean
  reason: string
}

export interface Availability {
  facilityId: string
  facilityName: string
  timezone: string
  start: string
  end: string
  totalSlots: number
  bookableSlots: number
  estimatedPrice: number | null
  priceExplanation: string | null
  slots: SlotAvailability[]
}

export interface Vehicle {
  id: string
  registrationNumber: string
  vehicleType: VehicleType
  widthM: number | null
  lengthM: number | null
  isDefault: boolean
  createdAt: string
}

export interface AlternativeSlot {
  slotId: string
  slotCode: string
  floorName: string
  floorNumber: number
  slotType: SlotType
}

export interface AllocationPreview {
  slotId: string
  slotCode: string
  floorName: string
  floorNumber: number
  slotType: SlotType
  accessible: boolean
  evCharger: boolean
  reason: string
}

export interface QuoteResponse {
  facilityId: string
  facilityName: string
  facilityTimezone: string
  startTime: string
  endTime: string
  durationMinutes: number
  estimatedPrice: number | null
  priceExplanation: string | null
  allocation: AllocationPreview | null
  alternatives: AlternativeSlot[]
  suggestedStarts: string[]
  message: string | null
}

export interface Booking {
  id: string
  bookingReference: string
  status: BookingStatus
  facilityId: string
  facilityName: string
  facilityAddress: string
  facilityTimezone: string
  floorId: string
  floorName: string
  slotId?: string
  slotCode: string
  slotType: SlotType
  vehicleId: string
  vehicleRegistration: string
  vehicleType: VehicleType
  startTime: string
  endTime: string
  durationMinutes: number
  priceAmount: number
  overstayStartTime?: string | null
  overstayDurationMinutes?: number | null
  overstayCharge?: number | null
  totalAmount?: number
  noShowDetectedAt?: string | null
  reassignedFromSlotId?: string | null
  reassignedFromSlotCode?: string | null
  reassignedAt?: string | null
  conflictReason?: string | null
  resolvedBy?: string | null
  resolvedAt?: string | null
  currency: string
  allocationReason: string | null
  canCancel: boolean
  canModify: boolean
  canCheckIn: boolean
  canCheckOut: boolean
  checkInToken: string | null
  checkInTime: string | null
  checkOutTime: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  createdAt: string
  cancellationCutoffMinutes: number
}

export interface BookingStats {
  totalBookings: number
  upcomingBookings: number
  activeBookings: number
  completedBookings: number
  cancelledBookings: number
  overstayBookings?: number
  noShowBookings?: number
  totalSpent: number
  frequentlyUsedFacilities: { facilityName: string; bookings: number }[]
}

export interface OverstayDashboard {
  activeOverstayCount: number
  unresolvedConflictCount: number
  noShowCount: number
  activeOverstays: Booking[]
  unresolvedConflicts: Booking[]
  recentNoShows: Booking[]
}

export interface Analytics {
  from: string
  to: string
  bookingsInRange: number
  totalBookings: number
  confirmedBookings: number
  activeBookings: number
  completedBookings: number
  cancelledBookings: number
  revenueInRange: number
  averageBookingValue: number
  cancellationRate: number
  totalUsers: number
  totalFacilities: number
  totalSlots: number
  currentlyOccupiedSlots: number
  occupancyRate: number
  daily: { date: string; bookings: number; revenue: number }[]
  byFacility: { facilityName: string; bookings: number; revenue: number }[]
}

export interface AdminUser extends User {
  failedLoginAttempts: number
  lockedUntil: string | null
}

export interface AuditEntry {
  id: number
  actorEmail: string | null
  action: string
  resourceType: string
  resourceId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ActivityEntry {
  action: string
  resourceType: string
  resourceId: string | null
  createdAt: string
}

export interface ApiErrorBody {
  timestamp: string
  status: number
  code: string
  message: string
  path: string
  fieldErrors?: Record<string, string>
}
