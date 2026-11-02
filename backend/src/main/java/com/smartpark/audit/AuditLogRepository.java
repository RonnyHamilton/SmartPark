package com.smartpark.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    @EntityGraph(attributePaths = {"actor"})
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"actor"})
    Page<AuditLog> findByActorIdOrderByCreatedAtDesc(java.util.UUID actorId, Pageable pageable);

    default Page<AuditLog> findRecentForActor(java.util.UUID actorId, Pageable pageable) {
        return findByActorIdOrderByCreatedAtDesc(actorId, pageable);
    }
}
