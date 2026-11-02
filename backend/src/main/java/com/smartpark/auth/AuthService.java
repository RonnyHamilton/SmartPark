package com.smartpark.auth;

import com.smartpark.audit.AuditService;
import com.smartpark.common.BadRequestException;
import com.smartpark.common.ConflictException;
import com.smartpark.common.RateLimitException;
import com.smartpark.common.RateLimitService;
import com.smartpark.common.UnauthorizedException;
import com.smartpark.config.AppProperties;
import com.smartpark.security.JwtService;
import com.smartpark.user.AccountStatus;
import com.smartpark.user.Role;
import com.smartpark.user.User;
import com.smartpark.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String DUMMY_HASH =
            "$2a$12$C6UzMDM.H6dfI/f/IKcEe.5YQ0p8xq6rJ8zGZg4l8b5h0pQoQ7f3S";

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AppProperties properties;
    private final RateLimitService rateLimitService;
    private final AuditService auditService;
    private final PasswordResetService passwordResetService;

    public AuthService(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService, AppProperties properties,
                       RateLimitService rateLimitService, AuditService auditService,
                       PasswordResetService passwordResetService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.properties = properties;
        this.rateLimitService = rateLimitService;
        this.auditService = auditService;
        this.passwordResetService = passwordResetService;
    }

    public record IssuedTokens(String accessToken, String refreshToken, UUID refreshTokenId, User user) {}

    @Transactional
    public IssuedTokens register(AuthDtos.RegisterRequest request, String clientIp) {
        rateLimitService.check("register:" + clientIp, properties.getSecurity().getRateLimitPerMinute());
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("An account with this email already exists.");
        }
        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(Role.USER);
        user.setAccountStatus(AccountStatus.ACTIVE);
        userRepository.save(user);

        auditService.record(user, "USER_REGISTERED", "USER", user.getId().toString(), Map.of());
        return issue(user);
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public IssuedTokens login(AuthDtos.LoginRequest request, String clientIp) {
        rateLimitService.check("login:" + clientIp, properties.getSecurity().getRateLimitPerMinute());
        String email = request.email().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (userOpt.isEmpty()) {
            // Perform a hash comparison to reduce user-enumeration timing signals.
            passwordEncoder.matches(request.password(), DUMMY_HASH);
            throw new UnauthorizedException("Invalid email or password.");
        }

        User user = userOpt.get();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            throw new RateLimitException("This account is temporarily locked. Try again later.");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= properties.getSecurity().getLoginMaxAttempts()) {
                user.setLockedUntil(Instant.now().plus(properties.getSecurity().getLoginLockMinutes(),
                        ChronoUnit.MINUTES));
                user.setFailedLoginAttempts(0);
            }
            userRepository.save(user);
            throw new UnauthorizedException("Invalid email or password.");
        }
        if (user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new UnauthorizedException("This account has been disabled.");
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);
        return issue(user);
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public IssuedTokens rotateRefreshToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException("Your session has expired. Please sign in again.");
        }
        String hash = sha256(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new UnauthorizedException("Your session is no longer valid. Please sign in again."));

        if (stored.getRevokedAt() != null) {
            // A revoked token being replayed can indicate theft: revoke the whole family.
            refreshTokenRepository.revokeAllForUser(stored.getUser().getId(), Instant.now());
            throw new UnauthorizedException("Your session has been revoked. Please sign in again.");
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Your session has expired. Please sign in again.");
        }
        if (stored.getUser().getAccountStatus() != AccountStatus.ACTIVE) {
            throw new UnauthorizedException("This account has been disabled.");
        }

        IssuedTokens issued = issue(stored.getUser());
        stored.setRevokedAt(Instant.now());
        stored.setReplacedBy(issued.refreshTokenId());
        refreshTokenRepository.save(stored);
        return issued;
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(sha256(rawRefreshToken)).ifPresent(token -> {
            if (token.getRevokedAt() == null) {
                token.setRevokedAt(Instant.now());
                refreshTokenRepository.save(token);
            }
        });
    }

    @Transactional
    public void changePassword(User user, String currentPassword, String newPassword) {
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadRequestException("Your current password is incorrect.");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new BadRequestException("Choose a password different from your current one.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());
        auditService.record(user, "PASSWORD_CHANGED", "USER", user.getId().toString(), Map.of());
    }

    @Transactional
    public String requestPasswordReset(String email) {
        return passwordResetService.requestReset(email);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        passwordResetService.reset(token, newPassword);
    }

    private IssuedTokens issue(User user) {
        String accessToken = jwtService.generateAccessToken(user);
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        String rawRefresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshToken refresh = new RefreshToken();
        refresh.setUser(user);
        refresh.setTokenHash(sha256(rawRefresh));
        refresh.setExpiresAt(Instant.now().plus(properties.getSecurity().getRefreshTokenTtlDays(), ChronoUnit.DAYS));
        refreshTokenRepository.save(refresh);
        return new IssuedTokens(accessToken, rawRefresh, refresh.getId(), user);
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
