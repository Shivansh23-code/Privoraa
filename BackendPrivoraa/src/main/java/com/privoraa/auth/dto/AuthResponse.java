package com.privoraa.auth.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserDto user
) {}
