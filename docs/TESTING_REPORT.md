# SmartPark: Automated Testing & Verification Report

## 1. Test Suite Overview

The SmartPark backend includes comprehensive automated test suites designed to validate domain business logic, Spring Security authorization policies, data validation, and concurrent reservation collisions under load.

- **Test Framework:** JUnit 5 (Jupiter), AssertJ, Spring Boot Test, Spring Security Test.
- **Execution Date:** 2026-11-01
- **Target Database Environment:** PostgreSQL 16 TestContainer / Shared Docker PostgreSQL Instance.

---

## 2. Test Execution Summary

```
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  29.578 s
[INFO] Finished at: 2026-11-01T18:20:33+05:30
[INFO] ------------------------------------------------------------------------
[INFO] Results:
[INFO] Tests run: 40, Failures: 0, Errors: 0, Skipped: 0
```

| Metric | Result |
| :--- | :--- |
| **Total Automated Tests** | **40** |
| **Passed Tests** | **40 (100%)** |
| **Failures** | **0** |
| **Errors** | **0** |
| **Skipped** | **0** |
| **Total Test Execution Time**| **29.58 seconds** |

---

## 3. Test Cases Breakdown by Component

### 3.1 `SmartParkIntegrationTest.java` (End-to-End Integration Suite)
1. `testUserRegistrationAndLogin()` — Verifies successful user signup, BCrypt hashing, and valid JWT token issuance.
2. `testFailedLoginCounterAndLockout()` — Validates that 5 consecutive failed logins lock the user account and reject further attempts.
3. `testBookingLifecycleFullFlow()` — Executes `PENDING -> CONFIRMED -> Check-In (ACTIVE) -> Check-Out (COMPLETED)`.
4. `testBookingCancellationBeforeCutoff()` — Verifies successful user cancellation and database status update.
5. `testBookingCancellationAfterCutoffFails()` — Confirms rejection when attempting to cancel past the allowed facility cutoff time.
6. `testVehicleDimensionMatching()` — Verifies allocation logic rejects vehicles exceeding bay width or length.
7. `testPricingCalculationHourlyAndDaily()` — Verifies that 2-hour and 24-hour bookings compute exact expected tariffs.
8. `testAdminSlotMaintenanceOverride()` — Tests administrative endpoint toggling bay state to `OUT_OF_SERVICE`.
9. `testAuditLogRecording()` — Confirms that booking mutations write structured records into `audit_logs`.
10. `testIdorBookingAccessDenied()` — Verifies that User B cannot read or cancel User A's private booking record.
11. `testConcurrentDoubleBookingRaceCondition()` — Multi-threaded concurrency stress test.

### 3.2 Concurrency Stress Test Details
- **Objective:** Simulate a surge scenario where 10 concurrent HTTP threads submit reservations for the exact same parking slot and overlapping time window.
- **Execution:** Uses `java.util.concurrent.ExecutorService` and `CountDownLatch` to trigger all 10 requests simultaneously.
- **Assertion:**
  - Exactly **1** thread receives HTTP `201 Created` with a confirmed booking reference.
  - Exactly **9** threads receive HTTP `409 Conflict`.
  - Database row count in `bookings` for that slot and time range equals exactly **1**.
- **Result:** **PASSED.** The PostgreSQL GiST exclusion constraint (`excl_bookings_slot_time`) mathematically prevented any overlapping booking.

---

## 4. Frontend Verification

- **Build Verification Tool:** Vite 7.3.7 & TypeScript Compiler (`tsc -b && vite build`)
- **Status:** **PASS**
- **Output:** Clean build with 0 TypeScript diagnostics or bundling errors. Generated production assets in `frontend/dist/`.
- **Responsive Layout:** Tested across desktop (1920x1080), laptop (1366x768), and mobile (390x844) viewport dimensions.

---

## 5. How to Re-Run Tests
To verify test results independently at any time:
```cmd
:: Run all backend unit & integration tests:
powershell -Command "& 'C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.2\plugins\maven\lib\maven3\bin\mvn.cmd' test"

:: Verify frontend TypeScript compilation & build:
cd frontend
npm run build
```
