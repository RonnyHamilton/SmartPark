package com.smartpark.admin;

import com.smartpark.booking.Booking;
import com.smartpark.booking.BookingDtos;
import com.smartpark.booking.BookingMapper;
import com.smartpark.booking.BookingRepository;
import com.smartpark.booking.BookingService;
import com.smartpark.booking.BookingStatus;
import com.smartpark.common.PageResponse;
import com.smartpark.facility.FacilityDtos;
import com.smartpark.facility.FacilityService;
import com.smartpark.facility.ParkingFloor;
import com.smartpark.facility.ParkingSlot;
import com.smartpark.facility.SlotType;
import com.smartpark.pricing.PricingRule;
import com.smartpark.vehicle.VehicleType;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final FacilityService facilityService;
    private final BookingService bookingService;
    private final BookingRepository bookingRepository;
    private final BookingMapper bookingMapper;

    public AdminController(AdminService adminService, FacilityService facilityService,
                           BookingService bookingService, BookingRepository bookingRepository,
                           BookingMapper bookingMapper) {
        this.adminService = adminService;
        this.facilityService = facilityService;
        this.bookingService = bookingService;
        this.bookingRepository = bookingRepository;
        this.bookingMapper = bookingMapper;
    }

    @GetMapping("/analytics")
    public AdminDtos.AnalyticsResponse analytics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return adminService.analytics(from, to);
    }

    // Facilities

    @GetMapping("/facilities")
    public List<FacilityDtos.FacilitySummary> facilities() {
        return facilityService.listAllForAdmin();
    }

    @GetMapping("/facilities/{id}")
    public FacilityDtos.FacilityDetail facility(@PathVariable UUID id) {
        return facilityService.detail(id, true);
    }

    @PostMapping("/facilities")
    public ResponseEntity<FacilityDtos.FacilitySummary> createFacility(
            @Valid @RequestBody AdminDtos.FacilityRequest request) {
        var facility = adminService.createFacility(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(facilityService.detail(facility.getId(), true).facility());
    }

    @PatchMapping("/facilities/{id}")
    public FacilityDtos.FacilitySummary updateFacility(@PathVariable UUID id,
                                                       @Valid @RequestBody AdminDtos.FacilityRequest request) {
        adminService.updateFacility(id, request);
        return facilityService.detail(id, true).facility();
    }

    @DeleteMapping("/facilities/{id}")
    public ResponseEntity<Void> deleteFacility(@PathVariable UUID id) {
        adminService.deleteFacility(id);
        return ResponseEntity.noContent().build();
    }

    // Floors

    @PostMapping("/facilities/{facilityId}/floors")
    public ResponseEntity<FacilityDtos.FloorView> createFloor(@PathVariable UUID facilityId,
                                                              @Valid @RequestBody AdminDtos.FloorRequest request) {
        ParkingFloor floor = adminService.createFloor(facilityId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new FacilityDtos.FloorView(floor.getId(),
                floor.getName(), floor.getFloorNumber(), floor.getDisplayOrder(), List.of()));
    }

    @PatchMapping("/floors/{id}")
    public FacilityDtos.FloorView updateFloor(@PathVariable UUID id,
                                              @Valid @RequestBody AdminDtos.FloorRequest request) {
        ParkingFloor floor = adminService.updateFloor(id, request);
        return new FacilityDtos.FloorView(floor.getId(), floor.getName(), floor.getFloorNumber(),
                floor.getDisplayOrder(), List.of());
    }

    @DeleteMapping("/floors/{id}")
    public ResponseEntity<Void> deleteFloor(@PathVariable UUID id) {
        adminService.deleteFloor(id);
        return ResponseEntity.noContent().build();
    }

    // Slots

    @PostMapping("/floors/{floorId}/slots")
    public ResponseEntity<FacilityDtos.SlotView> createSlot(@PathVariable UUID floorId,
                                                            @Valid @RequestBody AdminDtos.SlotRequest request) {
        ParkingSlot slot = adminService.createSlot(floorId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(FacilityDtos.SlotView.from(slot));
    }

    @PatchMapping("/slots/{id}")
    public FacilityDtos.SlotView updateSlot(@PathVariable UUID id,
                                            @Valid @RequestBody AdminDtos.SlotRequest request) {
        return FacilityDtos.SlotView.from(adminService.updateSlot(id, request));
    }

    @DeleteMapping("/slots/{id}")
    public ResponseEntity<Void> deleteSlot(@PathVariable UUID id) {
        adminService.deleteSlot(id);
        return ResponseEntity.noContent().build();
    }

    // Pricing

    @PostMapping("/facilities/{facilityId}/pricing")
    public ResponseEntity<FacilityDtos.PricingRuleView> createPricing(
            @PathVariable UUID facilityId, @Valid @RequestBody AdminDtos.PricingRequest request) {
        PricingRule rule = adminService.createPricing(facilityId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(facilityService.ruleView(rule));
    }

    @PatchMapping("/pricing/{id}")
    public FacilityDtos.PricingRuleView updatePricing(@PathVariable UUID id,
                                                      @Valid @RequestBody AdminDtos.PricingRequest request) {
        return facilityService.ruleView(adminService.updatePricing(id, request));
    }

    @DeleteMapping("/pricing/{id}")
    public ResponseEntity<Void> deletePricing(@PathVariable UUID id) {
        adminService.deletePricing(id);
        return ResponseEntity.noContent().build();
    }

    // Bookings

    @GetMapping("/bookings")
    public PageResponse<BookingDtos.BookingView> bookings(
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Booking> result = bookingRepository.adminSearch(status, facilityId,
                search == null || search.isBlank() ? null : search.trim(), pageable);
        return PageResponse.from(result, b -> bookingMapper.toView(b, false));
    }

    @GetMapping("/bookings/{id}")
    public BookingDtos.BookingView booking(@PathVariable UUID id) {
        return bookingService.getMine(id, false);
    }

    @PostMapping("/bookings/{id}/cancel")
    public BookingDtos.BookingView cancelBooking(@PathVariable UUID id,
                                                 @RequestBody(required = false) BookingDtos.CancelRequest request) {
        return bookingService.cancel(id, request == null ? null : request.reason());
    }

    @GetMapping("/overstay-dashboard")
    public AdminDtos.OverstayDashboardView overstayDashboard() {
        return bookingService.getOverstayDashboard();
    }

    @PostMapping("/bookings/{id}/resolve-conflict")
    public BookingDtos.BookingView resolveConflict(
            @PathVariable UUID id,
            @RequestBody(required = false) BookingDtos.ResolveConflictRequest request) {
        return bookingService.resolveConflict(id,
                request == null ? null : request.newSlotId(),
                request == null ? null : request.resolutionNotes());
    }

    // Users

    @GetMapping("/users")
    public PageResponse<AdminDtos.UserView> users(@RequestParam(required = false) String q,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.from(adminService.users(q, pageable), AdminDtos.UserView::from);
    }

    @PatchMapping("/users/{id}/status")
    public AdminDtos.UserView setUserStatus(@PathVariable UUID id,
                                            @Valid @RequestBody AdminDtos.UserStatusRequest request) {
        return AdminDtos.UserView.from(adminService.setUserStatus(id, request.status()));
    }

    @PatchMapping("/users/{id}/role")
    public AdminDtos.UserView setUserRole(@PathVariable UUID id,
                                          @Valid @RequestBody AdminDtos.UserRoleRequest request) {
        return AdminDtos.UserView.from(adminService.setUserRole(id, request.role()));
    }

    @GetMapping("/audit")
    public PageResponse<AdminDtos.AuditView> audit(@RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "30") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        return PageResponse.from(adminService.auditLogs(pageable));
    }

    @GetMapping("/meta")
    public Meta meta() {
        return new Meta(SlotType.values(), VehicleType.values(), BookingStatus.values());
    }

    public record Meta(SlotType[] slotTypes, VehicleType[] vehicleTypes, BookingStatus[] bookingStatuses) {}
}
