package com.smartpark.booking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CheckInRepository extends JpaRepository<CheckIn, UUID> {
    Optional<CheckIn> findByBookingId(UUID bookingId);
    boolean existsByBookingId(UUID bookingId);
}
