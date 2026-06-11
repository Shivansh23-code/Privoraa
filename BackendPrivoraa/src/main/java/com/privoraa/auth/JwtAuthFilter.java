package com.privoraa.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Validates the Bearer access token on each request and populates the security context.
 * Intentionally NOT a {@code @Component} — it's wired into the Spring Security chain in
 * {@code SecurityConfig} so it isn't also auto-registered as a plain servlet filter.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = header.substring(7);
            try {
                Claims claims = jwtService.parse(token);
                if (jwtService.isAccessToken(claims)) {
                    PrivoraaUserDetails principal = new PrivoraaUserDetails(
                            claims.getSubject(), jwtService.email(claims), jwtService.role(claims));
                    var auth = new UsernamePasswordAuthenticationToken(
                            principal, null, principal.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (JwtException | IllegalArgumentException ex) {
                // Invalid/expired token -> leave the context unauthenticated.
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }

    /**
     * Re-run on ASYNC dispatches too. SSE streaming (SseEmitter) completes via an
     * async re-dispatch; without re-authenticating here the SecurityContext is empty
     * on that dispatch and Spring Security raises a spurious AccessDeniedException
     * after the stream has already been sent.
     */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }
}
