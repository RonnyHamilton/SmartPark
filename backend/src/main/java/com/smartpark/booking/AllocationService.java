package com.smartpark.booking;

import com.smartpark.facility.Facility;
import com.smartpark.facility.ParkingSlot;
import com.smartpark.facility.SlotStatus;
import com.smartpark.facility.SlotType;
import com.smartpark.vehicle.VehicleType;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Deterministic, explainable slot allocation. Ranking considers explicit preferences,
 * accessibility, EV charging, vehicle compatibility, floor proximity and recent usage
 * (fair distribution). No machine-learning claims are made; every decision is auditable.
 */
@Service
public class AllocationService {

    private static final List<BookingStatus> LIVE_STATUSES =
            List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE,
                    BookingStatus.OVERSTAY, BookingStatus.CONFLICT_REQUIRES_ADMIN);

    private record RankedSlot(ParkingSlot slot, int score, List<String> notes) {}

    public record Outcome(
            ParkingSlot slot,
            String reason,
            List<ParkingSlot> alternatives,
            List<Instant> suggestedStarts
    ) {}

    private final BookingRepository bookingRepository;

    public AllocationService(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    public Outcome allocate(Facility facility,
                            List<ParkingSlot> slots,
                            Instant start,
                            Instant end,
                            VehicleType vehicleType,
                            boolean accessibilityRequired,
                            UUID preferredSlotId,
                            UUID preferredFloorId,
                            UUID excludeBookingId) {
        Instant bufferStart = start.minus(Duration.ofMinutes(facility.getBufferMinutes()));
        Instant bufferEnd = end.plus(Duration.ofMinutes(facility.getBufferMinutes()));

        Set<UUID> conflicting = new HashSet<>(bookingRepository.findOverlappingSlotIdsExcluding(
                facility.getId(), bufferStart, bufferEnd, LIVE_STATUSES, excludeBookingId));

        // Physical occupancy guard: slots currently occupied by active sessions or overstaying vehicles
        // cannot be allocated for immediate arrivals.
        Instant immediateArrivalCutoff = Instant.now().plus(Duration.ofMinutes(facility.getBufferMinutes()));
        if (start.isBefore(immediateArrivalCutoff)) {
            conflicting.addAll(bookingRepository.findPhysicallyOccupiedSlotIds(facility.getId()));
        }

        Map<UUID, Long> recentUsage = new HashMap<>();
        for (Object[] row : bookingRepository.countRecentBookingsBySlot(facility.getId(),
                Instant.now().minus(Duration.ofDays(14)))) {
            recentUsage.put((UUID) row[0], ((Number) row[1]).longValue());
        }

        List<RankedSlot> eligible = new ArrayList<>();
        for (ParkingSlot slot : slots) {
            if (slot.getStatus() != SlotStatus.AVAILABLE || conflicting.contains(slot.getId())) {
                continue;
            }
            if (!slot.getSupportedVehicleTypes().contains(vehicleType.name())) {
                continue;
            }
            if (vehicleType == VehicleType.EV && !slot.isHasEvCharger()) {
                continue;
            }
            if (accessibilityRequired && !slot.isAccessible()) {
                continue;
            }

            int score = 100;
            List<String> notes = new ArrayList<>();
            notes.add("Level " + slot.getFloor().getFloorNumber() + " · " + slot.getSlotCode());

            if (accessibilityRequired && slot.isAccessible()) {
                score += 25;
                notes.add("step-free accessible bay");
            }
            if (vehicleType == VehicleType.EV && slot.isHasEvCharger()) {
                score += 20;
                notes.add("EV charger");
            }
            if (preferredFloorId != null && preferredFloorId.equals(slot.getFloor().getId())) {
                score += 60;
                notes.add("your preferred floor");
            }
            score += Math.max(0, 20 - slot.getFloor().getFloorNumber() * 3);
            if (slot.getSlotType() == SlotType.LARGE && vehicleType == VehicleType.SUV) {
                score += 6;
                notes.add("extra-wide bay");
            }
            if (slot.isAccessible() && !accessibilityRequired) {
                score -= 12;
                notes.add("accessible bay kept as a lower priority");
            }
            long usage = recentUsage.getOrDefault(slot.getId(), 0L);
            score -= (int) Math.min(30, usage * 4);
            if (usage == 0) {
                notes.add("least recently used");
            }

            eligible.add(new RankedSlot(slot, score, notes));
        }

        eligible.sort(Comparator.comparingInt(RankedSlot::score).reversed()
                .thenComparing(r -> r.slot().getSlotCode()));

        if (preferredSlotId != null) {
            RankedSlot preferred = eligible.stream()
                    .filter(r -> r.slot().getId().equals(preferredSlotId))
                    .findFirst().orElse(null);
            if (preferred == null) {
                return new Outcome(null,
                        "Your preferred slot is unavailable or incompatible for the full selected period.",
                        alternatives(eligible, preferredSlotId),
                        suggestedStarts(facility, slots, start, Duration.between(start, end), vehicleType,
                                accessibilityRequired));
            }
            return new Outcome(preferred.slot(),
                    "Reserved your preferred slot " + preferred.slot().getSlotCode() + " — "
                            + preferred.slot().getFloor().getName() + ", held for the full period.",
                    alternatives(eligible, preferred.slot().getId()),
                    List.of());
        }

        if (eligible.isEmpty()) {
            return new Outcome(null,
                    "No compatible slot is free for the entire selected period.",
                    List.of(),
                    suggestedStarts(facility, slots, start, Duration.between(start, end), vehicleType,
                            accessibilityRequired));
        }

        RankedSlot best = eligible.get(0);
        String reason = "Allocated " + best.slot().getSlotCode() + " on " + best.slot().getFloor().getName()
                + " — " + String.join(", ", best.notes()) + ". It was the highest-scoring compatible slot "
                + "for the entire booking window and has a " + facility.getBufferMinutes()
                + "-minute turnaround buffer.";
        return new Outcome(best.slot(), reason, alternatives(eligible, best.slot().getId()), List.of());
    }

    private List<ParkingSlot> alternatives(List<RankedSlot> ranked, UUID chosenId) {
        List<ParkingSlot> result = new ArrayList<>();
        for (RankedSlot item : ranked) {
            if (!item.slot().getId().equals(chosenId)) {
                result.add(item.slot());
                if (result.size() == 3) break;
            }
        }
        return result;
    }

    private List<Instant> suggestedStarts(Facility facility, List<ParkingSlot> slots, Instant requestedStart,
                                          Duration duration, VehicleType vehicleType,
                                          boolean accessibilityRequired) {
        List<Instant> suggestions = new ArrayList<>();
        Instant cursor = requestedStart.isAfter(Instant.now())
                ? requestedStart : Instant.now().plus(Duration.ofMinutes(10));
        long minutes = cursor.getEpochSecond() / 60;
        cursor = Instant.ofEpochSecond(((minutes / 30) + 1) * 30 * 60);

        for (int i = 0; i < 24 && suggestions.size() < 3; i++) {
            Instant candidateStart = cursor.plus(Duration.ofMinutes(30L * i));
            Instant candidateEnd = candidateStart.plus(duration);
            Set<UUID> conflicts = new HashSet<>(bookingRepository.findOverlappingSlotIds(
                    facility.getId(),
                    candidateStart.minus(Duration.ofMinutes(facility.getBufferMinutes())),
                    candidateEnd.plus(Duration.ofMinutes(facility.getBufferMinutes())),
                    LIVE_STATUSES));
            boolean anyFree = slots.stream().anyMatch(slot ->
                    slot.getStatus() == SlotStatus.AVAILABLE
                            && !conflicts.contains(slot.getId())
                            && slot.getSupportedVehicleTypes().contains(vehicleType.name())
                            && (vehicleType != VehicleType.EV || slot.isHasEvCharger())
                            && (!accessibilityRequired || slot.isAccessible()));
            if (anyFree) {
                suggestions.add(candidateStart);
            }
        }
        return suggestions;
    }
}
