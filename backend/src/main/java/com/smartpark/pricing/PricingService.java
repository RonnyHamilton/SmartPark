package com.smartpark.pricing;

import com.smartpark.common.ConflictException;
import com.smartpark.facility.Facility;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;

@Service
public class PricingService {

    public record PriceQuote(
            BigDecimal amount,
            String currency,
            String rateType,
            BigDecimal rateAmount,
            int billableUnits,
            long durationMinutes,
            String explanation
    ) {}

    private final PricingRuleRepository repository;

    public PricingService(PricingRuleRepository repository) {
        this.repository = repository;
    }

    public PriceQuote quote(Facility facility, Instant start, Instant end) {
        long durationMinutes = (end.getEpochSecond() - start.getEpochSecond()) / 60;
        if (durationMinutes <= 0) {
            throw new ConflictException("Booking end time must be after its start time.");
        }
        var date = start.atZone(ZoneId.of(facility.getTimezone())).toLocalDate();
        List<PricingRule> rules = repository.findActiveForDate(facility.getId(), date).stream()
                .filter(r -> durationMinutes >= r.getMinimumDurationMinutes()
                        && durationMinutes <= r.getMaximumDurationMinutes())
                .toList();

        if (rules.isEmpty()) {
            throw new ConflictException("No active pricing rule covers this duration at "
                    + facility.getName() + ". Please choose a different duration.");
        }

        record Candidate(PricingRule rule, BigDecimal amount, int units) {}
        Candidate best = rules.stream()
                .map(rule -> {
                    int units;
                    BigDecimal amount;
                    switch (rule.getRateType()) {
                        case HOURLY -> {
                            units = (int) Math.ceil(durationMinutes / 60.0);
                            amount = rule.getAmount().multiply(BigDecimal.valueOf(units));
                        }
                        case DAILY -> {
                            units = (int) Math.ceil(durationMinutes / 1440.0);
                            amount = rule.getAmount().multiply(BigDecimal.valueOf(units));
                        }
                        default -> {
                            units = 1;
                            amount = rule.getAmount();
                        }
                    }
                    return new Candidate(rule, amount.setScale(2, RoundingMode.HALF_UP), units);
                })
                .min(Comparator.comparing(Candidate::amount)
                        .thenComparing(c -> c.rule().getRateType().ordinal()))
                .orElseThrow();

        BigDecimal amount = best.amount();
        if (amount.signum() < 0) {
            throw new ConflictException("Invalid pricing configuration for this facility.");
        }
        String unitLabel = switch (best.rule().getRateType()) {
            case HOURLY -> best.units() + " hour" + (best.units() == 1 ? "" : "s");
            case DAILY -> best.units() + " day" + (best.units() == 1 ? "" : "s");
            case FLAT -> "flat rate";
        };
        String explanation = "₹" + best.rule().getAmount().stripTrailingZeros().toPlainString() + " "
                + best.rule().getRateType().name().toLowerCase() + " × " + unitLabel;
        return new PriceQuote(amount, "INR", best.rule().getRateType().name(), best.rule().getAmount(),
                best.units(), durationMinutes, explanation);
    }

    public record OverstayQuote(
            BigDecimal amount,
            long overstayMinutes,
            BigDecimal multiplier,
            String explanation
    ) {}

    public OverstayQuote quoteOverstay(Facility facility, Instant scheduledEnd, Instant actualCheckout) {
        if (!actualCheckout.isAfter(scheduledEnd)) {
            return new OverstayQuote(BigDecimal.ZERO, 0, facility.getOverstayMultiplier(), "No overstay recorded.");
        }
        long overstayMinutes = java.time.Duration.between(scheduledEnd, actualCheckout).toMinutes();
        if (overstayMinutes <= 0) {
            return new OverstayQuote(BigDecimal.ZERO, 0, facility.getOverstayMultiplier(), "No overstay recorded.");
        }

        int billableHours = (int) Math.ceil(overstayMinutes / 60.0);
        var date = scheduledEnd.atZone(ZoneId.of(facility.getTimezone())).toLocalDate();
        List<PricingRule> rules = repository.findActiveForDate(facility.getId(), date);

        BigDecimal baseHourlyRate = rules.stream()
                .filter(r -> r.getRateType() == RateType.HOURLY)
                .map(PricingRule::getAmount)
                .min(Comparator.naturalOrder())
                .orElseGet(() -> rules.stream()
                        .map(PricingRule::getAmount)
                        .min(Comparator.naturalOrder())
                        .orElse(new BigDecimal("50.00")));

        BigDecimal multiplier = facility.getOverstayMultiplier() != null
                ? facility.getOverstayMultiplier() : new BigDecimal("1.50");

        BigDecimal overstayAmount = baseHourlyRate
                .multiply(BigDecimal.valueOf(billableHours))
                .multiply(multiplier)
                .setScale(2, RoundingMode.HALF_UP);

        String explanation = "Overstay: " + overstayMinutes + " min (" + billableHours + " hr"
                + (billableHours == 1 ? "" : "s") + " × ₹" + baseHourlyRate.stripTrailingZeros().toPlainString()
                + " × " + multiplier.stripTrailingZeros().toPlainString() + "x rate)";

        return new OverstayQuote(overstayAmount, overstayMinutes, multiplier, explanation);
    }
}
