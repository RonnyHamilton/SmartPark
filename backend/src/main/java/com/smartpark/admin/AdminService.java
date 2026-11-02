package com.smartpark.admin;

import com.smartpark.audit.AuditLog;
import com.smartpark.audit.AuditLogRepository;
import com.smartpark.audit.AuditService;
import com.smartpark.auth.RefreshTokenRepository;
import com.smartpark.booking.BookingRepository;
import com.smartpark.common.BadRequestException;
import com.smartpark.common.ConflictException;
import com.smartpark.common.NotFoundException;
import com.smartpark.facility.Facility;
import com.smartpark.facility.FacilityRepository;
import com.smartpark.facility.FacilityStatus;
import com.smartpark.facility.ParkingFloor;
import com.smartpark.facility.ParkingFloorRepository;
import com.smartpark.facility.ParkingSlot;
import com.smartpark.facility.ParkingSlotRepository;
import com.smartpark.facility.SlotStatus;
import com.smartpark.pricing.PricingRule;
import com.smartpark.pricing.PricingRuleRepository;
import com.smartpark.pricing.RateType;
import com.smartpark.security.CurrentUser;
import com.smartpark.user.AccountStatus;
import com.smartpark.user.Role;
import com.smartpark.user.User;
import com.smartpark.user.UserRepository;
import com.smartpark.vehicle.VehicleType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AdminService {

    private final FacilityRepository facilityRepository;
    private final ParkingFloorRepository floorRepository;
    private final ParkingSlotRepository slotRepository;
    private final PricingRuleRepository pricingRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;
    private final CurrentUser currentUser;

    public AdminService(FacilityRepository facilityRepository, ParkingFloorRepository floorRepository,
                        ParkingSlotRepository slotRepository, PricingRuleRepository pricingRepository,
                        BookingRepository bookingRepository, UserRepository userRepository,
                        RefreshTokenRepository refreshTokenRepository, AuditLogRepository auditLogRepository,
                        AuditService auditService, CurrentUser currentUser) {
        this.facilityRepository = facilityRepository;
        this.floorRepository = floorRepository;
        this.slotRepository = slotRepository;
        this.pricingRepository = pricingRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.auditLogRepository = auditLogRepository;
        this.auditService = auditService;
        this.currentUser = currentUser;
    }

    // ---------------- Facilities ----------------

    @Transactional
    public Facility createFacility(AdminDtos.FacilityRequest request) {
        validateTimeZone(request.timezone());
        Facility facility = new Facility();
        applyFacility(facility, request);
        facilityRepository.save(facility);
        audit("FACILITY_CREATED", "FACILITY", facility.getId().toString(), Map.of("name", facility.getName()));
        return facility;
    }

    @Transactional
    public Facility updateFacility(UUID id, AdminDtos.FacilityRequest request) {
        validateTimeZone(request.timezone());
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Facility not found."));
        applyFacility(facility, request);
        facilityRepository.save(facility);
        audit("FACILITY_UPDATED", "FACILITY", facility.getId().toString(), Map.of("name", facility.getName()));
        return facility;
    }

    @Transactional
    public void deleteFacility(UUID id) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Facility not found."));
        if (bookingRepository.existsBySlotFloorFacilityId(id)) {
            throw new ConflictException("This facility has booking history. Set its status to INACTIVE instead of deleting it.");
        }
        facilityRepository.delete(facility);
        audit("FACILITY_DELETED", "FACILITY", id.toString(), Map.of("name", facility.getName()));
    }

    private void applyFacility(Facility facility, AdminDtos.FacilityRequest request) {
        if (request.status() == null) {
            throw new BadRequestException("Facility status is required.");
        }
        if (request.bufferMinutes() > 120) {
            throw new BadRequestException("Turnaround buffer cannot exceed 120 minutes.");
        }
        facility.setName(request.name().trim());
        facility.setDescription(request.description() == null ? "" : request.description());
        facility.setAddress(request.address().trim());
        facility.setCity(request.city().trim());
        facility.setLatitude(request.latitude());
        facility.setLongitude(request.longitude());
        facility.setTimezone(request.timezone());
        facility.setOpensAt(request.opensAt());
        facility.setClosesAt(request.closesAt());
        facility.setOperatingDays(request.operatingDays());
        facility.setAmenities(request.amenities() == null ? List.of() : request.amenities().stream()
                .filter(a -> a != null && !a.isBlank()).map(String::trim).distinct().toList());
        facility.setStatus(request.status());
        facility.setMinDurationMinutes(request.minDurationMinutes());
        facility.setMaxDurationMinutes(request.maxDurationMinutes());
        facility.setAdvanceBookingDays(request.advanceBookingDays());
        facility.setCancellationCutoffMinutes(request.cancellationCutoffMinutes());
        facility.setBufferMinutes(request.bufferMinutes());
        if (request.checkInGracePeriodMinutes() != null) {
            facility.setCheckInGracePeriodMinutes(Math.max(0, request.checkInGracePeriodMinutes()));
        }
        if (request.overstayMultiplier() != null) {
            facility.setOverstayMultiplier(request.overstayMultiplier());
        }
    }

    private void validateTimeZone(String timezone) {
        try {
            ZoneId.of(timezone);
        } catch (Exception ex) {
            throw new BadRequestException("Unknown timezone: " + timezone);
        }
    }

    // ---------------- Floors ----------------

    @Transactional
    public ParkingFloor createFloor(UUID facilityId, AdminDtos.FloorRequest request) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new NotFoundException("Facility not found."));
        ParkingFloor floor = new ParkingFloor();
        floor.setFacility(facility);
        floor.setName(request.name().trim());
        floor.setFloorNumber(request.floorNumber());
        floor.setDisplayOrder(request.displayOrder());
        floorRepository.save(floor);
        audit("FLOOR_CREATED", "FLOOR", floor.getId().toString(),
                Map.of("facility", facility.getName(), "name", floor.getName()));
        return floor;
    }

    @Transactional
    public ParkingFloor updateFloor(UUID id, AdminDtos.FloorRequest request) {
        ParkingFloor floor = floorRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Floor not found."));
        floor.setName(request.name().trim());
        floor.setFloorNumber(request.floorNumber());
        floor.setDisplayOrder(request.displayOrder());
        floorRepository.save(floor);
        audit("FLOOR_UPDATED", "FLOOR", id.toString(), Map.of("name", floor.getName()));
        return floor;
    }

    @Transactional
    public void deleteFloor(UUID id) {
        ParkingFloor floor = floorRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Floor not found."));
        if (slotRepository.countByFloorId(id) > 0) {
            throw new ConflictException("Remove the floor's slots before deleting the floor.");
        }
        floorRepository.delete(floor);
        audit("FLOOR_DELETED", "FLOOR", id.toString(), Map.of("name", floor.getName()));
    }

    // ---------------- Slots ----------------

    @Transactional
    public ParkingSlot createSlot(UUID floorId, AdminDtos.SlotRequest request) {
        ParkingFloor floor = floorRepository.findById(floorId)
                .orElseThrow(() -> new NotFoundException("Floor not found."));
        if (request.supportedVehicleTypes().isEmpty()) {
            throw new BadRequestException("Select at least one compatible vehicle type.");
        }
        ParkingSlot slot = new ParkingSlot();
        slot.setFloor(floor);
        applySlot(slot, request);
        slotRepository.save(slot);
        audit("SLOT_CREATED", "SLOT", slot.getId().toString(),
                Map.of("code", slot.getSlotCode(), "floor", floor.getName()));
        return slot;
    }

    @Transactional
    public ParkingSlot updateSlot(UUID id, AdminDtos.SlotRequest request) {
        ParkingSlot slot = slotRepository.findByIdWithFloor(id)
                .orElseThrow(() -> new NotFoundException("Slot not found."));
        applySlot(slot, request);
        slotRepository.save(slot);
        audit("SLOT_UPDATED", "SLOT", id.toString(),
                Map.of("code", slot.getSlotCode(), "status", slot.getStatus().name()));
        return slot;
    }

    private void applySlot(ParkingSlot slot, AdminDtos.SlotRequest request) {
        if (request.supportedVehicleTypes() == null || request.supportedVehicleTypes().isEmpty()) {
            throw new BadRequestException("Select at least one compatible vehicle type.");
        }
        if (request.evCharger() && !request.supportedVehicleTypes().contains(VehicleType.EV)) {
            throw new BadRequestException("EV-capable bays must support the EV vehicle type.");
        }
        slot.setSlotCode(request.slotCode().trim().toUpperCase());
        slot.setSlotType(request.slotType());
        slot.setSupportedVehicleTypes(request.supportedVehicleTypes().stream()
                .map(Enum::name).distinct().toList());
        slot.setAccessible(request.accessible());
        slot.setHasEvCharger(request.evCharger());
        if (request.widthM() != null) slot.setWidthM(request.widthM());
        if (request.lengthM() != null) slot.setLengthM(request.lengthM());
        slot.setStatus(request.status() == null ? SlotStatus.AVAILABLE : request.status());
        slot.setLayoutX(request.layoutX());
        slot.setLayoutY(request.layoutY());
    }

    @Transactional
    public void deleteSlot(UUID id) {
        ParkingSlot slot = slotRepository.findByIdWithFloor(id)
                .orElseThrow(() -> new NotFoundException("Slot not found."));
        if (bookingRepository.existsBySlotId(id)) {
            throw new ConflictException("This bay has booking history. Mark it OUT_OF_SERVICE instead.");
        }
        slotRepository.delete(slot);
        audit("SLOT_DELETED", "SLOT", id.toString(), Map.of("code", slot.getSlotCode()));
    }

    // ---------------- Pricing ----------------

    @Transactional
    public PricingRule createPricing(UUID facilityId, AdminDtos.PricingRequest request) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new NotFoundException("Facility not found."));
        PricingRule rule = new PricingRule();
        rule.setFacility(facility);
        applyPricing(rule, request);
        pricingRepository.save(rule);
        audit("PRICING_CREATED", "PRICING_RULE", rule.getId().toString(),
                Map.of("facility", facility.getName(), "amount", request.amount()));
        return rule;
    }

    @Transactional
    public PricingRule updatePricing(UUID id, AdminDtos.PricingRequest request) {
        PricingRule rule = pricingRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Pricing rule not found."));
        applyPricing(rule, request);
        pricingRepository.save(rule);
        audit("PRICING_UPDATED", "PRICING_RULE", id.toString(), Map.of("amount", request.amount()));
        return rule;
    }

    private void applyPricing(PricingRule rule, AdminDtos.PricingRequest request) {
        if (request.maximumDurationMinutes() <= request.minimumDurationMinutes()) {
            throw new BadRequestException("Maximum duration must exceed minimum duration.");
        }
        if (request.rateType() != RateType.FLAT && request.amount().signum() == 0) {
            throw new BadRequestException("Rate amount must be greater than zero.");
        }
        rule.setRateType(request.rateType());
        rule.setAmount(request.amount().setScale(2, RoundingMode.HALF_UP));
        rule.setMinimumDurationMinutes(request.minimumDurationMinutes());
        rule.setMaximumDurationMinutes(request.maximumDurationMinutes());
        rule.setEffectiveFrom(request.effectiveFrom());
        rule.setEffectiveTo(request.effectiveTo());
        rule.setActive(request.active() == null || request.active());
    }

    @Transactional
    public void deletePricing(UUID id) {
        PricingRule rule = pricingRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Pricing rule not found."));
        pricingRepository.delete(rule);
        audit("PRICING_DELETED", "PRICING_RULE", id.toString(), Map.of());
    }

    // ---------------- Users ----------------

    @Transactional(readOnly = true)
    public Page<User> users(String query, Pageable pageable) {
        return userRepository.search(query == null || query.isBlank() ? null : query.trim(), pageable);
    }

    @Transactional
    public User setUserStatus(UUID id, AccountStatus status) {
        User target = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found."));
        if (target.getId().equals(currentUser.id()) && status == AccountStatus.DISABLED) {
            throw new BadRequestException("You cannot disable your own account.");
        }
        target.setAccountStatus(status);
        if (status == AccountStatus.DISABLED) {
            refreshTokenRepository.revokeAllForUser(id, Instant.now());
            target.setLockedUntil(null);
            target.setFailedLoginAttempts(0);
        }
        userRepository.save(target);
        audit("USER_STATUS_CHANGED", "USER", id.toString(), Map.of("status", status.name()));
        return target;
    }

    @Transactional
    public User setUserRole(UUID id, Role role) {
        User target = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found."));
        if (target.getId().equals(currentUser.id())) {
            throw new BadRequestException("You cannot change your own role.");
        }
        target.setRole(role);
        userRepository.save(target);
        refreshTokenRepository.revokeAllForUser(id, Instant.now());
        audit("USER_ROLE_CHANGED", "USER", id.toString(), Map.of("role", role.name()));
        return target;
    }

    // ---------------- Audit ----------------

    @Transactional(readOnly = true)
    public Page<AdminDtos.AuditView> auditLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(log -> new AdminDtos.AuditView(log.getId(),
                        log.getActor() == null ? null : log.getActor().getEmail(),
                        log.getAction(), log.getResourceType(), log.getResourceId(),
                        log.getMetadata(), log.getCreatedAt()));
    }

    // ---------------- Analytics ----------------

    @Transactional(readOnly = true)
    public AdminDtos.AnalyticsResponse analytics(Instant from, Instant to) {
        Instant rangeTo = to == null ? Instant.now() : to;
        Instant rangeFrom = from == null ? rangeTo.minus(Duration.ofDays(30)) : from;
        if (!rangeTo.isAfter(rangeFrom)) {
            throw new BadRequestException("The analytics end date must be after the start date.");
        }
        if (Duration.between(rangeFrom, rangeTo).toDays() > 366) {
            throw new BadRequestException("Analytics ranges are limited to 366 days.");
        }

        long bookingsInRange = bookingRepository.countCreatedBetween(rangeFrom, rangeTo);
        long cancelledInRange = bookingRepository.countCancelledBetween(rangeFrom, rangeTo);
        BigDecimal revenue = bookingRepository.sumRevenue(rangeFrom, rangeTo);
        long totalSlots = slotRepository.count();
        long occupied = bookingRepository.countCurrentlyActive(Instant.now());
        long totalUsers = userRepository.count();
        long totalFacilities = facilityRepository.count();

        List<AdminDtos.DailyPoint> daily = bookingRepository.revenueByDay(rangeFrom, rangeTo).stream()
                .map(row -> new AdminDtos.DailyPoint(String.valueOf(row[0]),
                        ((Number) row[1]).longValue(), (BigDecimal) row[2]))
                .toList();
        List<AdminDtos.FacilityPoint> byFacility = bookingRepository.bookingsByFacility(rangeFrom, rangeTo).stream()
                .map(row -> new AdminDtos.FacilityPoint((String) row[0],
                        ((Number) row[1]).longValue(), (BigDecimal) row[2]))
                .toList();

        BigDecimal average = bookingsInRange == 0 ? BigDecimal.ZERO
                : revenue.divide(BigDecimal.valueOf(Math.max(1, bookingsInRange - cancelledInRange)), 2,
                RoundingMode.HALF_UP);
        double cancellationRate = bookingsInRange == 0 ? 0.0
                : Math.round(cancelledInRange * 1000.0 / bookingsInRange) / 10.0;

        return new AdminDtos.AnalyticsResponse(rangeFrom, rangeTo, bookingsInRange,
                bookingRepository.count(), bookingRepository.countByStatus(com.smartpark.booking.BookingStatus.CONFIRMED),
                bookingRepository.countByStatus(com.smartpark.booking.BookingStatus.ACTIVE),
                bookingRepository.countByStatus(com.smartpark.booking.BookingStatus.COMPLETED),
                bookingRepository.countByStatus(com.smartpark.booking.BookingStatus.CANCELLED),
                revenue, average, cancellationRate, totalUsers, totalFacilities, totalSlots, occupied,
                totalSlots == 0 ? 0.0 : Math.round(occupied * 1000.0 / totalSlots) / 10.0,
                daily, byFacility);
    }

    private void audit(String action, String resourceType, String resourceId, Map<String, Object> metadata) {
        auditService.record(currentUser.entity(), action, resourceType, resourceId, metadata);
    }
}
