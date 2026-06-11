package com.privoraa.auth;

import com.privoraa.auth.dto.AuthResponse;
import com.privoraa.auth.dto.LoginRequest;
import com.privoraa.auth.dto.RegisterRequest;
import com.privoraa.auth.dto.TokenResponse;
import com.privoraa.auth.dto.UserDto;
import com.privoraa.common.ApiException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("An account with that email already exists");
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(req.password()))
                .displayName(req.displayName() == null || req.displayName().isBlank()
                        ? email.split("@")[0] : req.displayName().trim())
                .role(Role.USER)
                .build();
        userRepository.save(user);
        return issue(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }
        return issue(user);
    }

    @Transactional(readOnly = true)
    public TokenResponse refresh(String refreshToken) {
        Claims claims;
        try {
            claims = jwtService.parse(refreshToken);
        } catch (JwtException | IllegalArgumentException ex) {
            throw ApiException.unauthorized("Invalid or expired refresh token");
        }
        if (!jwtService.isRefreshToken(claims)) {
            throw ApiException.unauthorized("Not a refresh token");
        }
        User user = userRepository.findById(claims.getSubject())
                .orElseThrow(() -> ApiException.unauthorized("Account no longer exists"));
        return new TokenResponse(jwtService.generateAccessToken(user));
    }

    @Transactional(readOnly = true)
    public UserDto me(String userId) {
        return userRepository.findById(userId)
                .map(UserDto::from)
                .orElseThrow(() -> ApiException.unauthorized("Account no longer exists"));
    }

    private AuthResponse issue(User user) {
        return new AuthResponse(
                jwtService.generateAccessToken(user),
                jwtService.generateRefreshToken(user),
                UserDto.from(user));
    }
}
