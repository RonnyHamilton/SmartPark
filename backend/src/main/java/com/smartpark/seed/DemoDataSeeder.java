package com.smartpark.seed;

import com.smartpark.booking.Booking;
import com.smartpark.booking.BookingRepository;
import com.smartpark.booking.BookingStatus;
import com.smartpark.booking.CheckIn;
import com.smartpark.booking.CheckInRepository;
import com.smartpark.facility.Facility;
import com.smartpark.facility.FacilityRepository;
import com.smartpark.facility.ParkingSlot;
import com.smartpark.facility.ParkingSlotRepository;
import com.smartpark.user.AccountStatus;
import com.smartpark.user.Role;
import com.smartpark.user.User;
import com.smartpark.user.UserRepository;
import com.smartpark.vehicle.Vehicle;
import com.smartpark.vehicle.VehicleRepository;
import com.smartpark.vehicle.VehicleType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Development-only demo data. Passwords are predictable on purpose for local
 * testing and MUST NOT be used in production (app.demo-data=false there).
 */
@Component
@ConditionalOnProperty(name = "app.demo-data", havingValue = "true")
public class DemoDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final UserRepository userRepository;
    private final VehicleRepository vehicleRepository;
    private final FacilityRepository facilityRepository;
    private final ParkingSlotRepository slotRepository;
    private final BookingRepository bookingRepository;
    private final CheckInRepository checkInRepository;
    private final PasswordEncoder passwordEncoder;

    public DemoDataSeeder(UserRepository userRepository, VehicleRepository vehicleRepository,
                          FacilityRepository facilityRepository, ParkingSlotRepository slotRepository,
                          BookingRepository bookingRepository, CheckInRepository checkInRepository,
                          PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.vehicleRepository = vehicleRepository;
        this.facilityRepository = facilityRepository;
        this.slotRepository = slotRepository;
        this.bookingRepository = bookingRepository;
        this.checkInRepository = checkInRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Demo data already present; skipping seeder.");
            return;
        }

        User admin = userRepository.save(user("Aarav Mehta", "admin@smartpark.local",
                "Admin@12345!", Role.ADMIN));
        User demo = userRepository.save(user("Maya Kapoor", "demo@smartpark.local",
                "Demo@12345!", Role.USER));
        User second = userRepository.save(user("Rohan Iyer", "rohan@smartpark.local",
                "Demo@12345!", Role.USER));

        Vehicle demoCar = vehicleRepository.save(vehicle(demo, "MH 12 AB 3456", VehicleType.CAR, true));
        vehicleRepository.save(vehicle(demo, "MH 12 EV 7788", VehicleType.EV, false));
        Vehicle secondCar = vehicleRepository.save(vehicle(second, "MH 14 XY 9012", VehicleType.SUV, true));
        vehicleRepository.save(vehicle(admin, "MH 01 AD 0001", VehicleType.CAR, true));

        List<Facility> facilities = facilityRepository.findAll();
        if (facilities.size() < 4) {
            log.warn("Catalogue seed data missing; demo bookings were not created.");
            return;
        }
        Facility phoenix = facility("11111111-1111-4111-8111-111111111111", facilities);
        Facility plaza = facility("22222222-2222-4222-8222-222222222222", facilities);
        Facility tech = facility("33333333-3333-4333-8333-333333333333", facilities);
        Facility airport = facility("44444444-4444-4444-8444-444444444444", facilities);

        List<ParkingSlot> phoenixSlots = slotRepository.findByFacilityId(phoenix.getId());
        List<ParkingSlot> plazaSlots = slotRepository.findByFacilityId(plaza.getId());
        List<ParkingSlot> techSlots = slotRepository.findByFacilityId(tech.getId());
        List<ParkingSlot> airportSlots = slotRepository.findByFacilityId(airport.getId());

        LocalDate today = LocalDate.now(ZONE);
        Instant now = Instant.now();

        Booking active = booking(demo, demoCar, phoenixSlots.get(0), BookingStatus.ACTIVE,
                now.minus(Duration.ofMinutes(45)), now.plus(Duration.ofMinutes(75)),
                new BigDecimal("120.00"), "SP-DEMO0001", "Active session — Level 0, close to the east lift.");
        bookingRepository.saveAndFlush(active);
        log.info("Seeded active booking id={} transient={}", active.getId(), active.getId() == null);
        CheckIn checkIn = new CheckIn();
        checkIn.setBooking(active);
        checkIn.setCheckInTime(now.minus(Duration.ofMinutes(40)));
        checkIn.setVerificationMethod("QR");
        checkInRepository.save(checkIn);

        bookingRepository.save(booking(demo, demoCar, phoenixSlots.get(1), BookingStatus.CONFIRMED,
                at(today.plusDays(1), 10, 0), at(today.plusDays(1), 12, 0),
                new BigDecimal("120.00"), "SP-DEMO0002", "Near-term booking for tomorrow morning."));
        bookingRepository.save(booking(demo, demoCar, plazaSlots.get(2), BookingStatus.COMPLETED,
                at(today.minusDays(2), 18, 0), at(today.minusDays(2), 21, 0),
                new BigDecimal("135.00"), "SP-DEMO0003", "Completed evening reservation."));
        bookingRepository.save(booking(demo, demoCar, techSlots.get(3), BookingStatus.CANCELLED,
                at(today.minusDays(4), 9, 0), at(today.minusDays(4), 11, 0),
                new BigDecimal("70.00"), "SP-DEMO0004", "Cancelled commute booking."));
        bookingRepository.save(booking(demo, demoCar, techSlots.get(4), BookingStatus.CONFIRMED,
                at(today.plusDays(3), 9, 0), at(today.plusDays(3), 18, 0),
                new BigDecimal("315.00"), "SP-DEMO0005", "Full-day commuter booking."));

        bookingRepository.save(booking(second, secondCar, airportSlots.get(0), BookingStatus.CONFIRMED,
                at(today.plusDays(1), 6, 0), at(today.plusDays(1), 14, 0),
                new BigDecimal("640.00"), "SP-DEMO0006", "Airport long-stay reservation."));
        bookingRepository.save(booking(second, secondCar, plazaSlots.get(4), BookingStatus.COMPLETED,
                at(today.minusDays(1), 19, 0), at(today.minusDays(1), 22, 0),
                new BigDecimal("135.00"), "SP-DEMO0007", "Completed dinner reservation."));
        bookingRepository.save(booking(second, secondCar, techSlots.get(6), BookingStatus.CONFIRMED,
                at(today.plusDays(2), 8, 30), at(today.plusDays(2), 17, 30),
                new BigDecimal("315.00"), "SP-DEMO0008", "Upcoming office day."));

        Booking overstay = booking(second, secondCar, phoenixSlots.get(2), BookingStatus.OVERSTAY,
                now.minus(Duration.ofMinutes(180)), now.minus(Duration.ofMinutes(45)),
                new BigDecimal("120.00"), "SP-DEMO0009", "Overstaying vehicle — 45 min late, penalty accumulating.");
        overstay.setOverstayStartTime(now.minus(Duration.ofMinutes(45)));
        overstay.setOverstayDurationMinutes(45);
        overstay.setOverstayCharge(new BigDecimal("90.00"));
        bookingRepository.saveAndFlush(overstay);
        CheckIn checkInOverstay = new CheckIn();
        checkInOverstay.setBooking(overstay);
        checkInOverstay.setCheckInTime(now.minus(Duration.ofMinutes(175)));
        checkInOverstay.setVerificationMethod("QR");
        checkInRepository.save(checkInOverstay);

        Booking noShow = booking(second, secondCar, techSlots.get(1), BookingStatus.NO_SHOW,
                now.minus(Duration.ofHours(3)), now.minus(Duration.ofHours(1)),
                new BigDecimal("70.00"), "SP-DEMO0010", "Initial reservation hold.");
        noShow.setNoShowDetectedAt(now.minus(Duration.ofHours(2).plus(Duration.ofMinutes(45))));
        noShow.setCancellationReason("Customer did not arrive within the 15-minute check-in grace period. Bay liberated for other drivers.");
        bookingRepository.save(noShow);

        log.info("Seeded demo users: admin@smartpark.local / Admin@12345! and demo@smartpark.local / Demo@12345!");
    }

    private User user(String name, String email, String password, Role role) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(role);
        user.setAccountStatus(AccountStatus.ACTIVE);
        return user;
    }

    private Vehicle vehicle(User user, String registration, VehicleType type, boolean isDefault) {
        Vehicle vehicle = new Vehicle();
        vehicle.setUser(user);
        vehicle.setRegistrationNumber(registration);
        vehicle.setNormalizedRegistration(registration.replaceAll("[^A-Za-z0-9]", "").toUpperCase());
        vehicle.setVehicleType(type);
        vehicle.setWidthM(type == VehicleType.SUV ? new BigDecimal("1.95") : new BigDecimal("1.80"));
        vehicle.setLengthM(type == VehicleType.SUV ? new BigDecimal("4.80") : new BigDecimal("4.40"));
        vehicle.setDefault(isDefault);
        return vehicle;
    }

    private Booking booking(User user, Vehicle vehicle, ParkingSlot slot, BookingStatus status,
                            Instant start, Instant end, BigDecimal price, String reference, String reason) {
        Booking booking = new Booking();
        booking.setBookingReference(reference);
        booking.setUser(user);
        booking.setVehicle(vehicle);
        booking.setSlot(slot);
        booking.setStartTime(start);
        booking.setEndTime(end);
        booking.setStatus(status);
        booking.setPriceAmount(price);
        booking.setCurrency("INR");
        booking.setAllocationReason(reason);
        if (status == BookingStatus.CANCELLED) {
            booking.setCancelledAt(Instant.now().minus(Duration.ofDays(3)));
            booking.setCancelledBy(user);
            booking.setCancellationReason("Schedule changed.");
        }
        return booking;
    }

    private Facility facility(String id, List<Facility> facilities) {
        UUID uuid = UUID.fromString(id);
        return facilities.stream().filter(f -> f.getId().equals(uuid)).findFirst()
                .orElseThrow(() -> new IllegalStateException("Seed facility missing: " + id));
    }

    private Instant at(LocalDate date, int hour, int minute) {
        return LocalDateTime.of(date, java.time.LocalTime.of(hour, minute)).atZone(ZONE).toInstant();
    }
}
