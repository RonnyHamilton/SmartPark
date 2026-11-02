package com.smartpark.booking;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

    @EntityGraph(attributePaths = {"slot", "slot.floor", "slot.floor.facility", "vehicle", "user"})
    Optional<Booking> findByIdAndUserId(UUID id, UUID userId);

    @EntityGraph(attributePaths = {"slot", "slot.floor", "slot.floor.facility", "vehicle", "user"})
    Optional<Booking> findByBookingReference(String reference);

    @EntityGraph(attributePaths = {"slot", "slot.floor", "slot.floor.facility", "vehicle", "user"})
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findDetailedById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"slot", "slot.floor", "slot.floor.facility", "vehicle"})
    Page<Booking> findByUserIdOrderByStartTimeDesc(UUID userId, Pageable pageable);

    @EntityGraph(attributePaths = {"slot", "slot.floor", "slot.floor.facility", "vehicle"})
    Page<Booking> findByUserIdAndStatusOrderByStartTimeDesc(UUID userId, BookingStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"slot", "slot.floor", "slot.floor.facility", "vehicle", "user"})
    @Query("""
            select b from Booking b
            where (:status is null or b.status = :status)
              and (:facilityId is null or b.slot.floor.facility.id = :facilityId)
              and (cast(:search as string) is null
                   or lower(b.bookingReference) like lower(concat('%', cast(:search as string), '%'))
                   or lower(b.user.email) like lower(concat('%', cast(:search as string), '%')))
            order by b.createdAt desc
            """)
    Page<Booking> adminSearch(@Param("status") BookingStatus status,
                              @Param("facilityId") UUID facilityId,
                              @Param("search") String search,
                              Pageable pageable);

    @Query("""
            select b from Booking b
            where b.slot.id = :slotId
              and b.status in :statuses
              and b.startTime < :end
              and b.endTime > :start
            """)
    List<Booking> findOverlaps(@Param("slotId") UUID slotId,
                               @Param("start") Instant start,
                               @Param("end") Instant end,
                               @Param("statuses") Collection<BookingStatus> statuses);

    @Query("""
            select b.slot.id from Booking b
            where b.slot.floor.facility.id = :facilityId
              and b.status in :statuses
              and b.startTime < :end
              and b.endTime > :start
            """)
    List<UUID> findOverlappingSlotIds(@Param("facilityId") UUID facilityId,
                                      @Param("start") Instant start,
                                      @Param("end") Instant end,
                                      @Param("statuses") Collection<BookingStatus> statuses);

    @Query("""
            select b.slot.id from Booking b
            where b.slot.floor.facility.id = :facilityId
              and b.status in :statuses
              and b.startTime < :end
              and b.endTime > :start
              and (:excludeId is null or b.id <> :excludeId)
            """)
    List<UUID> findOverlappingSlotIdsExcluding(@Param("facilityId") UUID facilityId,
                                               @Param("start") Instant start,
                                               @Param("end") Instant end,
                                               @Param("statuses") Collection<BookingStatus> statuses,
                                               @Param("excludeId") UUID excludeId);

    @Query("""
            select b.slot.id from Booking b
            where b.slot.floor.facility.id = :facilityId
              and (b.status in (com.smartpark.booking.BookingStatus.ACTIVE, com.smartpark.booking.BookingStatus.OVERSTAY)
                   or (b.status = com.smartpark.booking.BookingStatus.CONFIRMED and b.startTime <= :now and b.endTime > :now))
            """)
    List<UUID> findCurrentlyOccupiedSlotIds(@Param("facilityId") UUID facilityId, @Param("now") Instant now);

    @Query("""
            select b.slot.id from Booking b
            where b.slot.floor.facility.id = :facilityId
              and b.status in (com.smartpark.booking.BookingStatus.ACTIVE, com.smartpark.booking.BookingStatus.OVERSTAY)
            """)
    List<UUID> findPhysicallyOccupiedSlotIds(@Param("facilityId") UUID facilityId);

    @Query("""
            select b.slot.id, count(b) from Booking b
            where b.slot.floor.facility.id = :facilityId
              and b.status in ('PENDING', 'CONFIRMED', 'ACTIVE')
              and b.startTime < :end and b.endTime > :start
            group by b.slot.id
            """)
    List<Object[]> countOverlapsBySlot(@Param("facilityId") UUID facilityId,
                                       @Param("start") Instant start,
                                       @Param("end") Instant end);

    @Query("""
            select b.slot.id, count(b) from Booking b
            where b.slot.floor.facility.id = :facilityId
              and b.createdAt >= :since
              and b.status <> 'CANCELLED'
            group by b.slot.id
            """)
    List<Object[]> countRecentBookingsBySlot(@Param("facilityId") UUID facilityId, @Param("since") Instant since);

    @Query("select count(b) from Booking b where b.status = :status")
    long countByStatus(@Param("status") BookingStatus status);

    @Query("""
            select count(b) from Booking b
            where b.status in ('PENDING','CONFIRMED','ACTIVE')
              and b.startTime < :end and b.endTime > :start
            """)
    long countActiveBetween(@Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            select coalesce(sum(b.priceAmount), 0) from Booking b
            where b.status in ('CONFIRMED','ACTIVE','COMPLETED')
              and b.createdAt >= :from and b.createdAt < :to
            """)
    java.math.BigDecimal sumRevenue(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select count(b) from Booking b
            where b.status = 'CANCELLED'
              and b.createdAt >= :from and b.createdAt < :to
            """)
    long countCancelledBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select cast(b.createdAt as LocalDate), count(b), coalesce(sum(b.priceAmount), 0)
            from Booking b
            where b.createdAt >= :from and b.createdAt < :to
              and b.status <> 'CANCELLED'
            group by cast(b.createdAt as LocalDate)
            order by cast(b.createdAt as LocalDate)
            """)
    List<Object[]> revenueByDay(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select b.slot.floor.facility.name, count(b), coalesce(sum(b.priceAmount), 0)
            from Booking b
            where b.createdAt >= :from and b.createdAt < :to
              and b.status <> 'CANCELLED'
            group by b.slot.floor.facility.name
            order by count(b) desc
            """)
    List<Object[]> bookingsByFacility(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select b from Booking b
            join fetch b.slot s
            join fetch s.floor f
            join fetch f.facility fac
            join fetch b.user u
            join fetch b.vehicle v
            where b.status = com.smartpark.booking.BookingStatus.CONFIRMED
              and b.startTime <= :cutoff
            """)
    List<Booking> findPotentialNoShows(@Param("cutoff") Instant cutoff);

    @Query("""
            select b from Booking b
            join fetch b.slot s
            join fetch s.floor f
            join fetch f.facility fac
            join fetch b.user u
            join fetch b.vehicle v
            where b.status = com.smartpark.booking.BookingStatus.ACTIVE
              and b.endTime <= :now
            """)
    List<Booking> findDueForOverstay(@Param("now") Instant now);

    @Query("""
            select b from Booking b
            join fetch b.slot s
            join fetch s.floor f
            join fetch f.facility fac
            join fetch b.user u
            join fetch b.vehicle v
            where b.status = com.smartpark.booking.BookingStatus.OVERSTAY
            order by b.endTime asc
            """)
    List<Booking> findActiveOverstays();

    @Query("""
            select b from Booking b
            join fetch b.slot s
            join fetch s.floor f
            join fetch f.facility fac
            join fetch b.user u
            join fetch b.vehicle v
            where b.slot.id = :slotId
              and b.status in (com.smartpark.booking.BookingStatus.CONFIRMED, com.smartpark.booking.BookingStatus.CONFLICT_REQUIRES_ADMIN)
              and b.startTime >= :from
              and b.startTime <= :to
            order by b.startTime asc
            """)
    List<Booking> findUpcomingOnSlot(@Param("slotId") UUID slotId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select b from Booking b
            join fetch b.slot s
            join fetch s.floor f
            join fetch f.facility fac
            join fetch b.user u
            join fetch b.vehicle v
            where b.status = com.smartpark.booking.BookingStatus.CONFLICT_REQUIRES_ADMIN
            order by b.startTime asc
            """)
    List<Booking> findUnresolvedConflicts();

    @Query("""
            select b from Booking b
            join fetch b.slot s
            join fetch s.floor f
            join fetch f.facility fac
            join fetch b.user u
            join fetch b.vehicle v
            where b.status = com.smartpark.booking.BookingStatus.NO_SHOW
            order by coalesce(b.noShowDetectedAt, b.updatedAt) desc
            """)
    Page<Booking> findRecentNoShows(Pageable pageable);

    @Query("select b from Booking b where b.status = 'PENDING' and b.createdAt < :cutoff")
    List<Booking> findExpiredHolds(@Param("cutoff") Instant cutoff);

    long countByUserId(UUID userId);
    boolean existsByVehicleId(UUID vehicleId);
    boolean existsByBookingReference(String bookingReference);

    @Query("""
            select count(b) from Booking b
            where b.user.id = :userId
              and b.status in ('PENDING','CONFIRMED','ACTIVE')
              and b.startTime < :end and b.endTime > :start
              and (:excludeId is null or b.id <> :excludeId)
            """)
    long countUserOverlaps(@Param("userId") UUID userId,
                           @Param("start") Instant start,
                           @Param("end") Instant end,
                           @Param("excludeId") UUID excludeId);

    long countByUserIdAndStatus(UUID userId, BookingStatus status);

    boolean existsBySlotFloorFacilityId(UUID facilityId);
    boolean existsBySlotId(UUID slotId);

    @Query("select count(b) from Booking b where b.createdAt >= :from and b.createdAt < :to")
    long countCreatedBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select count(b) from Booking b
            where b.status in ('PENDING','CONFIRMED','ACTIVE')
              and b.startTime <= :now and b.endTime > :now
            """)
    long countCurrentlyActive(@Param("now") Instant now);

    @Query("""
            select coalesce(sum(b.priceAmount), 0) from Booking b
            where b.user.id = :userId
              and b.status in ('CONFIRMED','ACTIVE','COMPLETED')
            """)
    java.math.BigDecimal sumUserSpend(@Param("userId") UUID userId);

    @Query("""
            select b from Booking b
            where b.user.id = :userId
              and b.status in ('PENDING','CONFIRMED','ACTIVE')
              and b.endTime > :now
            order by b.startTime asc
            """)
    List<Booking> findUpcoming(@Param("userId") UUID userId, @Param("now") Instant now);

    @Query("""
            select b.slot.floor.facility.name, count(b)
            from Booking b
            where b.user.id = :userId
            group by b.slot.floor.facility.name
            order by count(b) desc
            """)
    List<Object[]> frequentFacilities(@Param("userId") UUID userId);
}
