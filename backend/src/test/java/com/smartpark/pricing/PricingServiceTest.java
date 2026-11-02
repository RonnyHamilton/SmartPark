package com.smartpark.pricing;

import com.smartpark.common.ConflictException;
import com.smartpark.facility.Facility;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PricingServiceTest {

    @Mock
    private PricingRuleRepository repository;

    private PricingService service;
    private Facility facility;

    @BeforeEach
    void setUp() {
        service = new PricingService(repository);
        facility = new Facility();
        facility.setId(UUID.randomUUID());
        facility.setName("Test Deck");
        facility.setTimezone("Asia/Kolkata");
    }

    @Test
    void hourlyRateRoundsPartialHoursUp() {
        when(repository.findActiveForDate(facility.getId(), LocalDate.of(2026, 11, 10)))
                .thenReturn(List.of(rule(RateType.HOURLY, "60.00", 30, 720)));

        Instant start = Instant.parse("2026-11-10T04:30:00Z"); // 10:00 IST
        var quote = service.quote(facility, start, start.plus(130, ChronoUnit.MINUTES));

        assertThat(quote.amount()).isEqualByComparingTo("180.00");
        assertThat(quote.billableUnits()).isEqualTo(3);
        assertThat(quote.durationMinutes()).isEqualTo(130);
        assertThat(quote.rateType()).isEqualTo("HOURLY");
        assertThat(quote.currency()).isEqualTo("INR");
    }

    @Test
    void choosesCheapestApplicableRule() {
        when(repository.findActiveForDate(facility.getId(), LocalDate.of(2026, 11, 10)))
                .thenReturn(List.of(
                        rule(RateType.HOURLY, "60.00", 30, 720),
                        rule(RateType.DAILY, "200.00", 480, 1440)));

        Instant start = Instant.parse("2026-11-10T04:30:00Z");
        var quote = service.quote(facility, start, start.plus(8, ChronoUnit.HOURS));

        assertThat(quote.rateType()).isEqualTo("DAILY");
        assertThat(quote.amount()).isEqualByComparingTo("200.00");
        assertThat(quote.billableUnits()).isEqualTo(1);
    }

    @Test
    void supportsFlatRate() {
        when(repository.findActiveForDate(any(), any()))
                .thenReturn(List.of(rule(RateType.FLAT, "99.00", 30, 720)));

        Instant start = Instant.parse("2026-11-10T04:30:00Z");
        var quote = service.quote(facility, start, start.plus(2, ChronoUnit.HOURS));

        assertThat(quote.amount()).isEqualByComparingTo("99.00");
        assertThat(quote.billableUnits()).isEqualTo(1);
        assertThat(quote.explanation()).contains("flat rate");
    }

    @Test
    void usesFacilityLocalDateForRuleLookup() {
        when(repository.findActiveForDate(any(), any()))
                .thenReturn(List.of(rule(RateType.HOURLY, "60.00", 30, 720)));

        // 20:00 UTC is 01:30 the next day in Asia/Kolkata.
        Instant start = Instant.parse("2026-11-10T20:00:00Z");
        service.quote(facility, start, start.plus(2, ChronoUnit.HOURS));

        verify(repository).findActiveForDate(facility.getId(), LocalDate.of(2026, 11, 11));
    }

    @Test
    void rejectsDurationNotCoveredByAnyRule() {
        when(repository.findActiveForDate(any(), any()))
                .thenReturn(List.of(rule(RateType.HOURLY, "60.00", 60, 720)));

        Instant start = Instant.parse("2026-11-10T04:30:00Z");
        assertThatThrownBy(() -> service.quote(facility, start, start.plus(30, ChronoUnit.MINUTES)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("No active pricing rule");
    }

    @Test
    void rejectsEmptyRuleSet() {
        when(repository.findActiveForDate(any(), any())).thenReturn(List.of());

        Instant start = Instant.parse("2026-11-10T04:30:00Z");
        assertThatThrownBy(() -> service.quote(facility, start, start.plus(2, ChronoUnit.HOURS)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void rejectsNonPositiveDuration() {
        Instant start = Instant.parse("2026-11-10T04:30:00Z");
        assertThatThrownBy(() -> service.quote(facility, start, start))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("end time");
    }

    private PricingRule rule(RateType type, String amount, int min, int max) {
        PricingRule rule = new PricingRule();
        rule.setFacility(facility);
        rule.setRateType(type);
        rule.setAmount(new BigDecimal(amount));
        rule.setMinimumDurationMinutes(min);
        rule.setMaximumDurationMinutes(max);
        rule.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        rule.setActive(true);
        return rule;
    }
}
