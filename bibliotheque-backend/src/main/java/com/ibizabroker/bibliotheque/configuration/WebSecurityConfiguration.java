package com.ibizabroker.bibliotheque.configuration;

import com.ibizabroker.bibliotheque.exceptions.ApiErrorResponse;
import com.ibizabroker.bibliotheque.service.JwtService;
import com.ibizabroker.bibliotheque.util.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class WebSecurityConfiguration {

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(WebSecurityConfiguration.class);

    @Autowired
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    @Autowired
    private JwtUtil jwtUtil;

    @Bean
    public JwtRequestFilter jwtRequestFilter(JwtService jwtService) {
        return new JwtRequestFilter(jwtUtil, jwtService);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity, JwtService jwtService) throws Exception {
        httpSecurity.cors(cors -> cors.configurationSource(corsConfigurationSource));
        httpSecurity.csrf(csrf -> csrf.disable());
        httpSecurity.authorizeHttpRequests(auth -> auth
                .requestMatchers("/authenticate", "/admin/books/").permitAll()
                .requestMatchers(HttpHeaders.ALLOW).permitAll()
                // Documentation d'API : Swagger UI doit pouvoir charger sa page et son
                // descriptif AVANT toute authentification, sinon la page elle-même
                // répondrait 401. Choix assumé : /v3/api-docs publie la surface de l'API.
                // Retirer ces deux lignes (et la dépendance springdoc) referme tout :
                // aucun endpoint MÉTIER n'est concerné par cette ouverture.
                //
                // « /v3/api-docs » est listé SÉPARÉMENT de « /v3/api-docs/** » : le motif
                // avec « /** » ne couvre pas le chemin racine, et Spring 6 ne fait plus de
                // correspondance avec slash final — même piège que le "/admin/books/"
                // inopérant plus haut.
                .requestMatchers("/swagger-ui.html", "/swagger-ui/**",
                        "/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml").permitAll()
                .anyRequest().authenticated()
        );
        // 401 sans token / token invalide ; 403 JSON quand authentifié sans droits
        httpSecurity.exceptionHandling(ex -> ex
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler())
        );
        httpSecurity.sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        );
        httpSecurity.addFilterBefore(jwtRequestFilter(jwtService), UsernamePasswordAuthenticationFilter.class);
        return httpSecurity.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * 403 au format JSON pour un utilisateur authentifié mais non autorisé.
     * Sans lui, Spring renverrait un 403 HTML ; et via @RestControllerAdvice, le
     * handler générique transformerait l'AccessDeniedException en 500.
     * Bonus : chaque refus est journalisé (qui, où, pourquoi).
     */
    private AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String qui = (auth != null) ? auth.getName() : "inconnu";
            log.warn("Accès refusé [403] {} {} — utilisateur '{}' : droits insuffisants",
                    request.getMethod(), request.getRequestURI(), qui);

            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            // Même corps d'erreur que le GlobalExceptionHandler : message + status + timestamp.
            response.getWriter().write(new ObjectMapper().writeValueAsString(
                    ApiErrorResponse.of("Accès refusé : droits insuffisants", HttpStatus.FORBIDDEN)));
        };
    }
}
