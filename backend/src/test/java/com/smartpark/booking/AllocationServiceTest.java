package com.smartpark.booking;

import com.smartpark.facility.Facility;
import com.smartpark.facility.ParkingFloor;
import com.smartpark.facility.ParkingSlot;
import com.smartpark.facility.SlotStatus;
import com.smartpark.facility.SlotType;
import com.smartpark.vehicle.VehicleType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AllocationServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    private AllocationService service;
    private Facility facility;
    private ParkingFloor ground;
    private ParkingFloor level1;
    private Instant start;
    private Instant end;

    @BeforeEach
    void setUp() {
        service = new AllocationService(bookingRepository);
        facility = new Facility();
        facility.setId(UUID.randomUUID());
        facility.setName("Allocation Test Deck");
        facility.setTimezone("Asia/Kolkata");
        facility.setBufferMinutes(15);

        ground = floor("Ground", 0);
        level1 = floor("Level 1", 1);
        start = Instant.now().plus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
        end = start.plus(2, ChronoUnit.HOURS);

        when(bookingRepository.findOverlappingSlotIdsExcluding(any(), any(), any(), anyList(), any()))
                .thenReturn(List.of());
        when(bookingRepository.countRecentBookingsBySlot(any(), any())).thenReturn(List.of());
    }

    @Test
    void evVehicleOnlyReceivesEvChargerSlot() {
        ParkingSlot standard = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot ev = slot("G-02", ground, SlotType.EV, List.of("CAR", "SUV", "EV"), false, true);

        var outcome = service.allocate(facility, List.of(standard, ev), start, end,
                VehicleType.EV, false, null, null, null);

        assertThat(outcome.slot()).isSameAs(ev);
        assertThat(outcome.reason()).contains("EV charger");
    }

    @Test
    void motorcycleOnlyReceivesMotorcycleCompatibleSlot() {
        ParkingSlot car = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot bike = slot("G-02", ground, SlotType.MOTORCYCLE, List.of("MOTORCYCLE"), false, false);

        var outcome = service.allocate(facility, List.of(car, bike), start, end,
                VehicleType.MOTORCYCLE, false, null, null, null);

        assertThat(outcome.slot()).isSameAs(bike);
    }

    @Test
    void accessibilityRequirementFiltersOutStandardBays() {
        ParkingSlot standard = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot accessible = slot("G-02", ground, SlotType.ACCESSIBLE, List.of("CAR", "SUV"), true, false);

        var outcome = service.allocate(facility, List.of(standard, accessible), start, end,
                VehicleType.CAR, true, null, null, null);

        assertThat(outcome.slot()).isSameAs(accessible);
        assertThat(outcome.reason()).contains("accessible");
    }

    @Test
    void honoursPreferredSlotWhenEligible() {
        ParkingSlot first = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot preferred = slot("G-02", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);

        var outcome = service.allocate(facility, List.of(first, preferred), start, end,
                VehicleType.CAR, false, preferred.getId(), null, null);

        assertThat(outcome.slot()).isSameAs(preferred);
        assertThat(outcome.reason()).contains("preferred slot");
    }

    @Test
    void reportsAlternativesWhenPreferredSlotIsUnavailable() {
        ParkingSlot blocked = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot free = slot("G-02", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        when(bookingRepository.findOverlappingSlotIdsExcluding(any(), any(), any(), anyList(), any()))
                .thenReturn(List.of(blocked.getId()));
        when(bookingRepository.findOverlappingSlotIds(any(), any(), any(), anyList()))
                .thenReturn(List.of());

        var outcome = service.allocate(facility, List.of(blocked, free), start, end,
                VehicleType.CAR, false, blocked.getId(), null, null);

        assertThat(outcome.slot()).isNull();
        assertThat(outcome.reason()).contains("preferred slot");
        assertThat(outcome.alternatives()).containsExactly(free);
    }

    @Test
    void returnsNullWhenNoCompatibleSlotExists() {
        ParkingSlot bike = slot("G-01", ground, SlotType.MOTORCYCLE, List.of("MOTORCYCLE"), false, false);
        when(bookingRepository.findOverlappingSlotIds(any(), any(), any(), anyList()))
                .thenReturn(List.of());

        var outcome = service.allocate(facility, List.of(bike), start, end,
                VehicleType.SUV, false, null, null, null);

        assertThat(outcome.slot()).isNull();
        assertThat(outcome.reason()).contains("No compatible slot");
        assertThat(outcome.alternatives()).isEmpty();
    }

    @Test
    void excludesSlotsThatConflictIncludingBuffer() {
        ParkingSlot blocked = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot free = slot("G-02", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        when(bookingRepository.findOverlappingSlotIdsExcluding(any(), any(), any(), anyList(), any()))
                .thenReturn(List.of(blocked.getId()));

        var outcome = service.allocate(facility, List.of(blocked, free), start, end,
                VehicleType.CAR, false, null, null, null);

        assertThat(outcome.slot()).isSameAs(free);
        verify(bookingRepository).findOverlappingSlotIdsExcluding(
                eq(facility.getId()),
                eq(start.minus(Duration.ofMinutes(15))),
                eq(end.plus(Duration.ofMinutes(15))),
                anyList(),
                isNull());
    }

    @Test
    void deprioritisesRecentlyUsedSlotsForFairness() {
        ParkingSlot used = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot fresh = slot("G-02", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        when(bookingRepository.countRecentBookingsBySlot(any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{used.getId(), 5L}));

        var outcome = service.allocate(facility, List.of(used, fresh), start, end,
                VehicleType.CAR, false, null, null, null);

        assertThat(outcome.slot()).isSameAs(fresh);
        assertThat(outcome.reason()).contains("least recently used");
    }

    @Test
    void prefersLowerFloorsAndBreaksTiesBySlotCode() {
        ParkingSlot upper = slot("L1-01", level1, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot lowerB = slot("G-02", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        ParkingSlot lowerA = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);

        var outcome = service.allocate(facility, List.of(upper, lowerB, lowerA), start, end,
                VehicleType.CAR, false, null, null, null);

        assertThat(outcome.slot()).isSameAs(lowerA);
        assertThat(outcome.alternatives()).hasSize(2);
    }

    @Test
    void ignoresSlotsMarkedOutOfService() {
        ParkingSlot outOfService = slot("G-01", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);
        outOfService.setStatus(SlotStatus.OUT_OF_SERVICE);
        ParkingSlot available = slot("G-02", ground, SlotType.STANDARD, List.of("CAR", "SUV"), false, false);

        var outcome = service.allocate(facility, List.of(outOfService, available), start, end,
                VehicleType.CAR, false, null, null, null);

        assertThat(outcome.slot()).isSameAs(available);
    }

    private ParkingFloor floor(String name, int number) {
        ParkingFloor floor = new ParkingFloor();
        floor.setId(UUID.randomUUID());
        floor.setFacility(facility);
        floor.setName(name);
        floor.setFloorNumber(number);
        return floor;
    }

    private ParkingSlot slot(String code, ParkingFloor floor, SlotType type, List<String> supported,
                             boolean accessible, boolean ev) {
        ParkingSlot slot = new ParkingSlot();
        slot.setId(UUID.randomUUID());
        slot.setFloor(floor);
        slot.setSlotCode(code);
        slot.setSlotType(type);
        slot.setSupportedVehicleTypes(supported);
        slot.setAccessible(accessible);
        slot.setHasEvCharger(ev);
        slot.setStatus(SlotStatus.AVAILABLE);
        return slot;
    }
}
