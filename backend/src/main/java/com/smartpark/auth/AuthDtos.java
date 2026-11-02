package com.smartpark.auth;

import com.smartpark.user.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Name is required")
            @Size(min = 2, max = 120, message = "Name must be between 2 and 120 characters")
            String name,

            @NotBlank(message = "Email is required")
            @Email(message = "Enter a valid email address")
            @Size(max = 255)
            String email,

            @NotBlank(message = "Password is required")
            @Size(min = 10, max = 72, message = "Password must be between 10 and 72 characters")
            @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
                    message = "Password must include upper-case, lower-case and numeric characters")
            String password
    ) {}

    public record LoginRequest(
            @NotBlank(message = "Email is required")
            @Email(message = "Enter a valid email address")
            String email,

            @NotBlank(message = "Password is required")
            @Size(max = 72)
            String password
    ) {}

    public record UserView(
            UUID id,
            String name,
            String email,
            String role,
            String accountStatus,
            boolean accessibilityRequired,
            Instant createdAt
    ) {
        public static UserView from(User user) {
            return new UserView(user.getId(), user.getName(), user.getEmail(), user.getRole().name(),
                    user.getAccountStatus().name(), user.isAccessibilityRequired(), user.getCreatedAt());
        }
    }

    public record AuthResponse(
            String accessToken,
            long expiresIn,
            UserView user
    ) {}

    public record RefreshResponse(String accessToken, long expiresIn) {}

    public record ForgotPasswordRequest(
            @NotBlank(message = "Email is required")
            @Email(message = "Enter a valid email address")
            String email
    ) {}

    public record ForgotPasswordResponse(String message, String devResetToken) {}

    public record ResetPasswordRequest(
            @NotBlank(message = "Reset token is required")
            String token,

            @NotBlank(message = "New password is required")
            @Size(min = 10, max = 72, message = "Password must be between 10 and 72 characters")
            @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
                    message = "Password must include upper-case, lower-case and numeric characters")
            String newPassword
    ) {}

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required")
            String currentPassword,

            @NotBlank(message = "New password is required")
            @Size(min = 10, max = 72, message = "Password must be between 10 and 72 characters")
            @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
                    message = "Password must include upper-case, lower-case and numeric characters")
            String newPassword
    ) {}

    public record UpdateProfileRequest(
            @NotBlank(message = "Name is required")
            @Size(min = 2, max = 120, message = "Name must be between 2 and 120 characters")
            String name,

            Boolean accessibilityRequired
    ) {}

    public record MessageResponse(String message) {}
}
