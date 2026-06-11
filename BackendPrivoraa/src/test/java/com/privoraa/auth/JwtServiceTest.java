package com.privoraa.auth;

import com.privoraa.config.JwtProperties;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    private final JwtService jwt = new JwtService(new JwtProperties(
            "test-secret-test-secret-test-secret-test-secret", 15, 7));

    private User user() {
        return User.builder().id("u1").email("a@b.com").role(Role.USER).passwordHash("x").build();
    }

    @Test
    void accessTokenRoundTrips() {
        String token = jwt.generateAccessToken(user());
        Claims claims = jwt.parse(token);

        assertEquals("u1", claims.getSubject());
        assertEquals("a@b.com", jwt.email(claims));
        assertEquals("USER", jwt.role(claims));
        assertTrue(jwt.isAccessToken(claims));
        assertFalse(jwt.isRefreshToken(claims));
    }

    @Test
    void refreshTokenIsTypedRefresh() {
        Claims claims = jwt.parse(jwt.generateRefreshToken(user()));

        assertEquals("u1", claims.getSubject());
        assertTrue(jwt.isRefreshToken(claims));
        assertFalse(jwt.isAccessToken(claims));
    }
}
