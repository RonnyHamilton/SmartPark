package com.smartpark.facility;

import com.smartpark.common.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FacilityPolicyTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final FacilityPolicy policy = new FacilityPolicy();
    private Facility facility;

    @BeforeEach
    void setUp() {
        facility = new Facility();
        facility.setId(UUID.randomUUID());
        facility.setName("Policy Test Deck");
        facility.setTimezone(ZONE.getId());
        facility.setOpensAt(LocalTime.of(6, 0));
        facility.setClosesAt(LocalTime.of(23, 0));
        facility.setOperatingDays("MON,TUE,WED,THU,FRI,SAT");
        facility.setMinDurationMinutes(60);
        facility.setMaxDurationMinutes(720);
        facility.setAdvanceBookingDays(30);
        facility.setCancellationCutoffMinutes(60);
        facility.setBufferMinutes(15);
    }

    @Test
    void acceptsValidSameDayWindow() {
        ZonedDateTime start = nextOpenDay(10);
        assertThatCode(() -> policy.validateWindow(facility, start.toInstant(),
                start.plusHours(2).toInstant())).doesNotThrowAnyException();
    }

    @Test
    void rejectsEndBeforeStart() {
        ZonedDateTime start = nextOpenDay(10);
        assertThatThrownBy(() -> policy.validateWindow(facility, start.toInstant(),
                start.minusMinutes(30).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("End time");
    }

    @Test
    void rejectsTooShortAndTooLongDurations() {
        ZonedDateTime start = nextOpenDay(10);
        assertThatThrownBy(() -> policy.validateWindow(facility, start.toInstant(),
                start.plusMinutes(30).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Minimum");

        assertThatThrownBy(() -> policy.validateWindow(facility, start.toInstant(),
                start.plusHours(13).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Maximum");
    }

    @Test
    void rejectsPastStart() {
        Instant past = Instant.now().minusSeconds(3600);
        assertThatThrownBy(() -> policy.validateWindow(facility, past, past.plusSeconds(7200)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("past");
    }

    @Test
    void rejectsBookingBeyondAdvanceWindow() {
        ZonedDateTime tooFar = ZonedDateTime.now(ZONE).plusDays(31).withHour(10).withMinute(0);
        assertThatThrownBy(() -> policy.validateWindow(facility, tooFar.toInstant(),
                tooFar.plusHours(2).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("days in advance");
    }

    @Test
    void rejectsClosedOperatingDay() {
        ZonedDateTime sunday = ZonedDateTime.now(ZONE).plusDays(2)
                .with(java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SUNDAY))
                .withHour(10).withMinute(0).withSecond(0).withNano(0);
        assertThatThrownBy(() -> policy.validateWindow(facility, sunday.toInstant(),
                sunday.plusHours(2).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("closed");
    }

    @Test
    void rejectsWindowOutsideOpeningHours() {
        ZonedDateTime start = nextOpenDay(10);
        ZonedDateTime early = start.withHour(5);
        assertThatThrownBy(() -> policy.validateWindow(facility, early.toInstant(),
                early.plusHours(2).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("opens at");

        ZonedDateTime late = start.withHour(22);
        assertThatThrownBy(() -> policy.validateWindow(facility, late.toInstant(),
                late.plusMinutes(90).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("closes at");
    }

    @Test
    void rejectsWindowsCrossingLocalMidnight() {
        ZonedDateTime start = nextOpenDay(10).withHour(22).withMinute(30);
        assertThatThrownBy(() -> policy.validateWindow(facility, start.toInstant(),
                start.plusHours(2).toInstant()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("same local day");
    }

    @Test
    void computesCancellationCutoff() {
        Instant start = Instant.parse("2026-11-10T04:30:00Z");
        assertThat(policy.cancellationCutoff(facility, start))
                .isEqualTo(start.minusSeconds(3600));
    }

    @Test
    void recognisesOperatingHours() {
        ZonedDateTime start = nextOpenDay(10);
        assertThat(policy.isWithinOperatingHours(facility, start.toInstant())).isTrue();
        assertThat(policy.isWithinOperatingHours(facility, start.withHour(23).plusMinutes(30).toInstant()))
                .isFalse();
    }

    private ZonedDateTime nextOpenDay(int hour) {
        ZonedDateTime candidate = ZonedDateTime.now(ZONE).plusDays(2)
                .withHour(hour).withMinute(0).withSecond(0).withNano(0);
        while (candidate.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            candidate = candidate.plusDays(1);
        }
        return candidate;
    }
}
