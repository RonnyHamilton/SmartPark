# SmartPark: Security Architecture & Vulnerability Mitigation Report

## 1. Threat Modeling & Security Posture

SmartPark was developed according to OWASP Top 10 recommendations and defensive software engineering best practices. The application enforces security at three distinct layers:
1. **Network & Transport Layer:** CORS origin whitelisting, HTTP-only secure cookie attributes.
2. **Application & Framework Layer:** Spring Security 6 filter chain, JWT verification, BCrypt password hashing, method-level authorization (`@PreAuthorize`), and IDOR object ownership checks.
3. **Database Layer:** Parameterized SQL queries via Spring Data JPA / Hibernate, check constraints, foreign key cascades, and mathematical GiST exclusion constraints.

---

## 2. Core Security Mitigations

### 2.1 Defense Against Broken Authentication & Session Hijacking
- **Cryptographic Password Storage:** Passwords are never stored in plaintext. They are salted and hashed using **BCrypt** with an algorithmic cost factor of 12.
- **Short-Lived Access Tokens:** Stateless access JWTs have a 15-minute lifespan (`900` seconds). If an access token is intercepted, the exposure window is minimal.
- **Single-Use Refresh Token Rotation:** Refresh tokens are 64-character high-entropy cryptographic strings. Only the **SHA-256 hash** of the token is stored in the database (`refresh_tokens.token_hash`). When a refresh token is presented:
  1. The server locates the token by hash.
  2. If already revoked, the server flags a potential replay attack.
  3. The token is immediately marked `revoked_at = NOW()`.
  4. A fresh token is generated, stored, and sent back to the client.
- **XSS-Immune Token Storage:** The refresh token is transmitted exclusively inside an `HttpOnly`, `SameSite=Lax` cookie. Client-side JavaScript has zero access to this cookie, eliminating theft via Cross-Site Scripting (XSS).

### 2.2 Defense Against Brute-Force & Credential Stuffing
- **Exponential Account Lockout:** The `users` table tracks `failed_login_attempts`.
  - On each failed authentication attempt for an email, `failed_login_attempts` increments by 1.
  - When the counter reaches **5**, the user account is locked by setting `locked_until = NOW() + INTERVAL '15 minutes'`.
  - Further login attempts during the lockout window immediately fail with HTTP 423 Locked / 401 Unauthorized, logging an audit alert.
  - On any successful login, `failed_login_attempts` is reset to 0.

### 2.3 Defense Against Broken Object Level Authorization (IDOR)
An Insecure Direct Object Reference occurs when a malicious user manipulates a URL parameter (e.g., `GET /api/v1/bookings/{id}`) to view or cancel another driver's reservation.
- **Mitigation in SmartPark:** The `BookingService` verifies that the caller owns the resource before executing reads or mutations:
```java
User caller = authService.getCurrentAuthenticatedUser();
Booking booking = bookingRepository.findById(bookingId)
    .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

if (!booking.getUserId().equals(caller.getId()) && caller.getRole() != Role.ADMIN) {
    auditService.logEvent(caller.getId(), "UNAUTHORIZED_BOOKING_ACCESS_ATTEMPT", "BOOKING", bookingId.toString());
    throw new AccessDeniedException("Access denied: You do not own this booking");
}
```

### 2.4 Defense Against SQL Injection (SQLi)
- All database queries are executed via **Spring Data JPA repositories** and Hibernate ORM utilizing **parameterized queries** with bound values.
- Dynamic native queries are never constructed using string concatenation (`"SELECT ... WHERE id = " + id`).
- PostgreSQL strongly types all inputs (UUIDs, timestamps, integers), rejecting malformed injection attempts at the protocol parser level.

### 2.5 Defense Against Concurrency Race Conditions (Double Bookings)
- Traditional locking (`synchronized` blocks) fails across clustered application instances.
- SmartPark delegates concurrency resolution to the **PostgreSQL 16 kernel** using a Generalized Search Tree (`GiST`) exclusion constraint (`excl_bookings_slot_time`). Overlapping intervals on the same bay are rejected by the storage engine before any row can commit.

### 2.6 Cross-Origin Resource Sharing (CORS) Security
- Configured via `WebConfig.java` to whitelist only explicitly permitted development and production origins (e.g., `http://localhost:5173`).
- Wildcards (`Access-Control-Allow-Origin: *`) are explicitly prohibited when handling authenticated credentials.

### 2.7 Security & Operational Audit Logging
- Every administrative action, booking creation, cancellation, gate check-out, and failed authentication is permanently recorded in `audit_logs`.
- Audit logs contain the actor's UUID, event category, affected resource ID, timestamp, and JSON metadata, facilitating forensic analysis.
