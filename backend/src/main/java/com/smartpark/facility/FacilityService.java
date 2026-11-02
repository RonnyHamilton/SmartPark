package com.smartpark.facility;

import com.smartpark.booking.BookingRepository;
import com.smartpark.booking.BookingStatus;
import com.smartpark.common.ConflictException;
import com.smartpark.common.NotFoundException;
import com.smartpark.pricing.PricingRule;
import com.smartpark.pricing.PricingRuleRepository;
import com.smartpark.pricing.PricingService;
import com.smartpark.vehicle.VehicleType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class FacilityService {

    private static final List<BookingStatus> LIVE = List.of(BookingStatus.PENDING,
            BookingStatus.CONFIRMED, BookingStatus.ACTIVE,
            BookingStatus.OVERSTAY, BookingStatus.CONFLICT_REQUIRES_ADMIN);

    private final FacilityRepository facilityRepository;
    private final ParkingFloorRepository floorRepository;
    private final ParkingSlotRepository slotRepository;
    private final PricingRuleRepository pricingRepository;
    private final PricingService pricingService;
    private final BookingRepository bookingRepository;
    private final FacilityPolicy policy;

    public FacilityService(FacilityRepository facilityRepository, ParkingFloorRepository floorRepository,
                           ParkingSlotRepository slotRepository, PricingRuleRepository pricingRepository,
                           PricingService pricingService, BookingRepository bookingRepository,
                           FacilityPolicy policy) {
        this.facilityRepository = facilityRepository;
        this.floorRepository = floorRepository;
        this.slotRepository = slotRepository;
        this.pricingRepository = pricingRepository;
        this.pricingService = pricingService;
        this.bookingRepository = bookingRepository;
        this.policy = policy;
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.FacilitySummary> list(String query, String city, String vehicleType,
                                                   boolean accessible, boolean evOnly, BigDecimal maxPrice,
                                                   String amenity) {
        VehicleType type = parseVehicleType(vehicleType);
        LocalDate today = LocalDate.now();
        List<FacilityDtos.FacilitySummary> result = new ArrayList<>();
        for (Facility facility : facilityRepository.findByStatusOrderByNameAsc(FacilityStatus.ACTIVE)) {
            if (query != null && !query.isBlank()) {
                String needle = query.toLowerCase(Locale.ROOT);
                boolean matches = facility.getName().toLowerCase(Locale.ROOT).contains(needle)
                        || facility.getAddress().toLowerCase(Locale.ROOT).contains(needle)
                        || facility.getCity().toLowerCase(Locale.ROOT).contains(needle)
                        || facility.getDescription().toLowerCase(Locale.ROOT).contains(needle);
                if (!matches) continue;
            }
            if (city != null && !city.isBlank() && !facility.getCity().equalsIgnoreCase(city)) continue;
            if (amenity != null && !amenity.isBlank()
                    && facility.getAmenities().stream().noneMatch(a -> a.equalsIgnoreCase(amenity))) continue;

            List<ParkingSlot> slots = slotRepository.findByFacilityId(facility.getId());
            long available = slots.stream()
                    .filter(s -> s.getStatus() == SlotStatus.AVAILABLE)
                    .filter(s -> type == null || s.getSupportedVehicleTypes().contains(type.name()))
                    .filter(s -> !evOnly || s.isHasEvCharger())
                    .filter(s -> !accessible || s.isAccessible())
                    .count();
            BigDecimal hourly = hourlyRate(facility.getId(), today);
            if (maxPrice != null && hourly != null && hourly.compareTo(maxPrice) > 0) continue;

            result.add(summary(facility, slots.size(), available, hourly));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.FacilitySummary> listAllForAdmin() {
        List<FacilityDtos.FacilitySummary> result = new ArrayList<>();
        for (Facility facility : facilityRepository.findAll()) {
            List<ParkingSlot> slots = slotRepository.findByFacilityId(facility.getId());
            long available = slots.stream().filter(s -> s.getStatus() == SlotStatus.AVAILABLE).count();
            result.add(summary(facility, slots.size(), available,
                    hourlyRate(facility.getId(), LocalDate.now())));
        }
        result.sort(Comparator.comparing(FacilityDtos.FacilitySummary::name));
        return result;
    }

    @Transactional(readOnly = true)
    public FacilityDtos.FacilityDetail detail(UUID facilityId, boolean includeInactive) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new NotFoundException("Parking facility not found."));
        if (!includeInactive && facility.getStatus() != FacilityStatus.ACTIVE) {
            throw new NotFoundException("Parking facility is not available.");
        }
        List<ParkingSlot> slots = slotRepository.findByFacilityId(facilityId);
        List<FacilityDtos.FloorView> floors = new ArrayList<>();
        for (ParkingFloor floor : floorRepository.findByFacilityIdOrderByDisplayOrderAsc(facilityId)) {
            List<FacilityDtos.SlotView> floorSlots = slots.stream()
                    .filter(s -> s.getFloor().getId().equals(floor.getId()))
                    .map(FacilityDtos.SlotView::from).toList();
            floors.add(new FacilityDtos.FloorView(floor.getId(), floor.getName(), floor.getFloorNumber(),
                    floor.getDisplayOrder(), floorSlots));
        }
        List<FacilityDtos.PricingRuleView> rules = pricingRepository.findByFacilityIdOrderByAmountAsc(facilityId)
                .stream().map(this::ruleView).toList();
        long available = slots.stream().filter(s -> s.getStatus() == SlotStatus.AVAILABLE).count();
        return new FacilityDtos.FacilityDetail(
                summary(facility, slots.size(), available, hourlyRate(facilityId, LocalDate.now())),
                floors, rules);
    }

    @Transactional(readOnly = true)
    public FacilityDtos.AvailabilityResponse availability(UUID facilityId, Instant start, Instant end,
                                                          String vehicleType, boolean accessible,
                                                          boolean evOnly) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new NotFoundException("Parking facility not found."));
        if (facility.getStatus() != FacilityStatus.ACTIVE) {
            throw new NotFoundException("Parking facility is not available.");
        }
        if (start == null || end == null) {
            throw new com.smartpark.common.BadRequestException("start and end query parameters are required.");
        }
        if (Duration.between(start, end).toMinutes() > 7 * 24 * 60) {
            throw new com.smartpark.common.BadRequestException("Availability windows are limited to 7 days.");
        }
        policy.validateWindow(facility, start, end);

        VehicleType type = parseVehicleType(vehicleType);
        List<ParkingSlot> slots = slotRepository.findByFacilityId(facilityId);
        Set<UUID> conflicts = new HashSet<>(bookingRepository.findOverlappingSlotIds(facilityId, start, end, LIVE));
        Set<UUID> occupiedNow = new HashSet<>(bookingRepository.findCurrentlyOccupiedSlotIds(facilityId,
                Instant.now()));

        BigDecimal estimate = null;
        String explanation = null;
        try {
            var quote = pricingService.quote(facility, start, end);
            estimate = quote.amount();
            explanation = quote.explanation();
        } catch (ConflictException ex) {
            explanation = ex.getMessage();
        }

        List<FacilityDtos.SlotAvailability> rows = new ArrayList<>();
        long bookable = 0;
        for (ParkingSlot slot : slots) {
            boolean compatible = (type == null || slot.getSupportedVehicleTypes().contains(type.name()))
                    && (!evOnly || slot.isHasEvCharger())
                    && (!accessible || slot.isAccessible())
                    && (type != VehicleType.EV || slot.isHasEvCharger());
            String state;
            String reason;
            if (slot.getStatus() != SlotStatus.AVAILABLE) {
                state = "OUT_OF_SERVICE";
                reason = "This bay is withdrawn from service.";
            } else if (occupiedNow.contains(slot.getId())) {
                state = "OCCUPIED";
                reason = "An active session is using this bay.";
            } else if (conflicts.contains(slot.getId())) {
                state = "RESERVED";
                reason = "Reserved for part of the selected period.";
            } else {
                state = "AVAILABLE";
                reason = compatible ? "Free for the full selected period." : incompatibilityReason(slot, type, accessible, evOnly);
            }
            boolean isBookable = "AVAILABLE".equals(state) && compatible;
            if (isBookable) bookable++;
            rows.add(new FacilityDtos.SlotAvailability(slot.getId(), slot.getSlotCode(),
                    slot.getFloor().getId(), slot.getFloor().getName(), slot.getFloor().getFloorNumber(),
                    slot.getSlotType().name(), slot.isAccessible(), slot.isHasEvCharger(),
                    slot.getWidthM(), slot.getLengthM(), slot.getStatus().name(), state, isBookable, reason));
        }
        rows.sort(Comparator.comparing(FacilityDtos.SlotAvailability::floorNumber)
                .thenComparing(FacilityDtos.SlotAvailability::slotCode));

        return new FacilityDtos.AvailabilityResponse(facility.getId(), facility.getName(), facility.getTimezone(),
                start, end, slots.size(), bookable, estimate, explanation, rows);
    }

    public BigDecimal hourlyRate(UUID facilityId, LocalDate date) {
        return pricingRepository.findActiveForDate(facilityId, date).stream()
                .filter(r -> r.getRateType() == com.smartpark.pricing.RateType.HOURLY)
                .map(PricingRule::getAmount)
                .min(BigDecimal::compareTo)
                .orElse(null);
    }

    private String incompatibilityReason(ParkingSlot slot, VehicleType type, boolean accessible, boolean evOnly) {
        if (type != null && !slot.getSupportedVehicleTypes().contains(type.name())) {
            return "This bay does not support a " + type.name().toLowerCase(Locale.ROOT) + ".";
        }
        if (accessible && !slot.isAccessible()) {
            return "Not an accessible bay.";
        }
        if (evOnly || type == VehicleType.EV) {
            return "EV charging is required for this search.";
        }
        return "Not compatible with the selected filters.";
    }

    public FacilityDtos.FacilitySummary summary(Facility facility, long total, long available, BigDecimal hourly) {
        return new FacilityDtos.FacilitySummary(facility.getId(), facility.getName(), facility.getDescription(),
                facility.getAddress(), facility.getCity(), facility.getLatitude(), facility.getLongitude(),
                facility.getTimezone(), facility.getOpensAt(), facility.getClosesAt(), facility.getOperatingDays(),
                facility.getAmenities(), facility.getStatus().name(), facility.getMinDurationMinutes(),
                facility.getMaxDurationMinutes(), facility.getAdvanceBookingDays(),
                facility.getCancellationCutoffMinutes(), facility.getBufferMinutes(),
                facility.getCheckInGracePeriodMinutes(), facility.getOverstayMultiplier(),
                total, available, hourly);
    }

    public FacilityDtos.PricingRuleView ruleView(PricingRule rule) {
        return new FacilityDtos.PricingRuleView(rule.getId(), rule.getRateType().name(), rule.getAmount(),
                rule.getMinimumDurationMinutes(), rule.getMaximumDurationMinutes(), rule.getEffectiveFrom(),
                rule.getEffectiveTo(), rule.isActive());
    }

    private VehicleType parseVehicleType(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return VehicleType.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new com.smartpark.common.BadRequestException("Unknown vehicle type: " + value);
        }
    }

    public Facility getActiveFacility(UUID id) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Parking facility not found."));
        if (facility.getStatus() != FacilityStatus.ACTIVE) {
            throw new NotFoundException("Parking facility is not available.");
        }
        return facility;
    }
}
