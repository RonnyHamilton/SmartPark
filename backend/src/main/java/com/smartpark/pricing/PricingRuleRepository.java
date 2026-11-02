package com.smartpark.pricing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PricingRuleRepository extends JpaRepository<PricingRule, UUID> {
    List<PricingRule> findByFacilityIdOrderByAmountAsc(UUID facilityId);

    @Query("""
            select p from PricingRule p
            where p.facility.id = :facilityId
              and p.active = true
              and p.effectiveFrom <= :onDate
              and (p.effectiveTo is null or p.effectiveTo >= :onDate)
            order by p.amount asc
            """)
    List<PricingRule> findActiveForDate(@Param("facilityId") UUID facilityId, @Param("onDate") LocalDate onDate);
}
