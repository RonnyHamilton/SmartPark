# SmartPark: REST API Reference & Specification

All API endpoints are hosted beneath base path `/api/v1`. 

---

## Standard Response Envelopes & Error Model

### Success Envelope
For resource creation and queries:
```json
{
  "id": "c890242d-13cc-40ce-822e-8fee905f3be1",
  "bookingReference": "SP-ZW4SDGCB",
  "status": "CONFIRMED",
  "priceAmount": 160.00,
  "currency": "INR"
}
```

### Standard RFC 7807 Problem Detail (Error Envelope)
```json
{
  "timestamp": "2026-11-01T12:53:46.330Z",
  "status": 409,
  "error": "Conflict",
  "message": "Parking slot G-01 is already reserved for the selected time window",
  "path": "/api/v1/bookings"
}
```

---

## 1. Authentication Endpoints (`/api/v1/auth`)

### 1.1 Register Account
- **Endpoint:** `POST /api/v1/auth/register`
- **Access:** Public
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
  - `201 Created`: User successfully registered.
  - `400 Bad Request`: Validation failure (weak password, invalid email format).
  - `409 Conflict`: Email already in use.

### 1.2 User Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "email": "demo@smartpark.local",
  "password": "Demo@12345!"
}
```
- **Response Headers:** Sets `Set-Cookie: smartpark_refresh=<token>; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=604800`
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
    "role": "USER"
  }
}
```

### 1.3 Rotate Refresh Token
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Access:** Public (Requires `smartpark_refresh` cookie)
- **Responses:**
  - `200 OK`: Returns new access token and updates refresh cookie.
  - `401 Unauthorized`: Missing or revoked refresh token.

### 1.4 User Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- **Access:** Authenticated
- **Response (`204 No Content`):** Revokes refresh token in database and clears HTTP cookie.

### 1.5 Get Authenticated Profile
- **Endpoint:** `GET /api/v1/auth/me`
- **Access:** Authenticated (`Bearer <token>`)
- **Response (`200 OK`):** Current user object.

---

## 2. Facility Endpoints (`/api/v1/facilities`)

### 2.1 Search Facilities
- **Endpoint:** `GET /api/v1/facilities`
- **Access:** Public
- **Query Parameters:**
  - `city` (string, optional) — Filter by city (e.g., `'Pune'`).
  - `search` (string, optional) — Keyword filter on name or address.
- **Response (`200 OK`):** List of active facilities with operating hours and coordinate locations.

### 2.2 Facility Floor & Bay Catalog
- **Endpoint:** `GET /api/v1/facilities/{id}/floors`
- **Access:** Public
- **Response (`200 OK`):**
```json
[
  {
    "id": "11111111-0001-4000-8000-000000000001",
    "name": "Ground",
    "floorNumber": 0,
    "slots": [
      {
        "id": "11111111-0001-4000-8000-000000000011",
        "slotCode": "G-01",
        "slotType": "STANDARD",
        "hasEvCharger": false,
        "isAccessible": false,
        "widthM": 2.40,
        "lengthM": 5.00,
        "status": "AVAILABLE",
        "layoutX": 1,
        "layoutY": 1
      }
    ]
  }
]
```

### 2.3 Query Slot Availability
- **Endpoint:** `GET /api/v1/facilities/{id}/availability`
- **Access:** Public
- **Query Parameters:**
  - `startTime` (ISO-8601 string, required) — e.g. `2026-11-02T10:00:00Z`
  - `endTime` (ISO-8601 string, required) — e.g. `2026-11-02T14:00:00Z`
- **Response (`200 OK`):** Returns array of available `slotId` strings for that specific interval.

---

## 3. Booking & Reservation Endpoints (`/api/v1/bookings`)

### 3.1 Create Reservation
- **Endpoint:** `POST /api/v1/bookings`
- **Access:** Authenticated (`ROLE_USER` / `ROLE_ADMIN`)
- **Request Body:**
```json
{
  "slotId": "11111111-0001-4000-8000-000000000011",
  "vehicleId": "5a14a1ef-6915-4b32-b2ea-7a07511ca3a2",
  "startTime": "2026-11-02T10:00:00Z",
  "endTime": "2026-11-02T12:00:00Z"
}
```
- **Responses:**
  - `201 Created`:
    ```json
    {
      "id": "c890242d-13cc-40ce-822e-8fee905f3be1",
      "bookingReference": "SP-ZW4SDGCB",
      "facilityName": "Airport Transit Hub",
      "slotCode": "G-01",
      "vehicleRegistration": "MH 12 AB 3456",
      "startTime": "2026-11-02T10:00:00Z",
      "endTime": "2026-11-02T12:00:00Z",
      "status": "CONFIRMED",
      "priceAmount": 160.00,
      "currency": "INR"
    }
    ```
  - `400 Bad Request`: Vehicle dimensions too large for bay or duration invalid.
  - `409 Conflict`: Slot already booked by another driver for requested window.

### 3.2 List User Bookings
- **Endpoint:** `GET /api/v1/bookings`
- **Access:** Authenticated
- **Response (`200 OK`):** List of bookings owned by the authenticated caller.

### 3.3 Cancel Reservation
- **Endpoint:** `POST /api/v1/bookings/{id}/cancel`
- **Access:** Authenticated (Owner or Admin)
- **Request Body:**
```json
{
  "reason": "Plans changed"
}
```
- **Response (`200 OK`):** Updated booking record with `status: "CANCELLED"`.

---

## 4. Gate Check-In & Departure Endpoints

### 4.1 Retrieve Check-In QR Ticket
- **Endpoint:** `GET /api/v1/bookings/{id}/qr-code`
- **Access:** Authenticated (Owner or Admin)
- **Response (`200 OK`):** Returns digital QR verification payload and human-readable reference.

### 4.2 Gate Barrier Arrival Check-In
- **Endpoint:** `POST /api/v1/bookings/{id}/check-in`
- **Access:** Authenticated (`ROLE_ADMIN` or authorized gate operator)
- **Request Body:**
```json
{
  "verificationMethod": "QR"
}
```
- **Response (`200 OK`):** Transitions booking to `ACTIVE` and creates `check_ins` record.

### 4.3 Gate Barrier Departure Check-Out
- **Endpoint:** `POST /api/v1/bookings/{id}/check-out`
- **Access:** Authenticated (`ROLE_ADMIN` or authorized gate operator)
- **Response (`200 OK`):** Transitions booking to `COMPLETED` and sets `check_out_time`.

---

## 5. Vehicle Endpoints (`/api/v1/vehicles`)

### 5.1 Register Vehicle
- **Endpoint:** `POST /api/v1/vehicles`
- **Access:** Authenticated
- **Request Body:**
```json
{
  "registrationNumber": "MH 12 AB 3456",
  "vehicleType": "CAR",
  "widthM": 1.80,
  "lengthM": 4.40,
  "isDefault": true
}
```
- **Response (`201 Created`):** Returns saved vehicle record with `normalizedRegistration: "MH12AB3456"`.

---

## 6. Administration Endpoints (`/api/v1/admin`)

### 6.1 Executive Dashboard Metrics
- **Endpoint:** `GET /api/v1/admin/dashboard`
- **Access:** `ROLE_ADMIN`
- **Response (`200 OK`):**
```json
{
  "totalFacilities": 4,
  "totalSlots": 108,
  "activeBookings": 0,
  "totalCompletedBookings": 9,
  "totalRevenueInr": 2100.00
}
```

### 6.2 Override Slot Maintenance Status
- **Endpoint:** `PUT /api/v1/admin/slots/{id}/status`
- **Access:** `ROLE_ADMIN`
- **Request Body:**
```json
{
  "status": "OUT_OF_SERVICE"
}
```
- **Response (`200 OK`):** Slot status updated in database.

### 6.3 Security Audit Trail Inspection
- **Endpoint:** `GET /api/v1/admin/audit-logs`
- **Access:** `ROLE_ADMIN`
- **Response (`200 OK`):** Recent audit records with actor IDs and action metadata.
