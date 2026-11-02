package com.smartpark.audit;

import com.smartpark.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(User actor, String action, String resourceType, String resourceId, Map<String, Object> metadata) {
        AuditLog entry = new AuditLog();
        entry.setActor(actor);
        entry.setAction(action);
        entry.setResourceType(resourceType);
        entry.setResourceId(resourceId);
        entry.setMetadata(metadata == null ? Map.of() : metadata);
        repository.save(entry);
        log.info("audit action={} resource={}:{} actor={}", action, resourceType, resourceId,
                actor == null ? "system" : actor.getId());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordStandalone(User actor, String action, String resourceType, String resourceId,
                                 Map<String, Object> metadata) {
        AuditLog entry = new AuditLog();
        entry.setActor(actor);
        entry.setAction(action);
        entry.setResourceType(resourceType);
        entry.setResourceId(resourceId);
        entry.setMetadata(metadata == null ? Map.of() : metadata);
        repository.save(entry);
    }
}
