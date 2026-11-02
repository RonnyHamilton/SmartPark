package com.smartpark.vehicle;

import com.smartpark.vehicle.VehicleType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class VehicleDtos {

    private VehicleDtos() {}

    public record VehicleRequest(
            @NotNull(message = "Registration number is required")
            @Size(min = 4, max = 20, message = "Registration number must be 4–20 characters")
            @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9 -]{2,18}[A-Za-z0-9]$",
                    message = "Use letters, numbers, spaces or hyphens only")
            String registrationNumber,

            @NotNull(message = "Vehicle type is required")
            VehicleType vehicleType,

            @DecimalMin(value = "0.5", message = "Width must be at least 0.5 m")
            @DecimalMax(value = "5.0", message = "Width must be at most 5 m")
            BigDecimal widthM,

            @DecimalMin(value = "0.5", message = "Length must be at least 0.5 m")
            @DecimalMax(value = "15.0", message = "Length must be at most 15 m")
            BigDecimal lengthM,

            Boolean isDefault
    ) {}

    public record VehicleView(
            UUID id,
            String registrationNumber,
            String vehicleType,
            BigDecimal widthM,
            BigDecimal lengthM,
            boolean isDefault,
            Instant createdAt
    ) {
        public static VehicleView from(Vehicle v) {
            return new VehicleView(v.getId(), v.getRegistrationNumber(), v.getVehicleType().name(),
                    v.getWidthM(), v.getLengthM(), v.isDefault(), v.getCreatedAt());
        }
    }
}
