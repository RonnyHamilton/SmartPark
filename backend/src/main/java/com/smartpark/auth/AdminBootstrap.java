package com.smartpark.auth;

import com.smartpark.audit.AuditService;
import com.smartpark.user.AccountStatus;
import com.smartpark.user.Role;
import com.smartpark.user.User;
import com.smartpark.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Optional one-time production bootstrap for the first administrator.
 *
 * <p>Demo seeding creates an admin only in development. Production deployments
 * can set {@code BOOTSTRAP_ADMIN_EMAIL}, {@code BOOTSTRAP_ADMIN_PASSWORD} and
 * optionally {@code BOOTSTRAP_ADMIN_NAME}. The run is idempotent: an existing
 * account is never modified, and an existing non-admin account is reported and
 * left untouched. Remove the variables after the account has been created.</p>
 */
@Component
@Order(10)
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final String email;
    private final String password;
    private final String name;

    public AdminBootstrap(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          AuditService auditService,
                          @Value("${app.bootstrap-admin-email:}") String email,
                          @Value("${app.bootstrap-admin-password:}") String password,
                          @Value("${app.bootstrap-admin-name:SmartPark Administrator}") String name) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.email = email;
        this.password = password;
        this.name = name;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (isBlank(email) && isBlank(password)) {
            return;
        }
        if (isBlank(email) || isBlank(password)) {
            throw new IllegalStateException(
                    "Set both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD, or neither.");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (!normalizedEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_EMAIL is not a valid email address.");
        }
        if (password.length() < 10 || password.length() > 72
                || !password.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$")) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_PASSWORD must be 10-72 characters and include "
                    + "upper-case, lower-case and numeric characters.");
        }

        String safeName = isBlank(name) ? "SmartPark Administrator" : name.trim();
        if (safeName.length() < 2 || safeName.length() > 120) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_NAME must be between 2 and 120 characters.");
        }

        Optional<User> existing = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existing.isPresent()) {
            if (existing.get().getRole() == Role.ADMIN) {
                log.info("Bootstrap admin already exists for {}; no changes made.", normalizedEmail);
            } else {
                log.warn("An account already exists for {} but is not an administrator; "
                        + "bootstrap left it unchanged. Promote it explicitly if intended.", normalizedEmail);
            }
            return;
        }

        User admin = new User();
        admin.setName(safeName);
        admin.setEmail(normalizedEmail);
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRole(Role.ADMIN);
        admin.setAccountStatus(AccountStatus.ACTIVE);
        userRepository.save(admin);
        auditService.record(admin, "ADMIN_BOOTSTRAPPED", "USER", admin.getId().toString(),
                Map.of("email", normalizedEmail));
        log.info("Bootstrap administrator created for {}. Remove the bootstrap secrets and restart.",
                normalizedEmail);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
