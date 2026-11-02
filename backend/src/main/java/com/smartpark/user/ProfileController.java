package com.smartpark.user;

import com.smartpark.audit.AuditLogRepository;
import com.smartpark.auth.AuthDtos;
import com.smartpark.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/users/me")
public class ProfileController {

    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    public ProfileController(CurrentUser currentUser, UserRepository userRepository,
                             AuditLogRepository auditLogRepository) {
        this.currentUser = currentUser;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
    }

    public record ActivityItem(String action, String resourceType, String resourceId, Instant createdAt) {}

    @GetMapping
    public AuthDtos.UserView profile() {
        return AuthDtos.UserView.from(currentUser.entity());
    }

    @PatchMapping
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    public AuthDtos.UserView update(@Valid @RequestBody AuthDtos.UpdateProfileRequest request) {
        User user = currentUser.entity();
        user.setName(request.name().trim());
        if (request.accessibilityRequired() != null) {
            user.setAccessibilityRequired(request.accessibilityRequired());
        }
        userRepository.save(user);
        return AuthDtos.UserView.from(user);
    }

    @GetMapping("/activity")
    public List<ActivityItem> activity() {
        return auditLogRepository.findRecentForActor(currentUser.id(), PageRequest.of(0, 30)).stream()
                .map(log -> new ActivityItem(log.getAction(), log.getResourceType(), log.getResourceId(),
                        log.getCreatedAt()))
                .toList();
    }
}
