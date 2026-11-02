package com.smartpark.security;

import com.smartpark.common.ForbiddenException;
import com.smartpark.common.UnauthorizedException;
import com.smartpark.user.User;
import com.smartpark.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentUser {

    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserPrincipal principal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw new UnauthorizedException("Authentication is required.");
        }
        return principal;
    }

    public UUID id() {
        return principal().id();
    }

    public User entity() {
        return userRepository.findById(id())
                .orElseThrow(() -> new UnauthorizedException("Account no longer exists."));
    }

    public void requireAdmin() {
        if (!"ADMIN".equals(principal().role().name())) {
            throw new ForbiddenException("Administrator access is required.");
        }
    }
}
