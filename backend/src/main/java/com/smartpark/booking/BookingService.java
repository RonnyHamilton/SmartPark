package com.smartpark.booking;

import com.smartpark.admin.AdminDtos;
import com.smartpark.audit.AuditService;
import com.smartpark.common.BadRequestException;
import com.smartpark.common.ConflictException;
import com.smartpark.common.MailService;
import com.smartpark.common.NotFoundException;
import com.smartpark.facility.Facility;
import com.smartpark.facility.FacilityPolicy;
import com.smartpark.facility.FacilityRepository;
import com.smartpark.facility.ParkingSlot;
import com.smartpark.facility.ParkingSlotRepository;
import com.smartpark.pricing.PricingService;
import com.smartpark.security.CurrentUser;
import com.smartpark.security.JwtService;
import com.smartpark.user.User;
import com.smartpark.vehicle.Vehicle;
import com.smartpark.vehicle.VehicleRepository;
import com.smartpark.vehicle.VehicleType;
import io.jsonwebtoken.Claims;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class BookingService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final BookingRepository bookingRepository;
    private final CheckInRepository checkInRepository;
    private final FacilityRepository facilityRepository;
    private final ParkingSlotRepository slotRepository;
    private final VehicleRepository vehicleRepository;
    private final AllocationService allocationService;
    private final PricingService pricingService;
    private final FacilityPolicy policy;
    private final BookingMapper mapper;
    private final CurrentUser currentUser;
    private final AuditService auditService;
    private final MailService mailService;
    private final JwtService jwtService;
    private final EntityManager entityManager;

    public BookingService(BookingRepository bookingRepository, CheckInRepository checkInRepository,
                          FacilityRepository facilityRepository, ParkingSlotRepository slotRepository,
                          VehicleRepository vehicleRepository, AllocationService allocationService,
                          PricingService pricingService, FacilityPolicy policy, BookingMapper mapper,
                          CurrentUser currentUser, AuditService auditService, MailService mailService,
                          JwtService jwtService, EntityManager entityManager) {
        this.bookingRepository = bookingRepository;
        this.checkInRepository = checkInRepository;
        this.facilityRepository = facilityRepository;
        this.slotRepository = slotRepository;
        this.vehicleRepository = vehicleRepository;
        this.allocationService = allocationService;
        this.pricingService = pricingService;
        this.policy = policy;
        this.mapper = mapper;
        this.currentUser = currentUser;
        this.auditService = auditService;
        this.mailService = mailService;
        this.jwtService = jwtService;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public BookingDtos.QuoteResponse quote(BookingDtos.QuoteRequest request) {
        User user = currentUser.entity();
        if (user.getRole() == com.smartpark.user.Role.ADMIN) {
            throw new ConflictException("Administrators manage system operations and cannot create parking slot reservations.");
        }
        Vehicle vehicle = vehicleRepository.findByIdAndUserId(request.vehicleId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Vehicle not found."));
        Facility facility = facilityRepository.findById(request.facilityId())
                .orElseThrow(() -> new NotFoundException("Parking facility not found."));
        if (facility.getStatus() != com.smartpark.facility.FacilityStatus.ACTIVE) {
            throw new ConflictException("This facility is not accepting reservations right now.");
        }
        policy.validateWindow(facility, request.startTime(), request.endTime());
        boolean accessibility = Boolean.TRUE.equals(request.accessibilityRequired())
                || user.isAccessibilityRequired();
        boolean userOverlap = bookingRepository.countUserOverlaps(user.getId(), request.startTime(),
                request.endTime(), null) > 0;
        if (userOverlap) {
            throw new ConflictException("You already have a reservation that overlaps this period.");
        }

        List<ParkingSlot> slots = slotRepository.findByFacilityId(facility.getId());
        AllocationService.Outcome outcome = allocationService.allocate(facility, slots,
                request.startTime(), request.endTime(), vehicle.getVehicleType(), accessibility,
                request.preferredSlotId(), request.preferredFloorId(), null);

        BigDecimal price = null;
        String explanation = null;
        try {
            var quote = pricingService.quote(facility, request.startTime(), request.endTime());
            price = quote.amount();
            explanation = quote.explanation();
        } catch (ConflictException ex) {
            explanation = ex.getMessage();
        }

        BookingDtos.AllocationPreview preview = null;
        if (outcome.slot() != null) {
            preview = new BookingDtos.AllocationPreview(outcome.slot().getId(), outcome.slot().getSlotCode(),
                    outcome.slot().getFloor().getName(), outcome.slot().getFloor().getFloorNumber(),
                    outcome.slot().getSlotType().name(), outcome.slot().isAccessible(),
                    outcome.slot().isHasEvCharger(), outcome.reason());
        }
        String message = outcome.slot() == null ? outcome.reason() : null;
        if (outcome.slot() != null && price == null) {
            message = "A slot is available, but pricing is not configured for this duration.";
        }

        return new BookingDtos.QuoteResponse(facility.getId(), facility.getName(), facility.getTimezone(),
                request.startTime(), request.endTime(), Duration.between(request.startTime(), request.endTime()).toMinutes(),
                price, explanation, preview,
                outcome.alternatives().stream().map(s -> new BookingDtos.AlternativeSlot(s.getId(), s.getSlotCode(),
                        s.getFloor().getName(), s.getFloor().getFloorNumber(), s.getSlotType().name())).toList(),
                outcome.suggestedStarts(), message);
    }

    @Transactional
    public BookingDtos.BookingView create(BookingDtos.CreateBookingRequest request) {
        User user = currentUser.entity();
        if (user.getRole() == com.smartpark.user.Role.ADMIN) {
            throw new ConflictException("Administrators manage system operations and cannot create parking slot reservations.");
        }
        Vehicle vehicle = vehicleRepository.findByIdAndUserId(request.vehicleId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Vehicle not found."));
        Facility facility = facilityRepository.findById(request.facilityId())
                .orElseThrow(() -> new NotFoundException("Parking facility not found."));
        if (facility.getStatus() != com.smartpark.facility.FacilityStatus.ACTIVE) {
            throw new ConflictException("This facility is not accepting reservations right now.");
        }
        policy.validateWindow(facility, request.startTime(), request.endTime());
        if (bookingRepository.countUserOverlaps(user.getId(), request.startTime(), request.endTime(), null) > 0) {
            throw new ConflictException("You already have a reservation that overlaps this period.");
        }
        var price = pricingService.quote(facility, request.startTime(), request.endTime());
        boolean accessibility = Boolean.TRUE.equals(request.accessibilityRequired())
                || user.isAccessibilityRequired();

        acquireFacilityLock(facility.getId());
        List<ParkingSlot> slots = slotRepository.findByFacilityId(facility.getId());
        AllocationService.Outcome outcome = allocationService.allocate(facility, slots,
                request.startTime(), request.endTime(), vehicle.getVehicleType(), accessibility,
                request.preferredSlotId(), request.preferredFloorId(), null);

        if (outcome.slot() == null) {
            String alternatives = outcome.alternatives().isEmpty() ? ""
                    : " Nearby available bays: " + outcome.alternatives().stream()
                    .map(ParkingSlot::getSlotCode).reduce((a, b) -> a + ", " + b).orElse("") + ".";
            String suggestions = outcome.suggestedStarts().isEmpty() ? ""
                    : " Try a start time around " + outcome.suggestedStarts().get(0) + ".";
            throw new ConflictException(outcome.reason() + alternatives + suggestions);
        }

        Booking booking = new Booking();
        booking.setBookingReference(nextReference());
        booking.setUser(user);
        booking.setVehicle(vehicle);
        booking.setSlot(outcome.slot());
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.endTime());
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPriceAmount(price.amount());
        booking.setCurrency(price.currency());
        booking.setAllocationReason(outcome.reason());

        try {
            bookingRepository.saveAndFlush(booking);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("That slot was just reserved by someone else. Please choose another slot "
                    + "or time.");
        }

        auditService.record(user, "BOOKING_CREATED", "BOOKING", booking.getId().toString(),
                Map.of("reference", booking.getBookingReference(), "facility", facility.getName(),
                        "slot", outcome.slot().getSlotCode(), "price", price.amount()));
        sendConfirmation(booking, facility);
        return mapper.toView(booking, true);
    }

    @Transactional(readOnly = true)
    public Page<Booking> listMine(BookingStatus status, Pageable pageable) {
        UUID userId = currentUser.id();
        return status == null
                ? bookingRepository.findByUserIdOrderByStartTimeDesc(userId, pageable)
                : bookingRepository.findByUserIdAndStatusOrderByStartTimeDesc(userId, status, pageable);
    }

    @Transactional(readOnly = true)
    public BookingDtos.BookingView getMine(UUID id, boolean includeToken) {
        Booking booking = bookingRepository.findDetailedById(id)
                .orElseThrow(() -> new NotFoundException("Booking not found."));
        boolean admin = "ADMIN".equals(currentUser.principal().role().name());
        if (!admin && !booking.getUser().getId().equals(currentUser.id())) {
            // Return 404 rather than 403 so booking IDs cannot be enumerated.
            throw new NotFoundException("Booking not found.");
        }
        return mapper.toView(booking, includeToken);
    }

    @Transactional
    public BookingDtos.BookingView reschedule(UUID id, BookingDtos.RescheduleRequest request) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Booking not found."));
        if (!booking.getUser().getId().equals(currentUser.id())) {
            throw new NotFoundException("Booking not found.");
        }
        if (booking.getStatus() != BookingStatus.PENDING && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ConflictException("This booking can no longer be modified.");
        }
        Facility facility = booking.getSlot().getFloor().getFacility();
        if (Instant.now().isAfter(policy.cancellationCutoff(facility, booking.getStartTime()))) {
            throw new ConflictException("Changes are locked " + facility.getCancellationCutoffMinutes()
                    + " minutes before the reservation starts.");
        }
        policy.validateWindow(facility, request.startTime(), request.endTime());
        if (bookingRepository.countUserOverlaps(currentUser.id(), request.startTime(), request.endTime(), id) > 0) {
            throw new ConflictException("Your other reservation overlaps the new time.");
        }
        var price = pricingService.quote(facility, request.startTime(), request.endTime());

        acquireFacilityLock(facility.getId());
        List<ParkingSlot> slots = slotRepository.findByFacilityId(facility.getId());
        UUID preferred = request.preferredSlotId() != null ? request.preferredSlotId() : booking.getSlot().getId();
        AllocationService.Outcome outcome = allocationService.allocate(facility, slots,
                request.startTime(), request.endTime(), booking.getVehicle().getVehicleType(),
                booking.getUser().isAccessibilityRequired(), preferred, request.preferredFloorId(), id);
        if (outcome.slot() == null) {
            throw new ConflictException(outcome.reason() + " Please choose another time or slot.");
        }

        Instant oldStart = booking.getStartTime();
        Instant oldEnd = booking.getEndTime();
        String oldSlot = booking.getSlot().getSlotCode();
        booking.setSlot(outcome.slot());
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.endTime());
        booking.setPriceAmount(price.amount());
        booking.setAllocationReason(outcome.reason());
        try {
            bookingRepository.saveAndFlush(booking);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("That slot was just reserved by someone else. Please choose another slot "
                    + "or time.");
        }
        auditService.record(currentUser.entity(), "BOOKING_RESCHEDULED", "BOOKING", booking.getId().toString(),
                Map.of("oldStart", oldStart.toString(), "oldEnd", oldEnd.toString(), "oldSlot", oldSlot,
                        "newStart", request.startTime().toString(), "newEnd", request.endTime().toString(),
                        "newSlot", outcome.slot().getSlotCode()));
        return mapper.toView(booking, true);
    }

    @Transactional
    public BookingDtos.BookingView cancel(UUID id, String reason) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Booking not found."));
        User user = currentUser.entity();
        boolean admin = "ADMIN".equals(user.getRole().name());
        if (!admin && !booking.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Booking not found.");
        }
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new ConflictException("This booking is already cancelled.");
        }
        if (booking.getStatus() != BookingStatus.PENDING && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ConflictException("Only pending or confirmed reservations can be cancelled.");
        }
        Facility facility = booking.getSlot().getFloor().getFacility();
        if (!admin && Instant.now().isAfter(policy.cancellationCutoff(facility, booking.getStartTime()))) {
            throw new ConflictException("Cancellation is locked " + facility.getCancellationCutoffMinutes()
                    + " minutes before the reservation starts.");
        }
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(Instant.now());
        booking.setCancelledBy(user);
        booking.setCancellationReason(reason == null || reason.isBlank() ? null : reason.trim());
        bookingRepository.save(booking);
        auditService.record(user, admin ? "BOOKING_CANCELLED_ADMIN" : "BOOKING_CANCELLED", "BOOKING",
                booking.getId().toString(), Map.of("reference", booking.getBookingReference(),
                        "reason", booking.getCancellationReason() == null ? "" : booking.getCancellationReason()));
        return mapper.toView(booking, false);
    }

    @Transactional
    public BookingDtos.BookingView checkIn(UUID id, String token) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Booking not found."));
        User user = currentUser.entity();
        boolean admin = "ADMIN".equals(user.getRole().name());
        if (!admin && !booking.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Booking not found.");
        }
        if (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.OVERSTAY) {
            throw new ConflictException("This booking is already checked in.");
        }
        if (booking.getStatus() == BookingStatus.NO_SHOW) {
            throw new ConflictException("This reservation was marked as a no-show because the check-in grace period expired.");
        }
        if (booking.getStatus() == BookingStatus.CONFLICT_REQUIRES_ADMIN) {
            throw new ConflictException("This booking has an unresolved bay conflict. Please consult the parking attendant.");
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ConflictException("Only confirmed bookings can be checked in.");
        }
        Instant now = Instant.now();
        Facility facility = booking.getSlot().getFloor().getFacility();
        if (now.isBefore(booking.getStartTime().minus(Duration.ofMinutes(30)))) {
            throw new ConflictException("Check-in opens 30 minutes before the reservation start.");
        }
        Instant graceLimit = booking.getStartTime().plus(Duration.ofMinutes(facility.getCheckInGracePeriodMinutes()));
        if (now.isAfter(graceLimit)) {
            // Auto mark as NO_SHOW if grace period has elapsed
            booking.setStatus(BookingStatus.NO_SHOW);
            booking.setNoShowDetectedAt(now);
            booking.setCancellationReason("Check-in grace period expired without driver arrival.");
            bookingRepository.save(booking);
            auditService.record(user, "BOOKING_NO_SHOW", "BOOKING", booking.getId().toString(),
                    Map.of("reference", booking.getBookingReference(), "reason", "Grace period expired at check-in"));
            throw new ConflictException("The check-in grace period (" + facility.getCheckInGracePeriodMinutes()
                    + " mins) has expired. Your reservation has been marked as a no-show and the bay released.");
        }

        String method = admin ? "ADMIN" : "MANUAL";
        if (token != null && !token.isBlank()) {
            try {
                Claims claims = jwtService.parseCheckInToken(token);
                UUID tokenBooking = UUID.fromString(claims.get("bookingId", String.class));
                UUID tokenUser = UUID.fromString(claims.getSubject());
                if (!tokenBooking.equals(booking.getId()) || !tokenUser.equals(booking.getUser().getId())) {
                    throw new BadRequestException("This check-in code does not match the booking.");
                }
                method = "QR";
            } catch (BadRequestException ex) {
                throw ex;
            } catch (Exception ex) {
                throw new BadRequestException("This check-in code is invalid or has expired.");
            }
        }

        CheckIn checkIn = new CheckIn();
        checkIn.setBooking(booking);
        checkIn.setCheckInTime(now);
        checkIn.setVerificationMethod(method);
        try {
            checkInRepository.saveAndFlush(checkIn);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("This booking has already been checked in.");
        }
        booking.setStatus(BookingStatus.ACTIVE);
        bookingRepository.save(booking);
        auditService.record(user, "BOOKING_CHECKED_IN", "BOOKING", booking.getId().toString(),
                Map.of("method", method));
        return mapper.toView(booking, false);
    }

    @Transactional
    public BookingDtos.BookingView checkOut(UUID id) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Booking not found."));
        User user = currentUser.entity();
        boolean admin = "ADMIN".equals(user.getRole().name());
        if (!admin && !booking.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Booking not found.");
        }
        if (booking.getStatus() == BookingStatus.COMPLETED) {
            CheckIn checkIn = checkInRepository.findByBookingId(booking.getId()).orElse(null);
            if (checkIn != null && checkIn.getCheckOutTime() != null) {
                return mapper.toView(booking, false);
            }
        }
        if (booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERSTAY) {
            throw new ConflictException("Only an active or overstaying parking session can be checked out.");
        }
        CheckIn checkIn = checkInRepository.findByBookingId(booking.getId())
                .orElseThrow(() -> new ConflictException("No check-in exists for this booking."));
        if (checkIn.getCheckOutTime() != null) {
            return mapper.toView(booking, false);
        }
        Instant now = Instant.now();
        checkIn.setCheckOutTime(now);
        checkInRepository.save(checkIn);

        Facility facility = booking.getSlot().getFloor().getFacility();
        BigDecimal overstayFee = BigDecimal.ZERO;
        long overstayMinutes = 0;
        if (now.isAfter(booking.getEndTime())) {
            var overstayQuote = pricingService.quoteOverstay(facility, booking.getEndTime(), now);
            overstayFee = overstayQuote.amount();
            overstayMinutes = overstayQuote.overstayMinutes();
            booking.setOverstayCharge(overstayFee);
            booking.setOverstayDurationMinutes(overstayMinutes);
            if (booking.getOverstayStartTime() == null) {
                booking.setOverstayStartTime(booking.getEndTime());
            }
        }

        booking.setStatus(BookingStatus.COMPLETED);
        bookingRepository.save(booking);
        auditService.record(user, "BOOKING_CHECKED_OUT", "BOOKING", booking.getId().toString(),
                Map.of("overstayMinutes", overstayMinutes, "overstayCharge", overstayFee,
                        "totalAmount", booking.getPriceAmount().add(overstayFee)));
        return mapper.toView(booking, false);
    }

    @Transactional
    public int processNoShows() {
        Instant now = Instant.now();
        List<Booking> candidates = bookingRepository.findPotentialNoShows(now);
        int count = 0;
        for (Booking booking : candidates) {
            Facility facility = booking.getSlot().getFloor().getFacility();
            Instant graceDeadline = booking.getStartTime().plus(Duration.ofMinutes(facility.getCheckInGracePeriodMinutes()));
            if (now.isAfter(graceDeadline) && booking.getStatus() == BookingStatus.CONFIRMED) {
                if (checkInRepository.findByBookingId(booking.getId()).isEmpty()) {
                    booking.setStatus(BookingStatus.NO_SHOW);
                    booking.setNoShowDetectedAt(now);
                    booking.setCancellationReason("Customer did not arrive within the "
                            + facility.getCheckInGracePeriodMinutes() + "-minute check-in grace period.");
                    bookingRepository.save(booking);
                    auditService.record(booking.getUser(), "BOOKING_NO_SHOW", "BOOKING", booking.getId().toString(),
                            Map.of("reference", booking.getBookingReference(),
                                    "facility", facility.getName(),
                                    "slot", booking.getSlot().getSlotCode(),
                                    "gracePeriodMinutes", facility.getCheckInGracePeriodMinutes()));
                    mailService.send(booking.getUser().getEmail(),
                            "SmartPark Reservation Marked as No-Show (" + booking.getBookingReference() + ")",
                            "Your SmartPark reservation " + booking.getBookingReference() + " at " + facility.getName()
                                    + " was marked as a no-show because check-in was not registered within the "
                                    + facility.getCheckInGracePeriodMinutes() + "-minute grace period. Your slot ("
                                    + booking.getSlot().getSlotCode() + ") has been released.");
                    count++;
                }
            }
        }
        return count;
    }

    @Transactional
    public int processOverstays() {
        Instant now = Instant.now();
        List<Booking> candidates = bookingRepository.findDueForOverstay(now);
        int count = 0;
        for (Booking booking : candidates) {
            if (booking.getStatus() == BookingStatus.ACTIVE) {
                var checkIn = checkInRepository.findByBookingId(booking.getId());
                if (checkIn.isPresent() && checkIn.get().getCheckOutTime() == null) {
                    Facility facility = booking.getSlot().getFloor().getFacility();
                    booking.setStatus(BookingStatus.OVERSTAY);
                    if (booking.getOverstayStartTime() == null) {
                        booking.setOverstayStartTime(booking.getEndTime());
                    }
                    long minutes = Duration.between(booking.getEndTime(), now).toMinutes();
                    booking.setOverstayDurationMinutes(minutes);
                    bookingRepository.save(booking);

                    auditService.record(booking.getUser(), "BOOKING_OVERSTAY_DETECTED", "BOOKING", booking.getId().toString(),
                            Map.of("reference", booking.getBookingReference(),
                                    "facility", facility.getName(),
                                    "slot", booking.getSlot().getSlotCode(),
                                    "overstayMinutes", minutes));

                    mailService.send(booking.getUser().getEmail(),
                            "Parking Duration Expired - Overstay Alert (" + booking.getBookingReference() + ")",
                            "Your reserved parking duration for booking " + booking.getBookingReference() + " at "
                                    + facility.getName() + " (Slot " + booking.getSlot().getSlotCode()
                                    + ") has expired. Your vehicle is still occupying the bay. Additional overstay charges "
                                    + "are accumulating at " + facility.getOverstayMultiplier() + "x rate. Please return to your vehicle and check out.");

                    handleOverstaySlotConflict(booking, now);
                    count++;
                }
            }
        }
        return count;
    }

    private void handleOverstaySlotConflict(Booking overstaying, Instant now) {
        ParkingSlot blockedSlot = overstaying.getSlot();
        Facility facility = blockedSlot.getFloor().getFacility();
        List<Booking> upcomings = bookingRepository.findUpcomingOnSlot(
                blockedSlot.getId(), now.minus(Duration.ofMinutes(15)), now.plus(Duration.ofHours(4)));

        for (Booking upcoming : upcomings) {
            if (upcoming.getStatus() == BookingStatus.CONFIRMED) {
                List<ParkingSlot> facilitySlots = slotRepository.findByFacilityId(facility.getId());
                AllocationService.Outcome outcome = allocationService.allocate(
                        facility, facilitySlots, upcoming.getStartTime(), upcoming.getEndTime(),
                        upcoming.getVehicle().getVehicleType(), upcoming.getUser().isAccessibilityRequired(),
                        null, null, upcoming.getId());

                if (outcome.slot() != null && !outcome.slot().getId().equals(blockedSlot.getId())) {
                    ParkingSlot oldSlot = upcoming.getSlot();
                    upcoming.setSlot(outcome.slot());
                    upcoming.setReassignedFromSlot(oldSlot);
                    upcoming.setReassignedAt(now);
                    upcoming.setAllocationReason("Automatically reassigned from " + oldSlot.getSlotCode()
                            + " due to overstay by previous vehicle (" + overstaying.getVehicle().getRegistrationNumber()
                            + "). " + outcome.reason());
                    bookingRepository.save(upcoming);

                    auditService.record(upcoming.getUser(), "BOOKING_REASSIGNED_OVERSTAY", "BOOKING", upcoming.getId().toString(),
                            Map.of("reference", upcoming.getBookingReference(),
                                    "oldSlot", oldSlot.getSlotCode(),
                                    "newSlot", outcome.slot().getSlotCode(),
                                    "overstayReference", overstaying.getBookingReference()));

                    mailService.send(upcoming.getUser().getEmail(),
                            "Parking Bay Reassigned - SmartPark (" + upcoming.getBookingReference() + ")",
                            "Your upcoming reservation " + upcoming.getBookingReference() + " at " + facility.getName()
                                    + " has been automatically reassigned to Bay " + outcome.slot().getSlotCode()
                                    + " on " + outcome.slot().getFloor().getName()
                                    + " because the previous vehicle in your originally assigned bay (" + oldSlot.getSlotCode()
                                    + ") has overstayed. Your reservation window remains unchanged.");
                } else {
                    upcoming.setStatus(BookingStatus.CONFLICT_REQUIRES_ADMIN);
                    upcoming.setConflictReason("Slot " + blockedSlot.getSlotCode()
                            + " is physically blocked by an overstaying vehicle ("
                            + overstaying.getVehicle().getRegistrationNumber()
                            + "). No compatible alternate slot was automatically available.");
                    bookingRepository.save(upcoming);

                    auditService.record(upcoming.getUser(), "BOOKING_CONFLICT_FLAGGED", "BOOKING", upcoming.getId().toString(),
                            Map.of("reference", upcoming.getBookingReference(),
                                    "blockedSlot", blockedSlot.getSlotCode(),
                                    "overstayReference", overstaying.getBookingReference()));

                    mailService.send(upcoming.getUser().getEmail(),
                            "Parking Bay Assignment Alert - SmartPark (" + upcoming.getBookingReference() + ")",
                            "Your upcoming reservation " + upcoming.getBookingReference() + " at " + facility.getName()
                                    + " requires manual slot assignment because the previous vehicle in bay "
                                    + blockedSlot.getSlotCode() + " has not yet departed. Facility staff has been notified and is arranging an alternate bay for you.");
                }
            }
        }
    }

    @Transactional
    public BookingDtos.BookingView resolveConflict(UUID bookingId, UUID newSlotId, String resolutionNotes) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found."));
        User admin = currentUser.entity();
        if (admin.getRole() != com.smartpark.user.Role.ADMIN) {
            throw new com.smartpark.common.ForbiddenException("Only administrators can resolve slot conflicts.");
        }
        if (booking.getStatus() != BookingStatus.CONFLICT_REQUIRES_ADMIN) {
            throw new ConflictException("This booking is not in a conflict state.");
        }
        Facility facility = booking.getSlot().getFloor().getFacility();
        Instant now = Instant.now();

        if (newSlotId != null) {
            ParkingSlot newSlot = slotRepository.findById(newSlotId)
                    .orElseThrow(() -> new NotFoundException("Selected slot not found."));
            if (!newSlot.getFloor().getFacility().getId().equals(facility.getId())) {
                throw new ConflictException("Selected slot must be in the same facility.");
            }
            if (newSlot.getStatus() != com.smartpark.facility.SlotStatus.AVAILABLE) {
                throw new ConflictException("Selected slot is not available for service.");
            }
            ParkingSlot oldSlot = booking.getSlot();
            booking.setSlot(newSlot);
            booking.setReassignedFromSlot(oldSlot);
            booking.setReassignedAt(now);
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setConflictReason(null);
            booking.setResolvedBy(admin);
            booking.setResolvedAt(now);
            booking.setAllocationReason("Conflict resolved by administrator: assigned to " + newSlot.getSlotCode()
                    + (resolutionNotes != null && !resolutionNotes.isBlank() ? ". " + resolutionNotes : ""));
            bookingRepository.save(booking);

            auditService.record(admin, "BOOKING_CONFLICT_RESOLVED", "BOOKING", booking.getId().toString(),
                    Map.of("reference", booking.getBookingReference(),
                            "oldSlot", oldSlot.getSlotCode(),
                            "newSlot", newSlot.getSlotCode(),
                            "notes", resolutionNotes != null ? resolutionNotes : ""));

            mailService.send(booking.getUser().getEmail(),
                    "Parking Bay Assigned - SmartPark (" + booking.getBookingReference() + ")",
                    "Your reservation " + booking.getBookingReference() + " at " + facility.getName()
                            + " has been resolved by facility operations. You are assigned to Bay "
                            + newSlot.getSlotCode() + " on " + newSlot.getFloor().getName() + ".");
        } else {
            boolean occupied = bookingRepository.findPhysicallyOccupiedSlotIds(facility.getId()).contains(booking.getSlot().getId());
            if (occupied) {
                throw new ConflictException("Original bay " + booking.getSlot().getSlotCode()
                        + " is still occupied. Please choose an alternate slot to reassign.");
            }
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setConflictReason(null);
            booking.setResolvedBy(admin);
            booking.setResolvedAt(now);
            bookingRepository.save(booking);

            auditService.record(admin, "BOOKING_CONFLICT_RESOLVED", "BOOKING", booking.getId().toString(),
                    Map.of("reference", booking.getBookingReference(),
                            "slot", booking.getSlot().getSlotCode(),
                            "notes", resolutionNotes != null ? resolutionNotes : "Original bay confirmed vacated"));
        }

        return mapper.toView(booking, true);
    }

    @Transactional(readOnly = true)
    public AdminDtos.OverstayDashboardView getOverstayDashboard() {
        long noShowCount = bookingRepository.countByStatus(BookingStatus.NO_SHOW);
        long activeOverstayCount = bookingRepository.countByStatus(BookingStatus.OVERSTAY);
        long unresolvedConflictCount = bookingRepository.countByStatus(BookingStatus.CONFLICT_REQUIRES_ADMIN);

        List<BookingDtos.BookingView> activeOverstays = mapper.toViews(bookingRepository.findActiveOverstays());
        List<BookingDtos.BookingView> unresolvedConflicts = mapper.toViews(bookingRepository.findUnresolvedConflicts());
        List<BookingDtos.BookingView> recentNoShows = mapper.toViews(
                bookingRepository.findRecentNoShows(org.springframework.data.domain.PageRequest.of(0, 20)).getContent());

        return new AdminDtos.OverstayDashboardView(
                noShowCount, activeOverstayCount, unresolvedConflictCount,
                activeOverstays, unresolvedConflicts, recentNoShows);
    }

    @Transactional(readOnly = true)
    public BookingDtos.BookingStats stats() {
        UUID userId = currentUser.id();
        long total = bookingRepository.countByUserId(userId);
        long upcoming = bookingRepository.findUpcoming(userId, Instant.now()).size();
        long active = bookingRepository.countByUserIdAndStatus(userId, BookingStatus.ACTIVE);
        long completed = bookingRepository.countByUserIdAndStatus(userId, BookingStatus.COMPLETED);
        long cancelled = bookingRepository.countByUserIdAndStatus(userId, BookingStatus.CANCELLED);
        long overstays = bookingRepository.countByUserIdAndStatus(userId, BookingStatus.OVERSTAY);
        long noShows = bookingRepository.countByUserIdAndStatus(userId, BookingStatus.NO_SHOW);
        return new BookingDtos.BookingStats(total, upcoming, active, completed, cancelled, overstays, noShows,
                bookingRepository.sumUserSpend(userId),
                bookingRepository.frequentFacilities(userId).stream()
                        .map(row -> new BookingDtos.FacilityUsage((String) row[0], ((Number) row[1]).longValue()))
                        .toList());
    }

    private void acquireFacilityLock(UUID facilityId) {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))")
                .setParameter("key", facilityId.toString())
                .getSingleResult();
    }

    private String nextReference() {
        for (int attempt = 0; attempt < 8; attempt++) {
            StringBuilder sb = new StringBuilder("SP-");
            for (int i = 0; i < 8; i++) {
                sb.append(REFERENCE_ALPHABET.charAt(RANDOM.nextInt(REFERENCE_ALPHABET.length())));
            }
            String reference = sb.toString();
            if (!bookingRepository.existsByBookingReference(reference)) {
                return reference;
            }
        }
        throw new ConflictException("Could not generate a booking reference. Please retry.");
    }

    private void sendConfirmation(Booking booking, Facility facility) {
        try {
            var zone = ZoneId.of(facility.getTimezone());
            var formatter = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm", Locale.ENGLISH);
            mailService.send(booking.getUser().getEmail(), "SmartPark reservation " + booking.getBookingReference(),
                    "Your SmartPark reservation is confirmed.\n\n"
                            + "Reference: " + booking.getBookingReference() + "\n"
                            + "Facility: " + facility.getName() + "\n"
                            + "Slot: " + booking.getSlot().getSlotCode() + " · " + booking.getSlot().getFloor().getName() + "\n"
                            + "From: " + formatter.format(booking.getStartTime().atZone(zone)) + "\n"
                            + "To: " + formatter.format(booking.getEndTime().atZone(zone)) + "\n"
                            + "Total: " + booking.getCurrency() + " " + booking.getPriceAmount() + "\n\n"
                            + "Show your booking QR code at the entry terminal.");
        } catch (Exception ignored) {
            // Confirmation email must never fail the reservation transaction.
        }
    }
}
