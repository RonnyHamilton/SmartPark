package com.smartpark.facility;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public final class FacilityDtos {

    private FacilityDtos() {}

    public record PricingRuleView(
            UUID id,
            String rateType,
            BigDecimal amount,
            int minimumDurationMinutes,
            int maximumDurationMinutes,
            java.time.LocalDate effectiveFrom,
            java.time.LocalDate effectiveTo,
            boolean active
    ) {}

    public record SlotView(
            UUID id,
            String slotCode,
            UUID floorId,
            String floorName,
            int floorNumber,
            String slotType,
            List<String> supportedVehicleTypes,
            boolean accessible,
            boolean evCharger,
            BigDecimal widthM,
            BigDecimal lengthM,
            String status,
            Integer layoutX,
            Integer layoutY
    ) {
        public static SlotView from(ParkingSlot slot) {
            return new SlotView(slot.getId(), slot.getSlotCode(), slot.getFloor().getId(),
                    slot.getFloor().getName(), slot.getFloor().getFloorNumber(), slot.getSlotType().name(),
                    slot.getSupportedVehicleTypes(), slot.isAccessible(), slot.isHasEvCharger(),
                    slot.getWidthM(), slot.getLengthM(), slot.getStatus().name(),
                    slot.getLayoutX(), slot.getLayoutY());
        }
    }

    public record FloorView(
            UUID id,
            String name,
            int floorNumber,
            int displayOrder,
            List<SlotView> slots
    ) {}

    public record FacilitySummary(
            UUID id,
            String name,
            String description,
            String address,
            String city,
            BigDecimal latitude,
            BigDecimal longitude,
            String timezone,
            LocalTime opensAt,
            LocalTime closesAt,
            String operatingDays,
            List<String> amenities,
            String status,
            int minDurationMinutes,
            int maxDurationMinutes,
            int advanceBookingDays,
            int cancellationCutoffMinutes,
            int bufferMinutes,
            int checkInGracePeriodMinutes,
            BigDecimal overstayMultiplier,
            long totalSlots,
            long availableSlots,
            BigDecimal hourlyRate
    ) {}

    public record FacilityDetail(
            FacilitySummary facility,
            List<FloorView> floors,
            List<PricingRuleView> pricingRules
    ) {}

    public record SlotAvailability(
            UUID slotId,
            String slotCode,
            UUID floorId,
            String floorName,
            int floorNumber,
            String slotType,
            boolean accessible,
            boolean evCharger,
            BigDecimal widthM,
            BigDecimal lengthM,
            String physicalStatus,
            String state,
            boolean bookable,
            String reason
    ) {}

    public record AvailabilityResponse(
            UUID facilityId,
            String facilityName,
            String timezone,
            Instant start,
            Instant end,
            long totalSlots,
            long bookableSlots,
            BigDecimal estimatedPrice,
            String priceExplanation,
            List<SlotAvailability> slots
    ) {}
}
