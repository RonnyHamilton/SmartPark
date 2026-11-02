package com.smartpark.facility;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FacilityRepository extends JpaRepository<Facility, UUID> {
    List<Facility> findByStatusOrderByNameAsc(FacilityStatus status);

    @Query("""
            select distinct f from Facility f
            where (:city is null or lower(f.city) = lower(:city))
              and (:status is null or f.status = :status)
            order by f.name
            """)
    List<Facility> search(@Param("city") String city, @Param("status") FacilityStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Facility f where f.id = :id")
    Optional<Facility> findByIdForUpdate(@Param("id") UUID id);
}
