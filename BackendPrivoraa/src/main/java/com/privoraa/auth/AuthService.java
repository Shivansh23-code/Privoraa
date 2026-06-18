package com.privoraa.auth;

import com.privoraa.auth.dto.AuthResponse;
import com.privoraa.auth.dto.LoginRequest;
import com.privoraa.auth.dto.RegisterRequest;
import com.privoraa.auth.dto.TokenResponse;
import com.privoraa.auth.dto.UserDto;
import com.privoraa.common.ApiException;
import com.privoraa.config.AccessProperties;
import org.springframework.dao.DataIntegrityViolationException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AccessProperties access;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                       AccessProperties access) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.access = access;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (!access.allows(email)) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Sign-ups are limited right now. This is a private learning project.");
        }
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
        try {
            // saveAndFlush surfaces the unique-email constraint HERE (inside the try)
            // instead of at commit time, so a race between two concurrent registrations
            // returns a clean 409 instead of an unhandled 500.
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("An account with that email already exists");
        }
        return issue(user);
    }

    // Writable (not readOnly): issue() may persist the owner's auto-PRO grant.
    @Transactional
    public AuthResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase();
        if (!access.allows(email)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This account isn't permitted on this deployment.");
        }
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

    // Writable: re-applies the owner's auto-PRO on every session check so the PRO
    // UI shows up without needing a fresh login (and survives store resets).
    @Transactional
    public UserDto me(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Account no longer exists"));
        if (access.isPro(user.getEmail()) && user.getPlan() != Plan.PRO) {
            user.setPlan(Plan.PRO);
            userRepository.save(user);
        }
        return UserDto.from(user);
    }

    private AuthResponse issue(User user) {
        // Owner emails are always PRO — re-applied on every auth so a reset of the
        // (in-memory) store never silently drops them back to Free and asks them to
        // pay again.
        if (access.isPro(user.getEmail()) && user.getPlan() != Plan.PRO) {
            user.setPlan(Plan.PRO);
            userRepository.save(user);
        }
        return new AuthResponse(
                jwtService.generateAccessToken(user),
                jwtService.generateRefreshToken(user),
                UserDto.from(user));
    }
}
