package com.smartpark.security;

import com.smartpark.common.BadRequestException;
import com.smartpark.common.ForbiddenException;
import com.smartpark.common.UnauthorizedException;
import com.smartpark.config.AppProperties;
import com.smartpark.user.Role;
import com.smartpark.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private static final String DEFAULT_DEV_SECRET =
            "c21hcnRwYXJrLWRldmVsb3BtZW50LW9ubHktc2VjcmV0LWNoYW5nZS1tZS0yMDI2";

    private final SecretKey key;
    private final AppProperties properties;

    public JwtService(AppProperties properties) {
        this.properties = properties;
        String configured = properties.getSecurity().getJwtSecret();
        if (configured == null || configured.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be configured");
        }
        byte[] bytes = decodeSecret(configured);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes of entropy");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    private byte[] decodeSecret(String configured) {
        try {
            byte[] decoded = Base64.getDecoder().decode(configured);
            if (decoded.length >= 32) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
            // Fall back to raw UTF-8 bytes.
        }
        return configured.getBytes(StandardCharsets.UTF_8);
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(properties.getSecurity().getAccessTokenTtlMinutes(), ChronoUnit.MINUTES);
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("name", user.getName())
                .claim("role", user.getRole().name())
                .claim("type", "access")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    public String generateCheckInToken(UUID bookingId, UUID userId, Instant expiresAt) {
        Instant now = Instant.now();
        Instant expiry = expiresAt.isBefore(now.plus(2, ChronoUnit.HOURS)) ? expiresAt : now.plus(2, ChronoUnit.HOURS);
        return Jwts.builder()
                .subject(userId.toString())
                .claim("bookingId", bookingId.toString())
                .claim("type", "checkin")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    public Claims parseCheckInToken(String token) {
        Claims claims = parse(token);
        if (!"checkin".equals(claims.get("type", String.class))) {
            throw new BadRequestException("Invalid check-in token.");
        }
        return claims;
    }

    public Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        } catch (io.jsonwebtoken.ExpiredJwtException ex) {
            throw new UnauthorizedException("Your session has expired. Please sign in again.");
        } catch (io.jsonwebtoken.JwtException | IllegalArgumentException ex) {
            throw new UnauthorizedException("Invalid authentication token.");
        }
    }

    public UserPrincipal parseAccessToken(String token) {
        Claims claims = parse(token);
        if (!"access".equals(claims.get("type", String.class))) {
            throw new UnauthorizedException("Invalid authentication token.");
        }
        Role role;
        try {
            role = Role.valueOf(claims.get("role", String.class));
        } catch (Exception ex) {
            throw new UnauthorizedException("Invalid authentication token.");
        }
        return new UserPrincipal(
                UUID.fromString(claims.getSubject()),
                claims.get("email", String.class),
                claims.get("name", String.class),
                role);
    }

    public long accessTokenTtlSeconds() {
        return properties.getSecurity().getAccessTokenTtlMinutes() * 60;
    }

    public static boolean isDefaultDevelopmentSecret(String secret) {
        return DEFAULT_DEV_SECRET.equals(secret);
    }

    public void requireAdmin(UserPrincipal principal) {
        if (principal == null || principal.role() != Role.ADMIN) {
            throw new ForbiddenException("Administrator access is required.");
        }
    }
}
