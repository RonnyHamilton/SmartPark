package com.smartpark.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class BookingLifecycleJob {

    private static final Logger log = LoggerFactory.getLogger(BookingLifecycleJob.class);

    private final BookingRepository bookingRepository;
    private final BookingService bookingService;

    public BookingLifecycleJob(BookingRepository bookingRepository, BookingService bookingService) {
        this.bookingRepository = bookingRepository;
        this.bookingService = bookingService;
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 15_000)
    @Transactional
    public void advanceLifecycle() {
        Instant now = Instant.now();

        // 1. Process No-Shows: confirmed bookings where customer never checked in within the grace period
        int noShows = bookingService.processNoShows();

        // 2. Process Overstays: active parking sessions that exceeded their scheduled end time without checkout
        int overstays = bookingService.processOverstays();

        // 3. Process Expired Holds: temporary holds that were never confirmed
        int expired = 0;
        for (Booking booking : bookingRepository.findExpiredHolds(now.minus(15, ChronoUnit.MINUTES))) {
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setCancellationReason("Temporary hold expired before confirmation.");
            bookingRepository.save(booking);
            expired++;
        }

        if (noShows + overstays + expired > 0) {
            log.info("Booking lifecycle: noShows={}, overstays={}, expiredHolds={}", noShows, overstays, expired);
        }
    }
}
