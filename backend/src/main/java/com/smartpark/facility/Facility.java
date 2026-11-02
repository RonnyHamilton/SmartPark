package com.smartpark.facility;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "facilities")
public class Facility {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false, length = 120)
    private String city;

    private BigDecimal latitude;
    private BigDecimal longitude;

    @Column(nullable = false, length = 64)
    private String timezone = "Asia/Kolkata";

    @Column(name = "opens_at", nullable = false)
    private LocalTime opensAt;

    @Column(name = "closes_at", nullable = false)
    private LocalTime closesAt;

    @Column(name = "operating_days", nullable = false, length = 40)
    private String operatingDays = "MON,TUE,WED,THU,FRI,SAT,SUN";

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "amenities", nullable = false, columnDefinition = "text[]")
    private List<String> amenities = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FacilityStatus status = FacilityStatus.ACTIVE;

    @Column(name = "min_duration_minutes", nullable = false)
    private int minDurationMinutes = 60;

    @Column(name = "max_duration_minutes", nullable = false)
    private int maxDurationMinutes = 720;

    @Column(name = "advance_booking_days", nullable = false)
    private int advanceBookingDays = 30;

    @Column(name = "cancellation_cutoff_minutes", nullable = false)
    private int cancellationCutoffMinutes = 60;

    @Column(name = "buffer_minutes", nullable = false)
    private int bufferMinutes = 15;

    @Column(name = "check_in_grace_period_minutes", nullable = false)
    private int checkInGracePeriodMinutes = 15;

    @Column(name = "overstay_multiplier", nullable = false, precision = 4, scale = 2)
    private BigDecimal overstayMultiplier = new BigDecimal("1.50");

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public LocalTime getOpensAt() { return opensAt; }
    public void setOpensAt(LocalTime opensAt) { this.opensAt = opensAt; }
    public LocalTime getClosesAt() { return closesAt; }
    public void setClosesAt(LocalTime closesAt) { this.closesAt = closesAt; }
    public String getOperatingDays() { return operatingDays; }
    public void setOperatingDays(String operatingDays) { this.operatingDays = operatingDays; }
    public List<String> getAmenities() { return amenities; }
    public void setAmenities(List<String> amenities) { this.amenities = amenities; }
    public FacilityStatus getStatus() { return status; }
    public void setStatus(FacilityStatus status) { this.status = status; }
    public int getMinDurationMinutes() { return minDurationMinutes; }
    public void setMinDurationMinutes(int minDurationMinutes) { this.minDurationMinutes = minDurationMinutes; }
    public int getMaxDurationMinutes() { return maxDurationMinutes; }
    public void setMaxDurationMinutes(int maxDurationMinutes) { this.maxDurationMinutes = maxDurationMinutes; }
    public int getAdvanceBookingDays() { return advanceBookingDays; }
    public void setAdvanceBookingDays(int advanceBookingDays) { this.advanceBookingDays = advanceBookingDays; }
    public int getCancellationCutoffMinutes() { return cancellationCutoffMinutes; }
    public void setCancellationCutoffMinutes(int cancellationCutoffMinutes) { this.cancellationCutoffMinutes = cancellationCutoffMinutes; }
    public int getBufferMinutes() { return bufferMinutes; }
    public void setBufferMinutes(int bufferMinutes) { this.bufferMinutes = bufferMinutes; }
    public int getCheckInGracePeriodMinutes() { return checkInGracePeriodMinutes; }
    public void setCheckInGracePeriodMinutes(int checkInGracePeriodMinutes) { this.checkInGracePeriodMinutes = checkInGracePeriodMinutes; }
    public BigDecimal getOverstayMultiplier() { return overstayMultiplier; }
    public void setOverstayMultiplier(BigDecimal overstayMultiplier) { this.overstayMultiplier = overstayMultiplier; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
