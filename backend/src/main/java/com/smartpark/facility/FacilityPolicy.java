package com.smartpark.facility;

import com.smartpark.common.BadRequestException;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.Arrays;
import java.util.Locale;

@Component
public class FacilityPolicy {

    public void validateWindow(Facility facility, Instant start, Instant end) {
        if (start == null || end == null) {
            throw new BadRequestException("Start and end times are required.");
        }
        if (!end.isAfter(start)) {
            throw new BadRequestException("End time must be after start time.");
        }
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes < facility.getMinDurationMinutes()) {
            throw new BadRequestException("Minimum booking duration at this facility is "
                    + facility.getMinDurationMinutes() + " minutes.");
        }
        if (minutes > facility.getMaxDurationMinutes()) {
            throw new BadRequestException("Maximum booking duration at this facility is "
                    + facility.getMaxDurationMinutes() + " minutes.");
        }
        Instant now = Instant.now();
        if (start.isBefore(now.minus(Duration.ofMinutes(2)))) {
            throw new BadRequestException("Start time cannot be in the past.");
        }
        if (start.isAfter(now.plus(Duration.ofDays(facility.getAdvanceBookingDays())))) {
            throw new BadRequestException("Bookings can be made up to "
                    + facility.getAdvanceBookingDays() + " days in advance.");
        }

        ZoneId zone = zone(facility);
        LocalDateTime localStart = LocalDateTime.ofInstant(start, zone);
        LocalDateTime localEnd = LocalDateTime.ofInstant(end, zone);
        if (!localStart.toLocalDate().equals(localEnd.toLocalDate())) {
            throw new BadRequestException("Bookings must start and end on the same local day for this facility.");
        }
        if (!operatingDays(facility).contains(localStart.getDayOfWeek())) {
            throw new BadRequestException("This facility is closed on "
                    + localStart.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH) + ".");
        }
        LocalTime opens = facility.getOpensAt();
        LocalTime closes = facility.getClosesAt();
        if (localStart.toLocalTime().isBefore(opens)) {
            throw new BadRequestException("This facility opens at " + opens + ".");
        }
        if (localEnd.toLocalTime().isAfter(closes)) {
            throw new BadRequestException("This facility closes at " + closes + "; the booking must end by then.");
        }
    }

    public boolean isWithinOperatingHours(Facility facility, Instant at) {
        LocalDateTime local = LocalDateTime.ofInstant(at, zone(facility));
        return operatingDays(facility).contains(local.getDayOfWeek())
                && !local.toLocalTime().isBefore(facility.getOpensAt())
                && local.toLocalTime().isBefore(facility.getClosesAt());
    }

    public Instant cancellationCutoff(Facility facility, Instant bookingStart) {
        return bookingStart.minus(Duration.ofMinutes(facility.getCancellationCutoffMinutes()));
    }

    private java.util.Set<DayOfWeek> operatingDays(Facility facility) {
        return Arrays.stream(facility.getOperatingDays().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toUpperCase)
                .map(s -> DayOfWeek.valueOf(s.substring(0, 3).equals("TUE") ? "TUESDAY" : mapDay(s)))
                .collect(java.util.stream.Collectors.toSet());
    }

    private String mapDay(String abbreviation) {
        return switch (abbreviation.substring(0, 3)) {
            case "MON" -> "MONDAY";
            case "TUE" -> "TUESDAY";
            case "WED" -> "WEDNESDAY";
            case "THU" -> "THURSDAY";
            case "FRI" -> "FRIDAY";
            case "SAT" -> "SATURDAY";
            case "SUN" -> "SUNDAY";
            default -> throw new BadRequestException("Invalid operating day configuration.");
        };
    }

    public ZoneId zone(Facility facility) {
        try {
            return ZoneId.of(facility.getTimezone());
        } catch (Exception ex) {
            return ZoneId.of("Asia/Kolkata");
        }
    }
}
