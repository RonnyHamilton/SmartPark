package com.smartpark.booking;

import com.smartpark.audit.AuditService;
import com.smartpark.common.ConflictException;
import com.smartpark.common.MailService;
import com.smartpark.facility.Facility;
import com.smartpark.facility.FacilityPolicy;
import com.smartpark.facility.FacilityRepository;
import com.smartpark.facility.ParkingFloor;
import com.smartpark.facility.ParkingSlot;
import com.smartpark.facility.ParkingSlotRepository;
import com.smartpark.facility.SlotStatus;
import com.smartpark.facility.SlotType;
import com.smartpark.pricing.PricingRule;
import com.smartpark.pricing.PricingRuleRepository;
import com.smartpark.pricing.PricingService;
import com.smartpark.pricing.RateType;
import com.smartpark.security.CurrentUser;
import com.smartpark.security.JwtService;
import com.smartpark.security.UserPrincipal;
import com.smartpark.user.Role;
import com.smartpark.user.User;
import com.smartpark.vehicle.Vehicle;
import com.smartpark.vehicle.VehicleRepository;
import com.smartpark.vehicle.VehicleType;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoShowAndOverstayTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private CheckInRepository checkInRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private ParkingSlotRepository slotRepository;
    @Mock private VehicleRepository vehicleRepository;
    @Mock private AllocationService allocationService;
    @Mock private PricingRuleRepository pricingRuleRepository;
    @Mock private FacilityPolicy policy;
    @Mock private CurrentUser currentUser;
    @Mock private AuditService auditService;
    @Mock private MailService mailService;
    @Mock private JwtService jwtService;
    @Mock private EntityManager entityManager;

    private PricingService pricingService;
    private BookingMapper mapper;
    private BookingService bookingService;

    private User driver;
    private User admin;
    private Facility facility;
    private ParkingFloor floor;
    private ParkingSlot slotA;
    private ParkingSlot slotB;
    private Vehicle vehicle;

    @BeforeEach
    void setUp() {
        pricingService = new PricingService(pricingRuleRepository);
        mapper = new BookingMapper(checkInRepository, jwtService, policy);
        bookingService = new BookingService(
                bookingRepository, checkInRepository, facilityRepository, slotRepository,
                vehicleRepository, allocationService, pricingService, policy, mapper,
                currentUser, auditService, mailService, jwtService, entityManager);

        driver = new User();
        driver.setId(UUID.randomUUID());
        driver.setName("Rahul Sharma");
        driver.setEmail("rahul@smartpark.local");
        driver.setRole(Role.USER);

        admin = new User();
        admin.setId(UUID.randomUUID());
        admin.setName("Admin Ops");
        admin.setEmail("admin@smartpark.local");
        admin.setRole(Role.ADMIN);

        facility = new Facility();
        facility.setId(UUID.randomUUID());
        facility.setName("Central Mall Garage");
        facility.setTimezone("Asia/Kolkata");
        facility.setBufferMinutes(15);
        facility.setCheckInGracePeriodMinutes(15);
        facility.setOverstayMultiplier(new BigDecimal("1.50"));

        floor = new ParkingFloor();
        floor.setId(UUID.randomUUID());
        floor.setName("Level 1");
        floor.setFloorNumber(1);
        floor.setFacility(facility);

        slotA = new ParkingSlot();
        slotA.setId(UUID.randomUUID());
        slotA.setSlotCode("L1-01");
        slotA.setSlotType(SlotType.STANDARD);
        slotA.setFloor(floor);
        slotA.setStatus(SlotStatus.AVAILABLE);
        slotA.setSupportedVehicleTypes(List.of("CAR", "SUV"));

        slotB = new ParkingSlot();
        slotB.setId(UUID.randomUUID());
        slotB.setSlotCode("L1-02");
        slotB.setSlotType(SlotType.STANDARD);
        slotB.setFloor(floor);
        slotB.setStatus(SlotStatus.AVAILABLE);
        slotB.setSupportedVehicleTypes(List.of("CAR", "SUV"));

        vehicle = new Vehicle();
        vehicle.setId(UUID.randomUUID());
        vehicle.setUser(driver);
        vehicle.setRegistrationNumber("MH12AB1234");
        vehicle.setVehicleType(VehicleType.CAR);
    }

    @Test
    @DisplayName("Scenario 1: Customer checks in within grace period successfully")
    void customerChecksInWithinGracePeriod_Succeeds() {
        Instant start = Instant.now().minus(Duration.ofMinutes(10));
        Instant end = start.plus(Duration.ofHours(2));

        Booking booking = createBooking(slotA, start, end, BookingStatus.CONFIRMED);
        when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(currentUser.entity()).thenReturn(driver);

        BookingDtos.BookingView view = bookingService.checkIn(booking.getId(), null);

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
        verify(checkInRepository).saveAndFlush(any(CheckIn.class));
        verify(bookingRepository).save(booking);
        verify(auditService).record(eq(driver), eq("BOOKING_CHECKED_IN"), eq("BOOKING"), eq(booking.getId().toString()), any());
    }

    @Test
    @DisplayName("Scenario 2: Customer fails to check in within grace period and becomes NO_SHOW, releasing slot")
    void customerFailsToCheckIn_BecomesNoShow_AndReleasesSlot() {
        Instant start = Instant.now().minus(Duration.ofMinutes(25)); // 25 mins ago > 15 mins grace
        Instant end = start.plus(Duration.ofHours(2));

        Booking booking = createBooking(slotA, start, end, BookingStatus.CONFIRMED);
        when(bookingRepository.findPotentialNoShows(any(Instant.class))).thenReturn(List.of(booking));
        when(checkInRepository.findByBookingId(booking.getId())).thenReturn(Optional.empty());

        int noShows = bookingService.processNoShows();

        assertThat(noShows).isEqualTo(1);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.NO_SHOW);
        assertThat(booking.getNoShowDetectedAt()).isNotNull();
        // Crucial: NO_SHOW status does NOT hold the slot
        assertThat(booking.getStatus().holdsSlot()).isFalse();
        verify(bookingRepository).save(booking);
        verify(auditService).record(eq(driver), eq("BOOKING_NO_SHOW"), eq("BOOKING"), eq(booking.getId().toString()), any());
        verify(mailService).send(eq(driver.getEmail()), anyString(), anyString());
    }

    @Test
    @DisplayName("Scenario 3: A checked-in customer cannot be marked as a no-show (race condition safety)")
    void checkedInCustomer_CannotBeMarkedAsNoShow() {
        Instant start = Instant.now().minus(Duration.ofMinutes(25));
        Instant end = start.plus(Duration.ofHours(2));

        Booking booking = createBooking(slotA, start, end, BookingStatus.ACTIVE);
        // Even if eligible by start time, checkIn already exists
        CheckIn checkIn = new CheckIn();
        checkIn.setBooking(booking);
        checkIn.setCheckInTime(start.plus(Duration.ofMinutes(5)));

        when(bookingRepository.findPotentialNoShows(any(Instant.class))).thenReturn(List.of(booking));

        int noShows = bookingService.processNoShows();

        assertThat(noShows).isEqualTo(0);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
        verify(bookingRepository, never()).save(booking);
    }

    @Test
    @DisplayName("Scenario 4: Active booking reaches end time without checkout and transitions to OVERSTAY")
    void activeBooking_ReachesEndTimeWithoutCheckout_BecomesOverstay() {
        Instant start = Instant.now().minus(Duration.ofHours(3));
        Instant end = Instant.now().minus(Duration.ofMinutes(30)); // 30 mins overstay

        Booking booking = createBooking(slotA, start, end, BookingStatus.ACTIVE);
        CheckIn checkIn = new CheckIn();
        checkIn.setBooking(booking);
        checkIn.setCheckInTime(start);
        checkIn.setCheckOutTime(null); // Not checked out!

        when(bookingRepository.findDueForOverstay(any(Instant.class))).thenReturn(List.of(booking));
        when(checkInRepository.findByBookingId(booking.getId())).thenReturn(Optional.of(checkIn));
        when(bookingRepository.findUpcomingOnSlot(eq(slotA.getId()), any(), any())).thenReturn(List.of());

        int overstays = bookingService.processOverstays();

        assertThat(overstays).isEqualTo(1);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.OVERSTAY);
        assertThat(booking.getOverstayStartTime()).isEqualTo(end);
        assertThat(booking.getOverstayDurationMinutes()).isGreaterThanOrEqualTo(29);
        // Crucial business rule: Overstay holds slot and physical occupancy is true
        assertThat(booking.getStatus().holdsSlot()).isTrue();
        assertThat(booking.getStatus().isPhysicalOccupancy()).isTrue();

        verify(bookingRepository).save(booking);
        verify(auditService).record(eq(driver), eq("BOOKING_OVERSTAY_DETECTED"), eq("BOOKING"), eq(booking.getId().toString()), any());
        verify(mailService).send(eq(driver.getEmail()), anyString(), anyString());
    }

    @Test
    @DisplayName("Scenario 5: Automatic alternate slot allocation reassigns Customer B when Customer A overstays")
    void upcomingReservation_ReassignedToAlternateSlot_WhenOverstayOccurs() {
        Instant now = Instant.now();
        Instant overstayStart = now.minus(Duration.ofHours(2));
        Instant overstayEnd = now.minus(Duration.ofMinutes(10));

        // Customer A is overstaying in slot A
        Booking customerA = createBooking(slotA, overstayStart, overstayEnd, BookingStatus.ACTIVE);
        CheckIn checkInA = new CheckIn();
        checkInA.setBooking(customerA);
        checkInA.setCheckInTime(overstayStart);

        // Customer B has upcoming confirmed booking on slot A
        User driverB = new User();
        driverB.setId(UUID.randomUUID());
        driverB.setName("Customer B");
        driverB.setEmail("customerB@smartpark.local");
        Booking customerB = createBooking(slotA, overstayEnd, overstayEnd.plus(Duration.ofHours(2)), BookingStatus.CONFIRMED);
        customerB.setUser(driverB);

        when(bookingRepository.findDueForOverstay(any(Instant.class))).thenReturn(List.of(customerA));
        when(checkInRepository.findByBookingId(customerA.getId())).thenReturn(Optional.of(checkInA));
        when(bookingRepository.findUpcomingOnSlot(eq(slotA.getId()), any(), any())).thenReturn(List.of(customerB));
        when(slotRepository.findByFacilityId(facility.getId())).thenReturn(List.of(slotA, slotB));

        // Allocation engine finds slot B as compatible alternate
        when(allocationService.allocate(any(), any(), any(), any(), any(), eq(false), isNull(), isNull(), eq(customerB.getId())))
                .thenReturn(new AllocationService.Outcome(slotB, "Alternate bay L1-02 available", List.of(), List.of()));

        bookingService.processOverstays();

        // Customer B reassigned to slot B
        assertThat(customerB.getSlot()).isEqualTo(slotB);
        assertThat(customerB.getReassignedFromSlot()).isEqualTo(slotA);
        assertThat(customerB.getReassignedAt()).isNotNull();
        assertThat(customerB.getStatus()).isEqualTo(BookingStatus.CONFIRMED);

        verify(bookingRepository).save(customerB);
        verify(auditService).record(eq(driverB), eq("BOOKING_REASSIGNED_OVERSTAY"), eq("BOOKING"), eq(customerB.getId().toString()), any());
        verify(mailService).send(eq(driverB.getEmail()), anyString(), anyString());
    }

    @Test
    @DisplayName("Scenario 6: When no alternate slot exists, upcoming reservation is flagged CONFLICT_REQUIRES_ADMIN without cancellation")
    void upcomingReservation_FlaggedConflictRequiresAdmin_WhenNoAlternateSlotAvailable() {
        Instant now = Instant.now();
        Instant overstayStart = now.minus(Duration.ofHours(2));
        Instant overstayEnd = now.minus(Duration.ofMinutes(10));

        Booking customerA = createBooking(slotA, overstayStart, overstayEnd, BookingStatus.ACTIVE);
        CheckIn checkInA = new CheckIn();
        checkInA.setBooking(customerA);
        checkInA.setCheckInTime(overstayStart);

        User driverB = new User();
        driverB.setId(UUID.randomUUID());
        driverB.setEmail("customerB@smartpark.local");
        Booking customerB = createBooking(slotA, overstayEnd, overstayEnd.plus(Duration.ofHours(2)), BookingStatus.CONFIRMED);
        customerB.setUser(driverB);

        when(bookingRepository.findDueForOverstay(any(Instant.class))).thenReturn(List.of(customerA));
        when(checkInRepository.findByBookingId(customerA.getId())).thenReturn(Optional.of(checkInA));
        when(bookingRepository.findUpcomingOnSlot(eq(slotA.getId()), any(), any())).thenReturn(List.of(customerB));
        when(slotRepository.findByFacilityId(facility.getId())).thenReturn(List.of(slotA));

        // No alternate bay is available
        when(allocationService.allocate(any(), any(), any(), any(), any(), eq(false), isNull(), isNull(), eq(customerB.getId())))
                .thenReturn(new AllocationService.Outcome(null, "No compatible slot free", List.of(), List.of()));

        bookingService.processOverstays();

        // Must NOT cancel reservation; must flag for admin intervention
        assertThat(customerB.getStatus()).isEqualTo(BookingStatus.CONFLICT_REQUIRES_ADMIN);
        assertThat(customerB.getConflictReason()).contains("is physically blocked by an overstaying vehicle");
        verify(bookingRepository).save(customerB);
        verify(auditService).record(eq(driverB), eq("BOOKING_CONFLICT_FLAGGED"), eq("BOOKING"), eq(customerB.getId().toString()), any());
    }

    @Test
    @DisplayName("Scenario 7: Administrator manually resolves conflict by assigning another slot")
    void adminManuallyResolvesConflict_Succeeds() {
        Instant now = Instant.now();
        Booking booking = createBooking(slotA, now, now.plus(Duration.ofHours(2)), BookingStatus.CONFLICT_REQUIRES_ADMIN);
        booking.setConflictReason("Blocked by overstay");

        when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(currentUser.entity()).thenReturn(admin);
        when(slotRepository.findById(slotB.getId())).thenReturn(Optional.of(slotB));

        BookingDtos.BookingView view = bookingService.resolveConflict(booking.getId(), slotB.getId(), "Assigned alternate bay manually");

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(booking.getSlot()).isEqualTo(slotB);
        assertThat(booking.getConflictReason()).isNull();
        assertThat(booking.getResolvedBy()).isEqualTo(admin);
        assertThat(booking.getResolvedAt()).isNotNull();

        verify(bookingRepository).save(booking);
        verify(auditService).record(eq(admin), eq("BOOKING_CONFLICT_RESOLVED"), eq("BOOKING"), eq(booking.getId().toString()), any());
    }

    @Test
    @DisplayName("Scenario 8: Customer checks out after overstaying, calculates overstay charge accurately and idempotently")
    void customerChecksOutAfterOverstay_CalculatesOverstayChargeCorrectly() {
        Instant start = Instant.now().minus(Duration.ofHours(3));
        Instant end = Instant.now().minus(Duration.ofMinutes(90)); // 90 min overstay -> 2 billable hours

        Booking booking = createBooking(slotA, start, end, BookingStatus.OVERSTAY);
        booking.setPriceAmount(new BigDecimal("100.00")); // Original booking fee

        CheckIn checkIn = new CheckIn();
        checkIn.setBooking(booking);
        checkIn.setCheckInTime(start);
        checkIn.setCheckOutTime(null);

        PricingRule hourlyRule = new PricingRule();
        hourlyRule.setId(UUID.randomUUID());
        hourlyRule.setFacility(facility);
        hourlyRule.setRateType(RateType.HOURLY);
        hourlyRule.setAmount(new BigDecimal("50.00")); // Base hourly ₹50
        hourlyRule.setActive(true);

        when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(currentUser.entity()).thenReturn(driver);
        when(checkInRepository.findByBookingId(booking.getId())).thenReturn(Optional.of(checkIn));
        when(pricingRuleRepository.findActiveForDate(eq(facility.getId()), any())).thenReturn(List.of(hourlyRule));

        BookingDtos.BookingView view = bookingService.checkOut(booking.getId());

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.COMPLETED);
        assertThat(checkIn.getCheckOutTime()).isNotNull();
        // 90 mins overstay -> 2 hours × ₹50 × 1.50 multiplier = ₹150.00
        assertThat(booking.getOverstayCharge()).isEqualByComparingTo("150.00");
        assertThat(booking.getOverstayDurationMinutes()).isGreaterThanOrEqualTo(89);

        // Retrying checkout must be idempotent and not charge again
        BookingDtos.BookingView retryView = bookingService.checkOut(booking.getId());
        assertThat(booking.getOverstayCharge()).isEqualByComparingTo("150.00");
    }

    private Booking createBooking(ParkingSlot slot, Instant start, Instant end, BookingStatus status) {
        Booking booking = new Booking();
        booking.setId(UUID.randomUUID());
        booking.setBookingReference("SP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        booking.setUser(driver);
        booking.setVehicle(vehicle);
        booking.setSlot(slot);
        booking.setStartTime(start);
        booking.setEndTime(end);
        booking.setStatus(status);
        booking.setPriceAmount(new BigDecimal("100.00"));
        booking.setCurrency("INR");
        return booking;
    }
}
