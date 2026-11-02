package com.smartpark.facility;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ParkingFloorRepository extends JpaRepository<ParkingFloor, UUID> {
    List<ParkingFloor> findByFacilityIdOrderByDisplayOrderAsc(UUID facilityId);
    long countByFacilityId(UUID facilityId);
    void deleteByFacilityId(UUID facilityId);
}
