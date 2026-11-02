package com.smartpark.booking;

import com.smartpark.common.PageResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings")
public class BookingController {

    private final BookingService bookingService;
    private final BookingMapper mapper;

    public BookingController(BookingService bookingService, BookingMapper mapper) {
        this.bookingService = bookingService;
        this.mapper = mapper;
    }

    @PostMapping("/quote")
    public BookingDtos.QuoteResponse quote(@Valid @RequestBody BookingDtos.QuoteRequest request) {
        return bookingService.quote(request);
    }

    @PostMapping
    public ResponseEntity<BookingDtos.BookingView> create(
            @Valid @RequestBody BookingDtos.CreateBookingRequest request) {
        BookingDtos.BookingView booking = bookingService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/bookings/" + booking.id())).body(booking);
    }

    @GetMapping("/me")
    public PageResponse<BookingDtos.BookingView> mine(
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "startTime"));
        var result = bookingService.listMine(status, pageable);
        return PageResponse.from(result, b -> mapper.toView(b, false));
    }

    @GetMapping("/me/stats")
    public BookingDtos.BookingStats stats() {
        return bookingService.stats();
    }

    @GetMapping("/{id}")
    public BookingDtos.BookingView detail(@PathVariable UUID id) {
        return bookingService.getMine(id, true);
    }

    @PatchMapping("/{id}/reschedule")
    public BookingDtos.BookingView reschedule(@PathVariable UUID id,
                                              @Valid @RequestBody BookingDtos.RescheduleRequest request) {
        return bookingService.reschedule(id, request);
    }

    @PostMapping("/{id}/cancel")
    public BookingDtos.BookingView cancel(@PathVariable UUID id,
                                          @RequestBody(required = false) BookingDtos.CancelRequest request) {
        return bookingService.cancel(id, request == null ? null : request.reason());
    }

    @PostMapping("/{id}/check-in")
    public BookingDtos.BookingView checkIn(@PathVariable UUID id,
                                           @RequestBody(required = false) BookingDtos.CheckInRequest request) {
        return bookingService.checkIn(id, request == null ? null : request.token());
    }

    @PostMapping("/{id}/check-out")
    public BookingDtos.BookingView checkOut(@PathVariable UUID id) {
        return bookingService.checkOut(id);
    }
}
