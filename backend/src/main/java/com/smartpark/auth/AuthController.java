package com.smartpark.auth;

import com.smartpark.common.ForbiddenException;
import com.smartpark.common.UnauthorizedException;
import com.smartpark.config.AppProperties;
import com.smartpark.security.CurrentUser;
import com.smartpark.security.UserPrincipal;
import com.smartpark.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "smartpark_refresh";

    private final AuthService authService;
    private final CurrentUser currentUser;
    private final AppProperties properties;
    private final boolean exposeResetToken;

    public AuthController(AuthService authService, CurrentUser currentUser, AppProperties properties,
                          @Value("${app.dev-expose-reset-token:false}") boolean exposeResetToken) {
        this.authService = authService;
        this.currentUser = currentUser;
        this.properties = properties;
        this.exposeResetToken = exposeResetToken;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthDtos.AuthResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest request,
                                                          HttpServletRequest http) {
        verifyOrigin(http);
        var issued = authService.register(request, http.getRemoteAddr());
        return withCookie(issued, AuthDtos.UserView.from(issued.user()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request,
                                                       HttpServletRequest http) {
        verifyOrigin(http);
        var issued = authService.login(request, http.getRemoteAddr());
        return withCookie(issued, AuthDtos.UserView.from(issued.user()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthDtos.RefreshResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
            HttpServletRequest http) {
        verifyOrigin(http);
        var issued = authService.rotateRefreshToken(refreshToken);
        return withCookie(issued, new AuthDtos.RefreshResponse(issued.accessToken(),
                properties.getSecurity().getAccessTokenTtlMinutes() * 60));
    }

    @PostMapping("/logout")
    public ResponseEntity<AuthDtos.MessageResponse> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
            HttpServletRequest http) {
        verifyOrigin(http);
        authService.logout(refreshToken);
        ResponseCookie cookie = cookie("", 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthDtos.MessageResponse("Signed out."));
    }

    @GetMapping("/me")
    public AuthDtos.UserView me() {
        User user = currentUser.entity();
        return AuthDtos.UserView.from(user);
    }

    @PostMapping("/forgot-password")
    public AuthDtos.ForgotPasswordResponse forgotPassword(@Valid @RequestBody AuthDtos.ForgotPasswordRequest request,
                                                          HttpServletRequest http) {
        verifyOrigin(http);
        String token = authService.requestPasswordReset(request.email());
        return new AuthDtos.ForgotPasswordResponse(
                "If an account exists for that email, a reset token has been issued.",
                exposeResetToken ? token : null);
    }

    @PostMapping("/reset-password")
    public AuthDtos.MessageResponse resetPassword(@Valid @RequestBody AuthDtos.ResetPasswordRequest request,
                                                  HttpServletRequest http) {
        verifyOrigin(http);
        authService.resetPassword(request.token(), request.newPassword());
        return new AuthDtos.MessageResponse("Password updated. Sign in with your new password.");
    }

    @PostMapping("/change-password")
    public ResponseEntity<AuthDtos.MessageResponse> changePassword(
            @Valid @RequestBody AuthDtos.ChangePasswordRequest request) {
        User user = currentUser.entity();
        authService.changePassword(user, request.currentPassword(), request.newPassword());
        ResponseCookie clear = cookie("", 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clear.toString())
                .body(new AuthDtos.MessageResponse("Password changed. Please sign in again."));
    }

    private ResponseEntity<AuthDtos.AuthResponse> withCookie(AuthService.IssuedTokens issued,
                                                              AuthDtos.UserView view) {
        ResponseCookie cookie = cookie(issued.refreshToken(),
                properties.getSecurity().getRefreshTokenTtlDays() * 24 * 60 * 60);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthDtos.AuthResponse(issued.accessToken(),
                        properties.getSecurity().getAccessTokenTtlMinutes() * 60, view));
    }

    private <T> ResponseEntity<T> withCookie(AuthService.IssuedTokens issued, T body) {
        ResponseCookie cookie = cookie(issued.refreshToken(),
                properties.getSecurity().getRefreshTokenTtlDays() * 24 * 60 * 60);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(body);
    }

    private ResponseCookie cookie(String value, long maxAgeSeconds) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(properties.getSecurity().isCookieSecure())
                .sameSite("Strict")
                .path("/api/v1/auth")
                .maxAge(Duration.ofSeconds(maxAgeSeconds));
        String domain = properties.getSecurity().getCookieDomain();
        if (domain != null && !domain.isBlank()) {
            builder.domain(domain);
        }
        return builder.build();
    }

    private void verifyOrigin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin != null && !properties.getSecurity().getCorsOrigins().contains(origin)) {
            throw new ForbiddenException("Request origin is not allowed.");
        }
    }
}
