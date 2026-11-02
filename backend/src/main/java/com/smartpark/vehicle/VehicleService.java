package com.smartpark.vehicle;

import com.smartpark.booking.BookingRepository;
import com.smartpark.common.BadRequestException;
import com.smartpark.common.ConflictException;
import com.smartpark.common.NotFoundException;
import com.smartpark.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final BookingRepository bookingRepository;
    private final CurrentUser currentUser;

    public VehicleService(VehicleRepository vehicleRepository, BookingRepository bookingRepository,
                          CurrentUser currentUser) {
        this.vehicleRepository = vehicleRepository;
        this.bookingRepository = bookingRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<VehicleDtos.VehicleView> list() {
        return vehicleRepository.findByUserIdOrderByCreatedAtAsc(currentUser.id()).stream()
                .map(VehicleDtos.VehicleView::from).toList();
    }

    @Transactional
    public VehicleDtos.VehicleView create(VehicleDtos.VehicleRequest request) {
        var user = currentUser.entity();
        if (vehicleRepository.countByUserId(user.getId()) >= 10) {
            throw new BadRequestException("You can save up to 10 vehicles.");
        }
        String normalized = normalize(request.registrationNumber());
        if (vehicleRepository.existsByUserIdAndNormalizedRegistration(user.getId(), normalized)) {
            throw new ConflictException("That vehicle is already saved on your account.");
        }
        Vehicle vehicle = new Vehicle();
        vehicle.setUser(user);
        apply(vehicle, request, normalized);
        boolean first = vehicleRepository.countByUserId(user.getId()) == 0;
        vehicle.setDefault(first || Boolean.TRUE.equals(request.isDefault()));
        if (vehicle.isDefault()) {
            clearDefaultExcept(user.getId(), null);
        }
        vehicleRepository.save(vehicle);
        return VehicleDtos.VehicleView.from(vehicle);
    }

    @Transactional
    public VehicleDtos.VehicleView update(UUID id, VehicleDtos.VehicleRequest request) {
        Vehicle vehicle = vehicleRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Vehicle not found."));
        String normalized = normalize(request.registrationNumber());
        if (vehicleRepository.existsByUserIdAndNormalizedRegistrationAndIdNot(
                currentUser.id(), normalized, id)) {
            throw new ConflictException("That registration number is already saved.");
        }
        apply(vehicle, request, normalized);
        if (Boolean.TRUE.equals(request.isDefault())) {
            clearDefaultExcept(currentUser.id(), id);
            vehicle.setDefault(true);
        }
        vehicleRepository.save(vehicle);
        return VehicleDtos.VehicleView.from(vehicle);
    }

    @Transactional
    public void delete(UUID id) {
        Vehicle vehicle = vehicleRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Vehicle not found."));
        if (bookingRepository.existsByVehicleId(id)) {
            throw new ConflictException("This vehicle is linked to booking history and cannot be deleted. "
                    + "Add another vehicle instead.");
        }
        vehicleRepository.delete(vehicle);
    }

    private void apply(Vehicle vehicle, VehicleDtos.VehicleRequest request, String normalized) {
        vehicle.setRegistrationNumber(request.registrationNumber().trim().toUpperCase(Locale.ROOT));
        vehicle.setNormalizedRegistration(normalized);
        vehicle.setVehicleType(request.vehicleType());
        vehicle.setWidthM(request.widthM());
        vehicle.setLengthM(request.lengthM());
    }

    private void clearDefaultExcept(UUID userId, UUID keepId) {
        vehicleRepository.findByUserIdOrderByCreatedAtAsc(userId).forEach(v -> {
            if (v.isDefault() && (keepId == null || !v.getId().equals(keepId))) {
                v.setDefault(false);
                vehicleRepository.save(v);
            }
        });
    }

    private String normalize(String registration) {
        return registration.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }
}
