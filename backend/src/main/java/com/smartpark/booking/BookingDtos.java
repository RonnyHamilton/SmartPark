package com.smartpark.booking;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class BookingDtos {

    private BookingDtos() {}

    public record CreateBookingRequest(
            @NotNull(message = "Facility is required") UUID facilityId,
            @NotNull(message = "Vehicle is required") UUID vehicleId,
            @NotNull(message = "Start time is required") Instant startTime,
            @NotNull(message = "End time is required") Instant endTime,
            UUID preferredSlotId,
            UUID preferredFloorId,
            Boolean accessibilityRequired
    ) {}

    public record RescheduleRequest(
            @NotNull(message = "New start time is required") Instant startTime,
            @NotNull(message = "New end time is required") Instant endTime,
            UUID preferredSlotId,
            UUID preferredFloorId
    ) {}

    public record CancelRequest(
            @Size(max = 500, message = "Reason must be at most 500 characters")
            String reason
    ) {}

    public record CheckInRequest(String token) {}

    public record QuoteRequest(
            @NotNull(message = "Facility is required") UUID facilityId,
            @NotNull(message = "Vehicle is required") UUID vehicleId,
            @NotNull(message = "Start time is required") Instant startTime,
            @NotNull(message = "End time is required") Instant endTime,
            UUID preferredSlotId,
            UUID preferredFloorId,
            Boolean accessibilityRequired
    ) {}

    public record AlternativeSlot(
            UUID slotId,
            String slotCode,
            String floorName,
            int floorNumber,
            String slotType
    ) {}

    public record AllocationPreview(
            UUID slotId,
            String slotCode,
            String floorName,
            int floorNumber,
            String slotType,
            boolean accessible,
            boolean evCharger,
            String reason
    ) {}

    public record QuoteResponse(
            UUID facilityId,
            String facilityName,
            String facilityTimezone,
            Instant startTime,
            Instant endTime,
            long durationMinutes,
            BigDecimal estimatedPrice,
            String priceExplanation,
            AllocationPreview allocation,
            List<AlternativeSlot> alternatives,
            List<Instant> suggestedStarts,
            String message
    ) {}

    public record BookingView(
            UUID id,
            String bookingReference,
            String status,
            UUID facilityId,
            String facilityName,
            String facilityAddress,
            String facilityTimezone,
            UUID floorId,
            String floorName,
            String slotCode,
            String slotType,
            UUID vehicleId,
            String vehicleRegistration,
            String vehicleType,
            Instant startTime,
            Instant endTime,
            long durationMinutes,
            BigDecimal priceAmount,
            String currency,
            String allocationReason,
            boolean canCancel,
            boolean canModify,
            boolean canCheckIn,
            boolean canCheckOut,
            String checkInToken,
            Instant checkInTime,
            Instant checkOutTime,
            String cancellationReason,
            Instant cancelledAt,
            Instant createdAt,
            int cancellationCutoffMinutes,
            Instant overstayStartTime,
            long overstayDurationMinutes,
            BigDecimal overstayCharge,
            BigDecimal totalAmount,
            Instant noShowDetectedAt,
            UUID reassignedFromSlotId,
            String reassignedFromSlotCode,
            Instant reassignedAt,
            String conflictReason,
            Instant resolvedAt
    ) {}

    public record ResolveConflictRequest(
            UUID newSlotId,
            String resolutionNotes
    ) {}

    public record FacilityUsage(String facilityName, long bookings) {}

    public record BookingStats(
            long totalBookings,
            long upcomingBookings,
            long activeBookings,
            long completedBookings,
            long cancelledBookings,
            long overstayBookings,
            long noShowBookings,
            BigDecimal totalSpent,
            List<FacilityUsage> frequentlyUsedFacilities
    ) {}
}
