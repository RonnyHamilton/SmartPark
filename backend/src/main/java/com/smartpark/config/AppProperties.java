package com.smartpark.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Security security = new Security();
    private boolean demoData;
    private boolean devExposeResetToken;
    private boolean mailEnabled;
    private String mailFrom = "no-reply@smartpark.local";

    public Security getSecurity() { return security; }
    public boolean isDemoData() { return demoData; }
    public void setDemoData(boolean demoData) { this.demoData = demoData; }
    public boolean isDevExposeResetToken() { return devExposeResetToken; }
    public void setDevExposeResetToken(boolean devExposeResetToken) { this.devExposeResetToken = devExposeResetToken; }
    public boolean isMailEnabled() { return mailEnabled; }
    public void setMailEnabled(boolean mailEnabled) { this.mailEnabled = mailEnabled; }
    public String getMailFrom() { return mailFrom; }
    public void setMailFrom(String mailFrom) { this.mailFrom = mailFrom; }

    public static class Security {
        private String jwtSecret;
        private long accessTokenTtlMinutes = 15;
        private long refreshTokenTtlDays = 7;
        private boolean cookieSecure = false;
        private String cookieDomain = "";
        private List<String> corsOrigins = new ArrayList<>(List.of("http://localhost:5173"));
        private int loginMaxAttempts = 5;
        private int loginLockMinutes = 15;
        private int rateLimitPerMinute = 20;

        public String getJwtSecret() { return jwtSecret; }
        public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }
        public long getAccessTokenTtlMinutes() { return accessTokenTtlMinutes; }
        public void setAccessTokenTtlMinutes(long accessTokenTtlMinutes) { this.accessTokenTtlMinutes = accessTokenTtlMinutes; }
        public long getRefreshTokenTtlDays() { return refreshTokenTtlDays; }
        public void setRefreshTokenTtlDays(long refreshTokenTtlDays) { this.refreshTokenTtlDays = refreshTokenTtlDays; }
        public boolean isCookieSecure() { return cookieSecure; }
        public void setCookieSecure(boolean cookieSecure) { this.cookieSecure = cookieSecure; }
        public String getCookieDomain() { return cookieDomain; }
        public void setCookieDomain(String cookieDomain) { this.cookieDomain = cookieDomain; }
        public List<String> getCorsOrigins() { return corsOrigins; }
        public void setCorsOrigins(List<String> corsOrigins) { this.corsOrigins = corsOrigins; }
        public int getLoginMaxAttempts() { return loginMaxAttempts; }
        public void setLoginMaxAttempts(int loginMaxAttempts) { this.loginMaxAttempts = loginMaxAttempts; }
        public int getLoginLockMinutes() { return loginLockMinutes; }
        public void setLoginLockMinutes(int loginLockMinutes) { this.loginLockMinutes = loginLockMinutes; }
        public int getRateLimitPerMinute() { return rateLimitPerMinute; }
        public void setRateLimitPerMinute(int rateLimitPerMinute) { this.rateLimitPerMinute = rateLimitPerMinute; }
    }
}
