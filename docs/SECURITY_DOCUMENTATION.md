# SmartPark: Security Architecture & Vulnerability Mitigation Report
## Comprehensive Security Defense & Vulnerability Assessment

**Semester 3 Mini Project Documentation**  
**Frameworks:** Spring Security 6, BCrypt, HMAC-SHA256, PostgreSQL 16 Kernel Constraints  
**Standards:** OWASP Top 10 Compliance  

---

## 1. Security Architecture Overview

SmartPark implements defense-in-depth across three architectural boundaries:
1. **Network & Transport Layer:** Whitelisted CORS origins, `HttpOnly`, `SameSite=Strict` cookie attributes, and TLS/HTTPS transport readiness.
2. **Application & Framework Layer:** Spring Security 6 filter chain, HMAC-SHA256 stateless access tokens, single-use rotating refresh tokens, method-level authorization (`@PreAuthorize`), and IDOR ownership guards.
3. **Database Layer:** 100% parameterized SQL execution via Spring Data JPA / Hibernate, check constraints, foreign key restrictions, and kernel-level GiST exclusion constraints.

---

## 2. Core Security Controls & Vulnerability Mitigations

```
+---------------------------------------------------------------------------------------------------------+
|                                    SMARTPARK SECURITY CONTROLS                                          |
+--------------------------+-------------------------------------+----------------------------------------+
| Attack Vector / Threat   | SmartPark Defense Mechanism         | Engineering Implementation             |
+--------------------------+-------------------------------------+----------------------------------------+
| Credential Exposure      | Salted BCrypt (Work Factor 12)      | AuthService.java, SecurityConfig.java  |
| XSS Token Theft          | HttpOnly, SameSite=Strict Cookie    | AuthController.java                    |
| Token Replay Attacks     | Single-Use Refresh Token Rotation   | RefreshTokenRepository.java            |
| Brute-Force / Stuffing   | 5-Attempt Lockout for 15 minutes    | users.locked_until, failed_attempts    |
| Object Tampering (IDOR)  | Principal Ownership Verification    | BookingService.java, ProfileController |
| SQL Injection (SQLi)     | JPA Parameterized Queries (0 native)| JpaRepository<T, ID>                   |
| Double-Booking Race Cond | PostgreSQL GiST Exclusion Operator  | excl_bookings_slot_time (Postgres 16)  |
| Forensic Accountability  | Append-Only Immutable Audit Log     | audit_logs (JSONB metadata)            |
+--------------------------+-------------------------------------+----------------------------------------+
```

---

## 3. Deep-Dive Security Implementations

### 3.1 Authentication & Token Lifecycle
- **Password Security:** Credentials hashed using BCrypt with 12 rounds of salting. Plaintext passwords never touch application logs or persistent storage.
- **Stateless Access JWT:** Issued with an ephemeral 15-minute lifespan (`900` seconds). Signed using HMAC-SHA256 with an enterprise 256-bit secret key.
- **Single-Use Refresh Token Rotation:**
  - Token is a 64-character cryptographically random string generated via `SecureRandom`.
  - Only the SHA-256 hash is persisted in `refresh_tokens.token_hash`.
  - Upon presentation, the existing token is atomically invalidated (`revoked_at = now()`) and a fresh token is issued.
  - Stored exclusively in an `HttpOnly`, `SameSite=Strict` cookie, rendering it inaccessible to JavaScript and immune to XSS theft.

### 3.2 Brute-Force Rate Limiting & Account Lockout
- Consecutive failed password attempts increment `users.failed_login_attempts`.
- Upon 5 consecutive failures, the account is locked for 15 minutes:
  ```java
  user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
  if (user.getFailedLoginAttempts() >= 5) {
      user.setLockedUntil(Instant.now().plus(Duration.ofMinutes(15)));
  }
  ```
- Any subsequent attempt during the lockout window is rejected with HTTP 401 (`"Account is temporarily locked. Try again later."`).
- Successful authentication resets the counter to 0.

### 3.3 Broken Object Level Authorization (IDOR) Defense
- To prevent drivers from viewing, modifying, or cancelling reservations belonging to other customers:
  ```java
  User caller = currentUser.entity();
  Booking booking = bookingRepository.findById(bookingId)
      .orElseThrow(() -> new NotFoundException("Booking not found."));

  if (!booking.getUser().getId().equals(caller.getId()) && caller.getRole() != Role.ADMIN) {
      throw new NotFoundException("Booking not found.");
  }
  ```
  *(Note: Returns HTTP 404 rather than 403 to avoid leaking the existence of other records).*

### 3.4 SQL Injection Immunity
- 100% of queries use Spring Data JPA repository method queries and JPQL queries with named parameters (`:param`).
- Zero string concatenation in query construction.
- Strict database-level type checking on UUIDs, dates, and enums prevents SQL syntax alteration.

### 3.5 Spatio-Temporal Concurrency Protection
- Dual-layer defense combining Hibernate `@Version` optimistic locking with PostgreSQL GiST exclusion constraint (`excl_bookings_slot_time`).
- Evaluates temporal range overlap via PostgreSQL `tstzrange` and `&&` operator at transaction commit time.

### 3.6 Structured Audit Trail
- Every critical mutation (registrations, logins, password changes, booking creations, cancellations, gate check-outs, overstay transitions, admin slot overrides) is logged to `audit_logs` with actor ID, action code, resource ID, and structured JSONB metadata.
