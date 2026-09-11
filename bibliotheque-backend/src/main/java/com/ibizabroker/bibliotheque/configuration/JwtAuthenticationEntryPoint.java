package com.ibizabroker.bibliotheque.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;

/**
 * 401 — « Je ne sais pas qui vous êtes » : token absent, invalide ou expiré.
 * Bonus : le message distingue l'expiration (« Session expirée ») des autres cas,
 * et chaque tentative refusée est journalisée.
 */
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationEntryPoint.class);

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException, ServletException {

        boolean tokenExpire = Boolean.TRUE.equals(request.getAttribute(JwtRequestFilter.JWT_EXPIRED_ATTRIBUTE));
        String message = tokenExpire
                ? "Session expirée, veuillez vous reconnecter"
                : "Authentification requise";

        log.warn("Accès refusé [401] {} {} — {}",
                request.getMethod(), request.getRequestURI(), message);

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(
                objectMapper.writeValueAsString(
                        Map.of("message", message, "expired", tokenExpire)
                )
        );
    }
}
