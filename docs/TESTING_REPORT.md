# SmartPark: Automated Testing & Verification Report
## Comprehensive Engineering Test Execution & Concurrency Defense Report

**Semester 3 Mini Project Documentation**  
**Build Tool:** Maven 3.9 / OpenJDK 21 LTS  
**Test Frameworks:** JUnit 5 (Jupiter), AssertJ, Spring Boot Test, Spring Security Test, Testcontainers  

---

## 1. Test Suite Executive Summary

The SmartPark backend is verified through an automated test suite comprising **48 automated unit, integration, and concurrency test cases** executing against a live PostgreSQL 16 database instance.

```
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  31.426 s
[INFO] Finished at: 2026-11-02T10:14:22+05:30
[INFO] ------------------------------------------------------------------------
[INFO] Results:
[INFO] Tests run: 48, Failures: 0, Errors: 0, Skipped: 0
```

| Metric | Measured Value | Standard / Target |
| :--- | :---: | :---: |
| **Total Test Suites** | **5** | All backend modules |
| **Total Automated Tests** | **48** | Complete coverage |
| **Passing Tests** | **48 (100%)** | 100% Pass Rate |
| **Failures / Errors** | **0 / 0** | Zero Regressions |
| **Skipped Tests** | **0** | No skipped tests |
| **Total Build Execution Time** | **~31.4 seconds** | Fast feedback loop |

---

## 2. Test Suite Breakdown by Domain Component

```
+---------------------------------------------------------------------------------------------------------+
|                                    AUTOMATED TEST SUITES SUMMARY                                        |
+------------------------------------+--------------------------+------------+----------+-----------------+
| Test Suite Class                   | Package                  | Tests Run  | Status   | Primary Focus   |
+------------------------------------+--------------------------+------------+----------+-----------------+
| SmartParkIntegrationTest.java      | com.smartpark            | 13         | PASS     | E2E, Auth, GiST |
| NoShowAndOverstayTest.java         | com.smartpark.booking    | 8          | PASS     | Lifecycle, V4   |
| AllocationServiceTest.java         | com.smartpark.booking    | 10         | PASS     | Vehicle Fit     |
| PricingServiceTest.java            | com.smartpark.pricing    | 7          | PASS     | Tariffs & Multi |
| FacilityPolicyTest.java            | com.smartpark.facility   | 10         | PASS     | Time Policies   |
+------------------------------------+--------------------------+------------+----------+-----------------+
| TOTAL                              |                          | 48         | 100%     | ALL PASS        |
+------------------------------------+--------------------------+------------+----------+-----------------+
```

---

## 3. Detailed Test Case Analysis

### 3.1 `SmartParkIntegrationTest.java` (13 Tests — End-to-End & Concurrency)
- `testUserRegistrationAndLogin()` — Verifies successful user signup, BCrypt hashing, and valid JWT token issuance.
- `testFailedLoginCounterAndLockout()` — Validates that 5 consecutive failed logins lock the user account for 15 minutes.
- `testBookingLifecycleFullFlow()` — Executes complete lifecycle: `PENDING -> CONFIRMED -> Check-In (ACTIVE) -> Check-Out (COMPLETED)`.
- `testBookingCancellationBeforeCutoff()` — Verifies successful user cancellation and database status update.
- `testBookingCancellationAfterCutoffFails()` — Confirms rejection when attempting to cancel past the allowed facility cutoff time.
- `testVehicleDimensionMatching()` — Verifies allocation logic rejects vehicles exceeding bay width or length.
- `testPricingCalculationHourlyAndDaily()` — Verifies that 2-hour and 24-hour bookings compute exact expected tariffs.
- `testAdminSlotMaintenanceOverride()` — Tests administrative endpoint toggling bay state to `OUT_OF_SERVICE`.
- `testAuditLogRecording()` — Confirms that booking mutations write structured records into `audit_logs`.
- `testIdorBookingAccessDenied()` — Verifies that User B cannot read or cancel User A's private booking record.
- `testRefreshTokenRotation()` — Confirms single-use refresh token exchange and invalidation.
- `testProfileUpdateAccessibilityFlag()` — Confirms customer can toggle accessibility assistance.
- **`testConcurrentDoubleBookingRaceCondition()`** — Multi-threaded concurrency stress test.

### 3.2 Concurrency Stress Test Validation
- **Objective:** Simulate a peak surge scenario where 10 concurrent HTTP threads submit reservations for the exact same parking slot and overlapping time window.
- **Execution:** Uses `java.util.concurrent.ExecutorService` and `CountDownLatch` to trigger all 10 requests simultaneously.
- **Assertion:**
  - Exactly **1** thread receives HTTP `201 Created` with a confirmed booking reference.
  - Exactly **9** threads receive HTTP `409 Conflict`.
  - Database row count in `bookings` for that slot and time range equals exactly **1**.
- **Result:** **PASSED.** The PostgreSQL GiST exclusion constraint (`excl_bookings_slot_time`) mathematically prevented any overlapping booking with SQLState `23P01`.

### 3.3 `NoShowAndOverstayTest.java` (8 Tests — Lifecycle Automation)
- `testNoShowDetectionAfterGracePeriod()` — Validates that unconfirmed drivers past 15-minute grace period transition to `NO_SHOW`.
- `testNoShowSlotLiberation()` — Confirms that slot previously reserved by no-show is immediately bookable by other drivers.
- `testOverstayDetectionWhenCheckoutMissed()` — Confirms active sessions past end time transition to `OVERSTAY`.
- `testOverstayFeeCalculation()` — Validates overstay hourly charge multiplied by $1.50\times$.
- `testAutomatedSlotReassignmentOnOverstay()` — Validates that downstream driver is automatically reallocated to a vacant bay.
- `testConflictRequiresAdminWhenFacilityFull()` — Validates escalation to `CONFLICT_REQUIRES_ADMIN` when no alternate slot is free.
- `testAdminConflictResolutionFlow()` — Validates manual slot reassignment by administrator.
- `testExpiredHoldSweeper()` — Validates temporary hold expiration after 15 minutes.

### 3.4 `AllocationServiceTest.java` (10 Tests — Bay Compatibility)
- Tests vehicle dimension checks (width, length), SUV exclusion from compact slots, EV charger priority, accessibility priority, and user self-overlap prevention.

### 3.5 `PricingServiceTest.java` (7 Tests — Tariff Engine)
- Tests hourly rate rounding, daily threshold rollover, flat rate calculation, overstay penalty multiplier, and unsupported duration rejection.

### 3.6 `FacilityPolicyTest.java` (10 Tests — Operating Window Validation)
- Tests operating hours validation, past timestamp rejection, minimum/maximum duration enforcement, and advance booking window limits.

---

## 4. Frontend Compilation & Build Verification

- **Build Tool:** Vite 7.3.7 & TypeScript Compiler (`tsc -b && vite build`)
- **Status:** **PASS (0 Errors / 0 Warnings)**
- **Verification Commands:**
  ```cmd
  cd frontend
  npm run build
  ```
- **Output:** Clean bundle generated in `frontend/dist/`.

---

## 5. How to Re-Run Tests

To execute tests independently:
```cmd
:: Run all backend unit & integration tests:
mvn test

:: Run specific concurrency stress test:
mvn test -Dtest=SmartParkIntegrationTest#testConcurrentDoubleBookingRaceCondition

:: Run lifecycle automation suite:
mvn test -Dtest=NoShowAndOverstayTest
```
