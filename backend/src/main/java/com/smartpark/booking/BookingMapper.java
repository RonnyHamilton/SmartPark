package com.smartpark.booking;

import com.smartpark.facility.FacilityPolicy;
import com.smartpark.security.JwtService;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
public class BookingMapper {

    private final CheckInRepository checkInRepository;
    private final JwtService jwtService;
    private final FacilityPolicy policy;

    public BookingMapper(CheckInRepository checkInRepository, JwtService jwtService, FacilityPolicy policy) {
        this.checkInRepository = checkInRepository;
        this.jwtService = jwtService;
        this.policy = policy;
    }

    public BookingDtos.BookingView toView(Booking booking, boolean includeCheckInToken) {
        Instant now = Instant.now();
        var facility = booking.getSlot().getFloor().getFacility();
        var checkIn = checkInRepository.findByBookingId(booking.getId()).orElse(null);

        Instant cutoff = policy != null ? policy.cancellationCutoff(facility, booking.getStartTime()) : null;
        boolean canCancel = (booking.getStatus() == BookingStatus.PENDING
                || booking.getStatus() == BookingStatus.CONFIRMED
                || booking.getStatus() == BookingStatus.CONFLICT_REQUIRES_ADMIN)
                && (cutoff == null || now.isBefore(cutoff));
        boolean canCheckIn = booking.getStatus() == BookingStatus.CONFIRMED
                && !now.isBefore(booking.getStartTime().minus(Duration.ofMinutes(30)))
                && now.isBefore(booking.getEndTime().plus(Duration.ofMinutes(facility.getCheckInGracePeriodMinutes())));
        boolean canCheckOut = (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.OVERSTAY)
                && checkIn != null;

        String token = null;
        if (includeCheckInToken && booking.getStatus() == BookingStatus.CONFIRMED
                && booking.getEndTime().isAfter(now)) {
            token = jwtService.generateCheckInToken(booking.getId(), booking.getUser().getId(), booking.getEndTime());
        }

        long liveOverstayDuration = booking.getOverstayDurationMinutes();
        if (booking.getStatus() == BookingStatus.OVERSTAY && liveOverstayDuration == 0) {
            liveOverstayDuration = Math.max(0, Duration.between(booking.getEndTime(), now).toMinutes());
        }
        var overstayCharge = booking.getOverstayCharge() != null ? booking.getOverstayCharge() : java.math.BigDecimal.ZERO;
        var totalAmount = booking.getPriceAmount().add(overstayCharge);

        return new BookingDtos.BookingView(
                booking.getId(), booking.getBookingReference(), booking.getStatus().name(),
                facility.getId(), facility.getName(), facility.getAddress(), facility.getTimezone(),
                booking.getSlot().getFloor().getId(), booking.getSlot().getFloor().getName(),
                booking.getSlot().getSlotCode(), booking.getSlot().getSlotType().name(),
                booking.getVehicle().getId(), booking.getVehicle().getRegistrationNumber(),
                booking.getVehicle().getVehicleType().name(),
                booking.getStartTime(), booking.getEndTime(),
                Duration.between(booking.getStartTime(), booking.getEndTime()).toMinutes(),
                booking.getPriceAmount(), booking.getCurrency(), booking.getAllocationReason(),
                canCancel, canCancel, canCheckIn, canCheckOut,
                token,
                checkIn != null ? checkIn.getCheckInTime() : null,
                checkIn != null ? checkIn.getCheckOutTime() : null,
                booking.getCancellationReason(), booking.getCancelledAt(), booking.getCreatedAt(),
                facility.getCancellationCutoffMinutes(),
                booking.getOverstayStartTime(),
                liveOverstayDuration,
                overstayCharge,
                totalAmount,
                booking.getNoShowDetectedAt(),
                booking.getReassignedFromSlot() != null ? booking.getReassignedFromSlot().getId() : null,
                booking.getReassignedFromSlot() != null ? booking.getReassignedFromSlot().getSlotCode() : null,
                booking.getReassignedAt(),
                booking.getConflictReason(),
                booking.getResolvedAt());
    }

    public List<BookingDtos.BookingView> toViews(List<Booking> bookings) {
        return bookings.stream().map(b -> toView(b, false)).toList();
    }
}
