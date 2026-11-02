# SmartPark: REST API Reference & Specification
## Comprehensive RESTful API Contract & Endpoint Reference

**Semester 3 Mini Project Documentation**  
**API Base Path:** `/api/v1`  
**Authentication Scheme:** Bearer JWT in `Authorization` header (`HS256`) + `HttpOnly` Cookie Refresh Tokens  

---

## 1. Response Models & Error Handling

### 1.1 Success Response Envelope
All successful resource retrieval and mutation responses return clean, typed JSON representations. Paginated collections follow the standard `PageResponse<T>` format:

```json
{
  "content": [ ... ],
  "page": 0,
  "size": 20,
  "totalElements": 52,
  "totalPages": 3,
  "first": true,
  "last": false
}
```

### 1.2 RFC 7807 Standardized Error Detail
Exceptions are intercepted globally via `GlobalExceptionHandler` and rendered in RFC 7807 Problem Detail format:

```json
{
  "timestamp": "2026-11-02T10:15:30.412Z",
  "status": 409,
  "error": "Conflict",
  "message": "Parking slot G-01 is already reserved for the selected time window",
  "path": "/api/v1/bookings"
}
```

#### HTTP Status Code Conventions
- `200 OK` — Successful query or idempotent mutation.
- `201 Created` — Resource successfully created (`Location` header populated).
- `204 No Content` — Deletion successful; empty body.
- `400 Bad Request` — Request validation failure (DTO field constraint breached).
- `401 Unauthorized` — Missing or invalid authentication token.
- `403 Forbidden` — Access denied (insufficient role privileges or origin rejected).
- `404 Not Found` — Requested entity ID does not exist.
- `409 Conflict` — Business rule conflict (e.g., slot already reserved, overstay conflict).
- `429 Too Many Requests` — Rate limit exceeded (brute-force defense).

---

## 2. Authentication & Identity Endpoints (`/api/v1/auth`)

### 2.1 Register New User
- **Method / Path:** `POST /api/v1/auth/register`
- **Access Level:** Public
- **Request Body:**
```json
{
  "name": "Maya Kapoor",
  "email": "maya@example.com",
  "password": "StrongPassword123!",
  "accessibilityRequired": false
}
```
- **Responses:**
  - `200 OK`: Returns access JWT and profile; sets `smartpark_refresh` cookie.
  - `400 Bad Request`: Validation failure (weak password, invalid email format).
  - `409 Conflict`: Email already registered.

### 2.2 Authenticate / Sign In
- **Method / Path:** `POST /api/v1/auth/login`
- **Access Level:** Public
- **Request Body:**
```json
{
  "email": "demo@smartpark.local",
  "password": "Demo@12345!"
}
```
- **Response Headers:** `Set-Cookie: smartpark_refresh=<token>; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=604800`
- **Response Body (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "expiresInSeconds": 900,
  "user": {
    "id": "d8dc15e7-de5e-44c6-951e-dd9d220d8b5b",
    "name": "Maya Kapoor",
    "email": "demo@smartpark.local",
    "role": "USER",
    "accountStatus": "ACTIVE",
    "accessibilityRequired": false
  }
}
```

### 2.3 Rotate Refresh Token
- **Method / Path:** `POST /api/v1/auth/refresh`
- **Access Level:** Public (Requires `smartpark_refresh` cookie)
- **Response (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresInSeconds": 900
}
```

### 2.4 User Sign Out / Logout
- **Method / Path:** `POST /api/v1/auth/logout`
- **Access Level:** Authenticated
- **Response (`200 OK`):** Clears `smartpark_refresh` cookie and revokes token hash in database.

### 2.5 Retrieve Current Identity
- **Method / Path:** `GET /api/v1/auth/me`
- **Access Level:** Authenticated (`Bearer <token>`)
- **Response (`200 OK`):** Authenticated user profile DTO.

### 2.6 Forgot Password Request
- **Method / Path:** `POST /api/v1/auth/forgot-password`
- **Access Level:** Public
- **Request Body:**
```json
{
  "email": "demo@smartpark.local"
}
```
- **Response (`200 OK`):** Confirms email dispatch with hashed reset token generated in database.

### 2.7 Reset Password
- **Method / Path:** `POST /api/v1/auth/reset-password`
- **Access Level:** Public
- **Request Body:**
```json
{
  "token": "a1b2c3d4e5f6...",
  "newPassword": "NewStrongPassword123!"
}
```
- **Response (`200 OK`):** Password updated successfully.

### 2.8 In-Session Password Change
- **Method / Path:** `POST /api/v1/auth/change-password`
- **Access Level:** Authenticated
- **Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewStrongPassword123!"
}
```
- **Response (`200 OK`):** Password changed; previous refresh tokens invalidated.

---

## 3. User Profile & Activity Endpoints (`/api/v1/users/me`)

### 3.1 Get Profile
- **Method / Path:** `GET /api/v1/users/me`
- **Access Level:** Authenticated

### 3.2 Update Profile
- **Method / Path:** `PATCH /api/v1/users/me`
- **Access Level:** Authenticated (`ROLE_USER` / `ROLE_ADMIN`)
- **Request Body:**
```json
{
  "name": "Maya Kapoor",
  "accessibilityRequired": true
}
```
- **Response (`200 OK`):** Updated user profile.

### 3.3 Get Personal Activity Log
- **Method / Path:** `GET /api/v1/users/me/activity`
- **Access Level:** Authenticated
- **Response (`200 OK`):** List of recent user actions logged in the system audit trail.

---

## 4. Vehicle Fleet Endpoints (`/api/v1/vehicles`)

### 4.1 List User Vehicles
- **Method / Path:** `GET /api/v1/vehicles`
- **Access Level:** Authenticated
- **Response (`200 OK`):** List of vehicles owned by the authenticated caller.

### 4.2 Register Vehicle
- **Method / Path:** `POST /api/v1/vehicles`
- **Access Level:** Authenticated
- **Request Body:**
```json
{
  "registrationNumber": "MH 12 AB 3456",
  "vehicleType": "CAR",
  "widthM": 1.80,
  "lengthM": 4.50,
  "isDefault": true
}
```
- **Response (`201 Created`):** Returns saved vehicle record with `normalizedRegistration: "MH12AB3456"`.

### 4.3 Set Default Vehicle
- **Method / Path:** `PUT /api/v1/vehicles/{id}/default`
- **Access Level:** Authenticated

### 4.4 Delete Vehicle
- **Method / Path:** `DELETE /api/v1/vehicles/{id}`
- **Access Level:** Authenticated

---

## 5. Facility & Inventory Endpoints (`/api/v1/facilities`)

### 5.1 Search Facilities
- **Method / Path:** `GET /api/v1/facilities`
- **Access Level:** Public
- **Query Parameters:** `city` (string), `search` (keyword)
- **Response (`200 OK`):** List of active facilities.

### 5.2 Facility Detail
- **Method / Path:** `GET /api/v1/facilities/{id}`
- **Access Level:** Public
- **Response (`200 OK`):** Facility metadata, pricing rules, operating hours, coordinates.

### 5.3 Facility Floor & Bay Hierarchy
- **Method / Path:** `GET /api/v1/facilities/{id}/floors`
- **Access Level:** Public
- **Response (`200 OK`):** Multi-level floor breakdown with nested parking slots.

### 5.4 Query Live Slot Availability
- **Method / Path:** `GET /api/v1/facilities/{id}/availability`
- **Access Level:** Public
- **Query Parameters:** `startTime` (ISO-8601), `endTime` (ISO-8601)
- **Response (`200 OK`):** Available slot IDs for the requested time window.

---

## 6. Booking & Reservation Endpoints (`/api/v1/bookings`)

### 6.1 Pre-Booking Price Quote
- **Method / Path:** `POST /api/v1/bookings/quote`
- **Access Level:** Authenticated (`ROLE_USER`)
- **Request Body:**
```json
{
  "facilityId": "33333333-0000-4000-8000-000000000001",
  "vehicleId": "5a14a1ef-6915-4b32-b2ea-7a07511ca3a2",
  "startTime": "2026-11-03T10:00:00Z",
  "endTime": "2026-11-03T14:00:00Z",
  "accessibilityRequired": false,
  "preferredSlotId": null,
  "preferredFloorId": null
}
```
- **Response (`200 OK`):** Itemized tariff quotation, candidate slot preview, and dimension compatibility.

### 6.2 Create Booking
- **Method / Path:** `POST /api/v1/bookings`
- **Access Level:** Authenticated (`ROLE_USER`)
- **Request Body:**
```json
{
  "facilityId": "33333333-0000-4000-8000-000000000001",
  "vehicleId": "5a14a1ef-6915-4b32-b2ea-7a07511ca3a2",
  "slotId": "33333333-0001-4000-8000-000000000011",
  "startTime": "2026-11-03T10:00:00Z",
  "endTime": "2026-11-03T14:00:00Z"
}
```
- **Responses:**
  - `201 Created`: Returns confirmed booking record with reference `SP-XXXXXXXX`.
  - `409 Conflict`: Slot already booked (PostgreSQL GiST exclusion violation `23P01`).

### 6.3 List Current User's Bookings
- **Method / Path:** `GET /api/v1/bookings/me`
- **Access Level:** Authenticated
- **Query Parameters:** `status` (BookingStatus), `page` (int), `size` (int)

### 6.4 Get User Booking Statistics
- **Method / Path:** `GET /api/v1/bookings/me/stats`
- **Access Level:** Authenticated
- **Response (`200 OK`):** Total active, upcoming, completed, cancelled counts, and cumulative spend in INR.

### 6.5 Get Booking Detail & QR Token
- **Method / Path:** `GET /api/v1/bookings/{id}`
- **Access Level:** Authenticated (Owner or Admin)
- **Response (`200 OK`):** Detailed booking view including cryptographic QR verification token.

### 6.6 Reschedule Booking
- **Method / Path:** `PATCH /api/v1/bookings/{id}/reschedule`
- **Access Level:** Authenticated (Owner or Admin)
- **Request Body:**
```json
{
  "startTime": "2026-11-03T11:00:00Z",
  "endTime": "2026-11-03T15:00:00Z"
}
```

### 6.7 Cancel Booking
- **Method / Path:** `POST /api/v1/bookings/{id}/cancel`
- **Access Level:** Authenticated (Owner or Admin)
- **Request Body:**
```json
{
  "reason": "Trip postponed"
}
```

### 6.8 Gate Check-In
- **Method / Path:** `POST /api/v1/bookings/{id}/check-in`
- **Access Level:** Authenticated
- **Request Body:**
```json
{
  "token": "optional-qr-jwt-token"
}
```
- **Response (`200 OK`):** Transitions status to `ACTIVE`.

### 6.9 Gate Check-Out
- **Method / Path:** `POST /api/v1/bookings/{id}/check-out`
- **Access Level:** Authenticated
- **Response (`200 OK`):** Transitions status to `COMPLETED`, evaluates overstay duration, and calculates overstay charge.

---

## 7. Administrative Command & Control Endpoints (`/api/v1/admin`)

*All `/api/v1/admin/**` routes strictly require `ROLE_ADMIN` authorization.*

### 7.1 Analytics & KPI Metrics
- **Method / Path:** `GET /api/v1/admin/analytics`
- **Query Parameters:** `from` (ISO-8601), `to` (ISO-8601)
- **Response (`200 OK`):** Aggregated metrics (total slots, active parkers, revenue, cancellations) and daily trend points.

### 7.2 Facility Infrastructure CRUD
- `GET /api/v1/admin/facilities` — List all facilities (including inactive).
- `GET /api/v1/admin/facilities/{id}` — Get facility admin details.
- `POST /api/v1/admin/facilities` — Create facility (`201 Created`).
- `PATCH /api/v1/admin/facilities/{id}` — Update facility parameters.
- `DELETE /api/v1/admin/facilities/{id}` — Delete facility (`204 No Content`).

### 7.3 Multi-Level Floor CRUD
- `POST /api/v1/admin/facilities/{facilityId}/floors` — Add floor.
- `PATCH /api/v1/admin/floors/{id}` — Update floor name/order.
- `DELETE /api/v1/admin/floors/{id}` — Delete floor.

### 7.4 Parking Bay CRUD & Maintenance
- `POST /api/v1/admin/floors/{floorId}/slots` — Add bay.
- `PATCH /api/v1/admin/slots/{id}` — Update bay attributes/status.
- `DELETE /api/v1/admin/slots/{id}` — Delete bay.

### 7.5 Pricing Rules CRUD
- `POST /api/v1/admin/facilities/{facilityId}/pricing` — Add tariff rule.
- `PATCH /api/v1/admin/pricing/{id}` — Update tariff rule.
- `DELETE /api/v1/admin/pricing/{id}` — Delete tariff rule.

### 7.6 Global Booking Management & Overstay Operations
- `GET /api/v1/admin/bookings` — Search and filter all global bookings.
- `GET /api/v1/admin/bookings/{id}` — View booking detail.
- `POST /api/v1/admin/bookings/{id}/cancel` — Administrative cancellation.
- `GET /api/v1/admin/overstay-dashboard` — View live vehicles overstaying, physical blockages, and unresolved conflicts.
- `POST /api/v1/admin/bookings/{id}/resolve-conflict` — Manually reassign a blocked booking (`CONFLICT_REQUIRES_ADMIN`) to a selected vacant bay.

### 7.7 User Administration
- `GET /api/v1/admin/users` — Search user directory.
- `PATCH /api/v1/admin/users/{id}/status` — Set account status (`ACTIVE` / `DISABLED`).
- `PATCH /api/v1/admin/users/{id}/role` — Set user role (`USER` / `ADMIN`).

### 7.8 Security Audit Trail
- `GET /api/v1/admin/audit` — Paginated system audit logs with actor emails, action codes, and JSONB metadata.

### 7.9 System Metadata Enums
- `GET /api/v1/admin/meta` — Returns allowed enums (`SlotType`, `VehicleType`, `BookingStatus`).
