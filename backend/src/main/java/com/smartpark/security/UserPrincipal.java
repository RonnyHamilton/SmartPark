package com.smartpark.security;

import com.smartpark.user.Role;

import java.util.UUID;

public record UserPrincipal(UUID id, String email, String name, Role role) {
}
