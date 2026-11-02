package com.smartpark.booking;

public enum BookingStatus {
    PENDING,
    CONFIRMED,
    ACTIVE,
    OVERSTAY,
    NO_SHOW,
    COMPLETED,
    CANCELLED,
    EXPIRED,
    CONFLICT_REQUIRES_ADMIN;

    /**
     * Indicates whether this booking holds a reservation on its assigned slot.
     */
    public boolean holdsSlot() {
        return this == PENDING
                || this == CONFIRMED
                || this == ACTIVE
                || this == OVERSTAY
                || this == CONFLICT_REQUIRES_ADMIN;
    }

    /**
     * Indicates whether a physical vehicle is currently occupying the slot.
     */
    public boolean isPhysicalOccupancy() {
        return this == ACTIVE || this == OVERSTAY;
    }
}
