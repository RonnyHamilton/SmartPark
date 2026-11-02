import { toast } from 'sonner'
import type { Booking } from '../types'

export function exportBookingsToCsv(bookings: Booking[], filename = 'smartpark-bookings.csv') {
  if (!bookings || bookings.length === 0) {
    toast.error('No reservation records to export')
    return
  }

  const headers = [
    'Reference',
    'Facility Name',
    'Address',
    'Floor',
    'Bay Code',
    'Vehicle Plate',
    'Vehicle Type',
    'Start Time',
    'End Time',
    'Duration (Min)',
    'Status',
    'Amount (₹)',
    'Created At',
  ]

  const escapeCsv = (val: string | number | null | undefined) => {
    if (val == null) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const rows = bookings.map((b) => [
    escapeCsv(b.bookingReference),
    escapeCsv(b.facilityName),
    escapeCsv(b.facilityAddress),
    escapeCsv(b.floorName),
    escapeCsv(b.slotCode),
    escapeCsv(b.vehicleRegistration),
    escapeCsv(b.vehicleType),
    escapeCsv(b.startTime),
    escapeCsv(b.endTime),
    escapeCsv(b.durationMinutes),
    escapeCsv(b.status),
    escapeCsv(b.priceAmount),
    escapeCsv(b.createdAt),
  ])

  const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success(`Exported ${bookings.length} reservations to CSV`)
}
