package com.smartpark.admin;

import com.smartpark.facility.FacilityStatus;
import com.smartpark.facility.SlotStatus;
import com.smartpark.facility.SlotType;
import com.smartpark.pricing.RateType;
import com.smartpark.user.AccountStatus;
import com.smartpark.user.Role;
import com.smartpark.vehicle.VehicleType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public final class AdminDtos {

    private AdminDtos() {}

    public record FacilityRequest(
            @NotBlank @Size(max = 160) String name,
            @Size(max = 4000) String description,
            @NotBlank @Size(max = 255) String address,
            @NotBlank @Size(max = 120) String city,
            BigDecimal latitude,
            BigDecimal longitude,
            @NotBlank String timezone,
            @NotNull LocalTime opensAt,
            @NotNull LocalTime closesAt,
            @NotBlank @Pattern(regexp = "^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$",
                    message = "Use comma-separated day codes such as MON,TUE") String operatingDays,
            List<String> amenities,
            FacilityStatus status,
            @Min(15) int minDurationMinutes,
            @Min(30) int maxDurationMinutes,
            @Min(1) int advanceBookingDays,
            @Min(0) int cancellationCutoffMinutes,
            @Min(0) int bufferMinutes,
            Integer checkInGracePeriodMinutes,
            BigDecimal overstayMultiplier
    ) {
        @AssertTrue(message = "Closing time must be after opening time")
        public boolean isHoursValid() {
            return opensAt == null || closesAt == null || closesAt.isAfter(opensAt);
        }

        @AssertTrue(message = "Maximum duration must exceed minimum duration")
        public boolean isDurationsValid() {
            return maxDurationMinutes > minDurationMinutes;
        }
    }

    public record FloorRequest(
            @NotBlank @Size(max = 80) String name,
            int floorNumber,
            int displayOrder
    ) {}

    public record SlotRequest(
            @NotBlank @Size(max = 20) String slotCode,
            @NotNull SlotType slotType,
            @NotNull List<VehicleType> supportedVehicleTypes,
            boolean accessible,
            boolean evCharger,
            @DecimalMin("0.5") BigDecimal widthM,
            @DecimalMin("0.5") BigDecimal lengthM,
            SlotStatus status,
            Integer layoutX,
            Integer layoutY
    ) {}

    public record PricingRequest(
            @NotNull RateType rateType,
            @NotNull @DecimalMin("0.0") BigDecimal amount,
            @Min(15) int minimumDurationMinutes,
            @Min(30) int maximumDurationMinutes,
            @NotNull LocalDate effectiveFrom,
            LocalDate effectiveTo,
            Boolean active
    ) {
        @AssertTrue(message = "Effective-to date cannot precede effective-from")
        public boolean isEffectiveRangeValid() {
            return effectiveTo == null || effectiveFrom == null || !effectiveTo.isBefore(effectiveFrom);
        }
    }

    public record UserView(
            UUID id,
            String name,
            String email,
            String role,
            String accountStatus,
            boolean accessibilityRequired,
            int failedLoginAttempts,
            Instant lockedUntil,
            Instant createdAt
    ) {
        public static UserView from(com.smartpark.user.User user) {
            return new UserView(user.getId(), user.getName(), user.getEmail(), user.getRole().name(),
                    user.getAccountStatus().name(), user.isAccessibilityRequired(),
                    user.getFailedLoginAttempts(), user.getLockedUntil(), user.getCreatedAt());
        }
    }

    public record UserStatusRequest(@NotNull AccountStatus status) {}

    public record UserRoleRequest(@NotNull Role role) {}

    public record AuditView(
            Long id,
            String actorEmail,
            String action,
            String resourceType,
            String resourceId,
            java.util.Map<String, Object> metadata,
            Instant createdAt
    ) {}

    public record DailyPoint(String date, long bookings, BigDecimal revenue) {}

    public record FacilityPoint(String facilityName, long bookings, BigDecimal revenue) {}

    public record AnalyticsResponse(
            Instant from,
            Instant to,
            long bookingsInRange,
            long totalBookings,
            long confirmedBookings,
            long activeBookings,
            long completedBookings,
            long cancelledBookings,
            BigDecimal revenueInRange,
            BigDecimal averageBookingValue,
            double cancellationRate,
            long totalUsers,
            long totalFacilities,
            long totalSlots,
            long currentlyOccupiedSlots,
            double occupancyRate,
            List<DailyPoint> daily,
            List<FacilityPoint> byFacility
    ) {}

    public record OverstayDashboardView(
            long noShowCount,
            long activeOverstayCount,
            long unresolvedConflictCount,
            List<com.smartpark.booking.BookingDtos.BookingView> activeOverstays,
            List<com.smartpark.booking.BookingDtos.BookingView> unresolvedConflicts,
            List<com.smartpark.booking.BookingDtos.BookingView> recentNoShows
    ) {}
}
