package com.ibizabroker.bibliotheque.exceptions;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Contrat du corps d'erreur : {@code message} + {@code status} + {@code timestamp}.
 *
 * <p>Test unitaire — aucun contexte Spring, aucune base : il verrouille le FORMAT, que les
 * tests d'intégration ({@code ApiErrorResponseIntegrationTest}) ne vérifient que sur les
 * quelques chemins qu'ils empruntent.</p>
 */
class ApiErrorResponseTest {

    /** Millisecondes TOUJOURS présentes + décalage explicite ({@code Z} ou {@code ±HH:MM}). */
    private static final Pattern TIMESTAMP_ISO_8601 =
            Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}(Z|[+-]\\d{2}:\\d{2})");

    @Test
    @DisplayName("le corps porte le message, le status et le timestamp, dans cet ordre")
    void of_produitLesTroisChampsDansLOrdre() {
        Map<String, Object> corps = ApiErrorResponse.of("Accès refusé", HttpStatus.FORBIDDEN);

        assertEquals(List.of("message", "status", "timestamp"), new ArrayList<>(corps.keySet()));
        assertEquals("Accès refusé", corps.get("message"));
        assertEquals(403, corps.get("status"));
    }

    @Test
    @DisplayName("le status du corps est toujours celui du HttpStatus passé (source unique)")
    void of_recopieLeCodeHttpFourni() {
        assertEquals(400, ApiErrorResponse.of("m", HttpStatus.BAD_REQUEST).get("status"));
        assertEquals(401, ApiErrorResponse.of("m", HttpStatus.UNAUTHORIZED).get("status"));
        assertEquals(403, ApiErrorResponse.of("m", HttpStatus.FORBIDDEN).get("status"));
        assertEquals(404, ApiErrorResponse.of("m", HttpStatus.NOT_FOUND).get("status"));
        assertEquals(409, ApiErrorResponse.of("m", HttpStatus.CONFLICT).get("status"));
        assertEquals(500, ApiErrorResponse.of("m", HttpStatus.INTERNAL_SERVER_ERROR).get("status"));
    }

    @Test
    @DisplayName("le timestamp est l'instant courant, en ISO-8601 AVEC décalage (donc reparsable)")
    void of_timestampEstIso8601AvecDecalage() {
        String timestamp = (String) ApiErrorResponse.of("m", HttpStatus.CONFLICT).get("timestamp");

        // Le motif exige un décalage explicite : un LocalDateTime nu (2026-09-15T09:19:38)
        // — ambigu sur le fuseau — ou un format maison seraient refusés ici.
        assertTrue(TIMESTAMP_ISO_8601.matcher(timestamp).matches(), timestamp);

        // Le décodage par l'API standard doit réussir et rendre l'instant d'émission.
        OffsetDateTime emis = OffsetDateTime.parse(timestamp);
        long ecart = Math.abs(ChronoUnit.SECONDS.between(emis, OffsetDateTime.now()));
        assertTrue(ecart < 60, "timestamp à " + ecart + " s de l'instant présent : " + timestamp);
    }

    @Test
    @DisplayName("le timestamp porte le décalage LOCAL du serveur, pas un UTC déguisé")
    void of_timestampUtiliseLeDecalageDuServeur() {
        String timestamp = (String) ApiErrorResponse.of("m", HttpStatus.FORBIDDEN).get("timestamp");

        assertEquals(OffsetDateTime.now().getOffset(), OffsetDateTime.parse(timestamp).getOffset());
    }

    @Test
    @DisplayName("le 401 ajoute « expired » et reste un corps complet")
    void unauthorized_ajouteExpired() {
        Map<String, Object> corps = ApiErrorResponse.unauthorized("Session expirée", true);

        assertEquals(401, corps.get("status"));
        assertEquals(true, corps.get("expired"));
        assertEquals("Session expirée", corps.get("message"));
        assertEquals(List.of("message", "status", "timestamp", "expired"), new ArrayList<>(corps.keySet()));
        assertEquals(false, ApiErrorResponse.unauthorized("Authentification requise", false).get("expired"));
    }
}
