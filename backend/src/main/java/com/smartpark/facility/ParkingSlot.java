package com.smartpark.facility;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "parking_slots")
public class ParkingSlot {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "floor_id", nullable = false)
    private ParkingFloor floor;

    @Column(name = "slot_code", nullable = false, length = 20)
    private String slotCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "slot_type", nullable = false, length = 20)
    private SlotType slotType;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "supported_vehicle_types", nullable = false, columnDefinition = "text[]")
    private List<String> supportedVehicleTypes = new ArrayList<>();

    @Column(name = "is_accessible", nullable = false)
    private boolean accessible;

    @Column(name = "has_ev_charger", nullable = false)
    private boolean hasEvCharger;

    @Column(name = "width_m", nullable = false, precision = 4, scale = 2)
    private BigDecimal widthM = new BigDecimal("2.50");

    @Column(name = "length_m", nullable = false, precision = 4, scale = 2)
    private BigDecimal lengthM = new BigDecimal("5.00");

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SlotStatus status = SlotStatus.AVAILABLE;

    @Column(name = "layout_x")
    private Integer layoutX;

    @Column(name = "layout_y")
    private Integer layoutY;

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
    public ParkingFloor getFloor() { return floor; }
    public void setFloor(ParkingFloor floor) { this.floor = floor; }
    public String getSlotCode() { return slotCode; }
    public void setSlotCode(String slotCode) { this.slotCode = slotCode; }
    public SlotType getSlotType() { return slotType; }
    public void setSlotType(SlotType slotType) { this.slotType = slotType; }
    public List<String> getSupportedVehicleTypes() { return supportedVehicleTypes; }
    public void setSupportedVehicleTypes(List<String> supportedVehicleTypes) { this.supportedVehicleTypes = supportedVehicleTypes; }
    public boolean isAccessible() { return accessible; }
    public void setAccessible(boolean accessible) { this.accessible = accessible; }
    public boolean isHasEvCharger() { return hasEvCharger; }
    public void setHasEvCharger(boolean hasEvCharger) { this.hasEvCharger = hasEvCharger; }
    public BigDecimal getWidthM() { return widthM; }
    public void setWidthM(BigDecimal widthM) { this.widthM = widthM; }
    public BigDecimal getLengthM() { return lengthM; }
    public void setLengthM(BigDecimal lengthM) { this.lengthM = lengthM; }
    public SlotStatus getStatus() { return status; }
    public void setStatus(SlotStatus status) { this.status = status; }
    public Integer getLayoutX() { return layoutX; }
    public void setLayoutX(Integer layoutX) { this.layoutX = layoutX; }
    public Integer getLayoutY() { return layoutY; }
    public void setLayoutY(Integer layoutY) { this.layoutY = layoutY; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
