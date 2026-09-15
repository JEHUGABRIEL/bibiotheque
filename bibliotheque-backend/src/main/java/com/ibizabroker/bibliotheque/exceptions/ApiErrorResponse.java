package com.ibizabroker.bibliotheque.exceptions;

import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Corps JSON unique de TOUTES les erreurs de l'API (aucune réponse 2xx ne l'utilise) :
 *
 * <pre>
 * {
 *   "message":   "Accès refusé : vous n'avez pas les droits nécessaires",
 *   "status":    403,
 *   "timestamp": "2026-09-15T09:19:38.335+01:00"
 * }
 * </pre>
 *
 * <p><b>Pourquoi « status » dans le corps alors qu'il est déjà dans la ligne de statut HTTP ?</b>
 * Les deux valeurs sont produites à partir de la MÊME constante {@link HttpStatus} (voir
 * {@link #of(String, HttpStatus)}), donc elles ne peuvent pas diverger : c'est un rappel
 * pour les clients qui ne journalisent que le payload, ou dont un intermédiaire a aplati
 * la réponse.</p>
 *
 * <p><b>Pourquoi ce format de date ?</b> ISO-8601 <i>avec décalage local</i>
 * ({@code 2026-09-15T09:19:38.335+01:00}) : lisible par un humain, comparable
 * lexicographiquement, et sans ambiguïté de fuseau — contrairement à un
 * {@code LocalDateTime} nu, qui ne dit pas dans quel fuseau l'erreur a eu lieu.
 * Millisecondes toujours présentes (largeur fixe), donc analysable par un simple
 * {@link DateTimeFormatter} côté client.</p>
 *
 * <p>Le contrat vaut pour les trois familles d'erreurs : celles du contrôleur et du
 * service (via {@code GlobalExceptionHandler}), et celles écrites directement dans les
 * filtres Spring Security ({@code JwtAuthenticationEntryPoint} pour le 401,
 * {@code AccessDeniedHandler} pour le 403) — sans quoi le corps d'un 401 dépendrait du
 * chemin de code qui l'a produit.</p>
 */
public final class ApiErrorResponse {

    /**
     * Millisecondes + décalage. {@code XXX} rend {@code +01:00}, et {@code Z} pour UTC
     * (les deux sont des décalages ISO-8601 valides).
     */
    private static final DateTimeFormatter FORMAT_ISO_8601 =
            DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSXXX");

    private ApiErrorResponse() {
    }

    /**
     * Corps d'erreur standard. Ordre des clés volontairement stable
     * ({@code message}, {@code status}, {@code timestamp}) : c'est l'ordre de lecture
     * dans Swagger UI et dans les journaux.
     *
     * @param message message métier, destiné à être affiché tel quel par le client
     * @param status  statut HTTP — la source unique du code écrit dans le corps
     */
    public static Map<String, Object> of(String message, HttpStatus status) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("status", status.value());
        body.put("timestamp", maintenant());
        return body;
    }

    /**
     * 401 — ajoute {@code expired} pour distinguer un jeton expiré d'un jeton
     * absent/invalide : le client peut ainsi proposer « reconnectez-vous » plutôt
     * qu'un simple « accès refusé » (le frontend lit {@code err.error.expired}).
     */
    public static Map<String, Object> unauthorized(String message, boolean expired) {
        Map<String, Object> body = of(message, HttpStatus.UNAUTHORIZED);
        body.put("expired", expired);
        return body;
    }

    /** Instant courant, formaté ISO-8601 avec le décalage horaire du serveur. */
    public static String maintenant() {
        return OffsetDateTime.now().format(FORMAT_ISO_8601);
    }
}
