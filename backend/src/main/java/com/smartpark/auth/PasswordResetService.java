package com.smartpark.auth;

import com.smartpark.common.BadRequestException;
import com.smartpark.common.MailService;
import com.smartpark.common.UnauthorizedException;
import com.smartpark.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PasswordResetTokenRepository tokenRepository;
    private final com.smartpark.user.UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final MailService mailService;
    private final AppProperties properties;

    public PasswordResetService(PasswordResetTokenRepository tokenRepository,
                                com.smartpark.user.UserRepository userRepository,
                                PasswordEncoder passwordEncoder,
                                RefreshTokenRepository refreshTokenRepository,
                                MailService mailService,
                                AppProperties properties) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenRepository = refreshTokenRepository;
        this.mailService = mailService;
        this.properties = properties;
    }

    @Transactional
    public String requestReset(String rawEmail) {
        String email = rawEmail.trim().toLowerCase();
        var userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            return null;
        }
        var user = userOpt.get();
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setTokenHash(sha256(rawToken));
        token.setExpiresAt(Instant.now().plusSeconds(30 * 60));
        tokenRepository.save(token);

        mailService.send(user.getEmail(), "Reset your SmartPark password",
                "Use this single-use token within 30 minutes to reset your password:\n\n" + rawToken
                        + "\n\nIf you did not request this, you can ignore this email.");
        log.info("Password reset requested for user {}", user.getId());
        return rawToken;
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository.findByTokenHash(sha256(rawToken))
                .orElseThrow(() -> new BadRequestException("This reset link is invalid or has already been used."));
        if (token.getUsedAt() != null || token.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("This reset link is invalid or has expired.");
        }
        var user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        token.setUsedAt(Instant.now());
        tokenRepository.save(token);
        refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
