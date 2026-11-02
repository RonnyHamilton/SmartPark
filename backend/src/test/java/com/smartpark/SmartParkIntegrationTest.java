package com.smartpark;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end API tests against a real PostgreSQL instance. The database is the same
 * engine (and the same Flyway migrations) used in development, so the exclusion
 * constraint, advisory locks and pricing queries are exercised for real.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class SmartParkIntegrationTest {

    private static final MediaType JSON = MediaType.APPLICATION_JSON;
    private static final String AUTH = "Authorization";
    private static final UUID AIRPORT = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final ZoneId FACILITY_ZONE = ZoneId.of("Asia/Kolkata");
    private static final String PASSWORD = "TestPass@12345";

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("smartpark_test")
                    .withUsername("smartpark")
                    .withPassword("smartpark_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("app.demo-data", () -> false);
        registry.add("app.mail-enabled", () -> false);
        registry.add("app.security.rate-limit-per-minute", () -> 1000);
        registry.add("management.health.mail.enabled", () -> false);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @LocalServerPort
    private int port;

    @Test
    void publicCatalogueIsReadableAndPrivateEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/facilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].name").exists());

        mockMvc.perform(get("/api/v1/facilities/" + AIRPORT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.facility.name").value("Airport Transit Hub"));

        mockMvc.perform(get("/api/v1/bookings/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void roleBasedAccessControlBlocksNonAdmins() throws Exception {
        Session user = register("rbac");

        mockMvc.perform(get("/api/v1/admin/analytics").header(AUTH, bearer(user.token())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(get("/api/v1/admin/bookings").header(AUTH, bearer(user.token())))
                .andExpect(status().isForbidden());
    }

    @Test
    void quoteUsesServerSidePricingAndAllocation() throws Exception {
        Session user = register("quote");
        Instant start = at(3, 10);

        String response = mockMvc.perform(post("/api/v1/bookings/quote")
                        .header(AUTH, bearer(user.token()))
                        .contentType(JSON)
                        .content(json(Map.of(
                                "facilityId", AIRPORT,
                                "vehicleId", user.vehicleId(),
                                "startTime", start.toString(),
                                "endTime", start.plusSeconds(7200).toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.priceExplanation").exists())
                .andExpect(jsonPath("$.allocation.slotCode").isNotEmpty())
                .andExpect(jsonPath("$.durationMinutes").value(120))
                .andReturn().getResponse().getContentAsString();

        JsonNode quote = objectMapper.readTree(response);
        assertThat(quote.path("estimatedPrice").decimalValue()).isEqualByComparingTo("160.00");
    }

    @Test
    void createAndCancelLifecycleWritesAuditTrail() throws Exception {
        Session user = register("lifecycle");
        Instant start = at(3, 12);
        JsonNode booking = createBooking(user, AIRPORT, start, start.plusSeconds(7200));

        String id = booking.path("id").asText();
        assertThat(booking.path("status").asText()).isEqualTo("CONFIRMED");
        assertThat(booking.path("bookingReference").asText()).startsWith("SP-");
        assertThat(booking.path("checkInToken").asText()).isNotBlank();
        assertThat(booking.path("priceAmount").decimalValue()).isEqualByComparingTo("160.00");

        mockMvc.perform(get("/api/v1/bookings/" + id).header(AUTH, bearer(user.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingReference").value(booking.path("bookingReference").asText()));

        mockMvc.perform(post("/api/v1/bookings/" + id + "/cancel")
                        .header(AUTH, bearer(user.token()))
                        .contentType(JSON)
                        .content(json(Map.of("reason", "Plans changed"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationReason").value("Plans changed"));

        mockMvc.perform(post("/api/v1/bookings/" + id + "/cancel")
                        .header(AUTH, bearer(user.token())))
                .andExpect(status().isConflict());

        Integer audits = jdbcTemplate.queryForObject(
                "select count(*) from audit_logs where resource_id = ? and action in ('BOOKING_CREATED','BOOKING_CANCELLED')",
                Integer.class, id);
        assertThat(audits).isEqualTo(2);
    }

    @Test
    void ownershipHidesOtherUsersBookings() throws Exception {
        Session owner = register("owner");
        Session stranger = register("stranger");
        Instant start = at(3, 14);
        JsonNode booking = createBooking(owner, AIRPORT, start, start.plusSeconds(7200));
        String id = booking.path("id").asText();

        mockMvc.perform(get("/api/v1/bookings/" + id).header(AUTH, bearer(stranger.token())))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/bookings/" + id + "/cancel").header(AUTH, bearer(stranger.token())))
                .andExpect(status().isNotFound());
    }

    @Test
    void overlappingReservationsForOneUserAreRejected() throws Exception {
        Session user = register("overlap");
        Instant start = at(4, 10);
        createBooking(user, AIRPORT, start, start.plusSeconds(7200));

        mockMvc.perform(post("/api/v1/bookings/quote")
                        .header(AUTH, bearer(user.token()))
                        .contentType(JSON)
                        .content(json(Map.of(
                                "facilityId", AIRPORT,
                                "vehicleId", user.vehicleId(),
                                "startTime", start.plusSeconds(1800).toString(),
                                "endTime", start.plusSeconds(5400).toString()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You already have a reservation that overlaps this period."));

        mockMvc.perform(post("/api/v1/bookings")
                        .header(AUTH, bearer(user.token()))
                        .contentType(JSON)
                        .content(json(Map.of(
                                "facilityId", AIRPORT,
                                "vehicleId", user.vehicleId(),
                                "startTime", start.plusSeconds(1800).toString(),
                                "endTime", start.plusSeconds(9000).toString()))))
                .andExpect(status().isConflict());

        // A back-to-back booking is not an overlap.
        Instant adjacent = start.plusSeconds(7200);
        assertThat(createBooking(user, AIRPORT, adjacent, adjacent.plusSeconds(7200)).path("status").asText())
                .isEqualTo("CONFIRMED");
    }

    @Test
    void rescheduleMovesTheBookingAndRecomputesPrice() throws Exception {
        Session user = register("reschedule");
        Instant first = at(3, 16);
        JsonNode booking = createBooking(user, AIRPORT, first, first.plusSeconds(3600));
        String id = booking.path("id").asText();
        assertThat(booking.path("priceAmount").decimalValue()).isEqualByComparingTo("80.00");

        Instant second = at(4, 16);
        String response = mockMvc.perform(patch("/api/v1/bookings/" + id + "/reschedule")
                        .header(AUTH, bearer(user.token()))
                        .contentType(JSON)
                        .content(json(Map.of(
                                "startTime", second.toString(),
                                "endTime", second.plusSeconds(7200).toString()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode updated = objectMapper.readTree(response);
        assertThat(updated.path("priceAmount").decimalValue()).isEqualByComparingTo("160.00");
        assertThat(Instant.parse(updated.path("startTime").asText())).isEqualTo(second);
        assertThat(Instant.parse(updated.path("endTime").asText())).isEqualTo(second.plusSeconds(7200));
    }

    @Test
    void validationErrorsAreStructuredAndLockoutProtectsAccounts() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(JSON)
                        .content(json(Map.of("name", "Weak User", "email", uniqueEmail("weak"),
                                "password", "short"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.password").exists());

        Session user = register("lockout");
        for (int attempt = 1; attempt <= 5; attempt++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(JSON)
                            .content(json(Map.of("email", user.email(), "password", "WrongPass@12345"))))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(JSON)
                        .content(json(Map.of("email", user.email(), "password", PASSWORD))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void refreshTokenRotationDetectsReplayAndSetsHardenedCookie() throws Exception {
        Session user = register("refresh");
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(JSON)
                        .content(json(Map.of("email", user.email(), "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();

        String setCookie = login.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie)
                .contains("smartpark_refresh=")
                .contains("HttpOnly")
                .contains("SameSite=Strict")
                .contains("Path=/api/v1/auth");
        String firstRefresh = cookieValue(setCookie);

        MvcResult rotated = mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new Cookie("smartpark_refresh", firstRefresh)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();
        String secondRefresh = cookieValue(rotated.getResponse().getHeader(HttpHeaders.SET_COOKIE));
        assertThat(secondRefresh).isNotEqualTo(firstRefresh);

        // Replaying the rotated token revokes the whole token family.
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new Cookie("smartpark_refresh", firstRefresh)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new Cookie("smartpark_refresh", secondRefresh)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void disallowedOriginsAreRejectedOnCredentialEndpoints() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("Origin", "https://evil.example")
                        .contentType(JSON)
                        .content(json(Map.of("email", "nobody@smartpark.test", "password", PASSWORD))))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminSearchEndpointsWorkWithFilters() throws Exception {
        String adminEmail = uniqueEmail("admin");
        jdbcTemplate.update("insert into users (name, email, password_hash, role) values (?, ?, ?, 'ADMIN')",
                "Test Admin", adminEmail, passwordEncoder.encode(PASSWORD));

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(JSON)
                        .content(json(Map.of("email", adminEmail, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(login.getResponse().getContentAsString())
                .path("accessToken").asText();

        mockMvc.perform(get("/api/v1/admin/bookings?search=SP-&size=5").header(AUTH, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        mockMvc.perform(get("/api/v1/admin/users?q=admin&size=5").header(AUTH, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        mockMvc.perform(get("/api/v1/admin/audit?size=5").header(AUTH, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        mockMvc.perform(get("/api/v1/admin/analytics").header(AUTH, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalFacilities").isNumber());
    }

    @Test
    void concurrentRequestsCannotDoubleBookTheLastSlot() throws Exception {
        Fixture fixture = createSingleSlotFacility("Race Deck");
        Session first = register("race-a");
        Session second = register("race-b");
        Instant start = at(5, 10);
        Instant end = start.plusSeconds(7200);

        String url = "http://localhost:" + port + "/api/v1/bookings";
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> a = racer(url, first, fixture.facilityId(), start, end, ready, go);
            Callable<Integer> b = racer(url, second, fixture.facilityId(), start, end, ready, go);
            Future<Integer> firstResult = pool.submit(a);
            Future<Integer> secondResult = pool.submit(b);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            go.countDown();

            List<Integer> statuses = new ArrayList<>(List.of(
                    firstResult.get(30, TimeUnit.SECONDS),
                    secondResult.get(30, TimeUnit.SECONDS)));

            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        } finally {
            pool.shutdownNow();
        }

        Integer liveBookings = jdbcTemplate.queryForObject("""
                select count(*) from bookings b
                join parking_slots s on s.id = b.slot_id
                join parking_floors f on f.id = s.floor_id
                where f.facility_id = ? and b.status in ('PENDING','CONFIRMED','ACTIVE')
                """, Integer.class, fixture.facilityId());
        assertThat(liveBookings).isEqualTo(1);
    }

    @Test
    void databaseExclusionConstraintIsAuthoritative() throws Exception {
        Fixture fixture = createSingleSlotFacility("Constraint Deck");
        Session first = register("constraint-a");
        Session second = register("constraint-b");
        Instant start = at(6, 10);
        Instant end = start.plusSeconds(7200);

        insertBooking(fixture.slotId(), first, start, end, "CONFIRMED");

        assertThatThrownBy(() -> insertBooking(fixture.slotId(), second, start.plusSeconds(1800),
                end.plusSeconds(1800), "CONFIRMED"))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> insertBooking(fixture.slotId(), second, start, end, "PENDING"))
                .isInstanceOf(DataIntegrityViolationException.class);

        // Non-live statuses are excluded from the constraint.
        assertThat(insertBooking(fixture.slotId(), second, start, end, "CANCELLED")).isEqualTo(1);
        assertThat(insertBooking(fixture.slotId(), second, start, end, "COMPLETED")).isEqualTo(1);

        // Adjacent windows are allowed because the range is half-open.
        assertThat(insertBooking(fixture.slotId(), second, end, end.plusSeconds(3600), "CONFIRMED"))
                .isEqualTo(1);
    }

    private Callable<Integer> racer(String url, Session session, UUID facilityId, Instant start, Instant end,
                                    CountDownLatch ready, CountDownLatch go) {
        return () -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(JSON);
            headers.setBearerAuth(session.token());
            String body = json(Map.of(
                    "facilityId", facilityId,
                    "vehicleId", session.vehicleId(),
                    "startTime", start.toString(),
                    "endTime", end.toString()));
            ready.countDown();
            go.await(10, TimeUnit.SECONDS);
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            return response.getStatusCode().value();
        };
    }

    private Session register(String label) throws Exception {
        String email = uniqueEmail(label);
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(JSON)
                        .content(json(Map.of("name", "Test " + label, "email", email, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String token = body.path("accessToken").asText();
        UUID userId = UUID.fromString(body.path("user").path("id").asText());

        MvcResult vehicle = mockMvc.perform(post("/api/v1/vehicles")
                        .header(AUTH, bearer(token))
                        .contentType(JSON)
                        .content(json(Map.of(
                                "registrationNumber", "MH12" + UUID.randomUUID().toString()
                                        .replace("-", "").substring(0, 6).toUpperCase(),
                                "vehicleType", "CAR",
                                "isDefault", true))))
                .andExpect(status().isCreated())
                .andReturn();
        UUID vehicleId = UUID.fromString(objectMapper.readTree(vehicle.getResponse().getContentAsString())
                .path("id").asText());
        return new Session(email, userId, vehicleId, token);
    }

    private JsonNode createBooking(Session session, UUID facilityId, Instant start, Instant end) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/bookings")
                        .header(AUTH, bearer(session.token()))
                        .contentType(JSON)
                        .content(json(Map.of(
                                "facilityId", facilityId,
                                "vehicleId", session.vehicleId(),
                                "startTime", start.toString(),
                                "endTime", end.toString()))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private Fixture createSingleSlotFacility(String name) {
        UUID facilityId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID slotId = UUID.randomUUID();

        jdbcTemplate.update("""
                insert into facilities (id, name, description, address, city, timezone, opens_at, closes_at,
                                        operating_days, amenities, status, min_duration_minutes,
                                        max_duration_minutes, advance_booking_days,
                                        cancellation_cutoff_minutes, buffer_minutes)
                values (?, ?, '', 'Test Road', 'Pune', 'Asia/Kolkata', '00:00'::time, '23:59'::time,
                        'MON,TUE,WED,THU,FRI,SAT,SUN', '{}'::text[], 'ACTIVE', 30, 720, 30, 0, 0)
                """, facilityId, name);
        jdbcTemplate.update("""
                insert into parking_floors (id, facility_id, name, floor_number, display_order)
                values (?, ?, 'Ground', 0, 0)
                """, floorId, facilityId);
        jdbcTemplate.update("""
                insert into parking_slots (id, floor_id, slot_code, slot_type, supported_vehicle_types,
                                           is_accessible, has_ev_charger, status)
                values (?, ?, 'C-01', 'STANDARD', '{CAR,SUV}'::text[], false, false, 'AVAILABLE')
                """, slotId, floorId);
        jdbcTemplate.update("""
                insert into pricing_rules (facility_id, rate_type, amount, minimum_duration_minutes,
                                           maximum_duration_minutes, effective_from, active)
                values (?, 'HOURLY', 50.00, 30, 720, CURRENT_DATE, true)
                """, facilityId);

        return new Fixture(facilityId, slotId);
    }

    private int insertBooking(UUID slotId, Session session, Instant start, Instant end, String status) {
        String reference = "T-" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 12).toUpperCase();
        return jdbcTemplate.update("""
                insert into bookings (booking_reference, user_id, slot_id, vehicle_id, start_time, end_time,
                                      status, price_amount, currency)
                values (?, ?, ?, ?, ?, ?, ?, ?, 'INR')
                """, reference, session.userId(), slotId, session.vehicleId(),
                Timestamp.from(start), Timestamp.from(end), status, new BigDecimal("50.00"));
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private static String uniqueEmail(String label) {
        return label + "-" + UUID.randomUUID().toString().substring(0, 8) + "@smartpark.test";
    }

    private static String cookieValue(String setCookie) {
        assertThat(setCookie).isNotNull();
        int start = setCookie.indexOf('=') + 1;
        int end = setCookie.indexOf(';');
        return setCookie.substring(start, end);
    }

    private static Instant at(int daysAhead, int hour) {
        return ZonedDateTime.now(FACILITY_ZONE)
                .plusDays(daysAhead)
                .withHour(hour).withMinute(0).withSecond(0).withNano(0)
                .toInstant();
    }

    private record Session(String email, UUID userId, UUID vehicleId, String token) {}

    private record Fixture(UUID facilityId, UUID slotId) {}
}
