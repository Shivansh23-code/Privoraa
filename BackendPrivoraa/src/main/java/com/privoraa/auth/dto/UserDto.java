package com.privoraa.auth.dto;

import com.privoraa.auth.User;

public record UserDto(
        String id,
        String email,
        String displayName,
        String role,
        String plan
) {
    public static UserDto from(User user) {
        return new UserDto(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole().name(),
                user.getPlan() == null ? "FREE" : user.getPlan().name());
    }
}
