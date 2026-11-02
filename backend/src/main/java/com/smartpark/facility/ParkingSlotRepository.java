package com.smartpark.facility;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ParkingSlotRepository extends JpaRepository<ParkingSlot, UUID> {

    @Query("""
            select s from ParkingSlot s join fetch s.floor f
            where f.facility.id = :facilityId
            order by f.displayOrder, s.slotCode
            """)
    List<ParkingSlot> findByFacilityId(@Param("facilityId") UUID facilityId);

    @Query("""
            select s from ParkingSlot s join fetch s.floor f
            where s.id = :id
            """)
    Optional<ParkingSlot> findByIdWithFloor(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ParkingSlot s join fetch s.floor f join fetch f.facility where s.id = :id")
    Optional<ParkingSlot> findByIdForUpdate(@Param("id") UUID id);

    long countByFloorFacilityId(UUID facilityId);
    long countByFloorId(UUID floorId);

    @Query("select count(s) from ParkingSlot s where s.floor.facility.id = :facilityId and s.status = 'AVAILABLE'")
    long countAvailableByFacility(@Param("facilityId") UUID facilityId);

    void deleteByFloorId(UUID floorId);
}
