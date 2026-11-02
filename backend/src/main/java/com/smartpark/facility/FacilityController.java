package com.smartpark.facility;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/facilities")
public class FacilityController {

    private final FacilityService facilityService;

    public FacilityController(FacilityService facilityService) {
        this.facilityService = facilityService;
    }

    @GetMapping
    public List<FacilityDtos.FacilitySummary> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String vehicleType,
            @RequestParam(defaultValue = "false") boolean accessible,
            @RequestParam(defaultValue = "false") boolean ev,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String amenity) {
        return facilityService.list(q, city, vehicleType, accessible, ev, maxPrice, amenity);
    }

    @GetMapping("/{id}")
    public FacilityDtos.FacilityDetail detail(@PathVariable UUID id) {
        return facilityService.detail(id, false);
    }

    @GetMapping("/{id}/availability")
    public FacilityDtos.AvailabilityResponse availability(
            @PathVariable UUID id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end,
            @RequestParam(required = false) String vehicleType,
            @RequestParam(defaultValue = "false") boolean accessible,
            @RequestParam(defaultValue = "false") boolean ev) {
        return facilityService.availability(id, start, end, vehicleType, accessible, ev);
    }

    @GetMapping("/{id}/slots")
    public FacilityDtos.AvailabilityResponse slots(
            @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end,
            @RequestParam(required = false) String vehicleType) {
        Instant effectiveStart = start != null ? start : Instant.now();
        Instant effectiveEnd = end != null ? end : effectiveStart.plus(Duration.ofHours(2));
        return facilityService.availability(id, effectiveStart, effectiveEnd, vehicleType, false, false);
    }
}
