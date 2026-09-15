package com.ibizabroker.bibliotheque.configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Documentation d'API — Swagger UI sur /swagger-ui/index.html, descriptif sur /v3/api-docs.
 *
 * Déclare le schéma d'authentification « bearerAuth ». Sans lui, le bouton « Authorize »
 * de Swagger UI ne saurait pas qu'un JWT est attendu : la quasi-totalité des endpoints
 * répondrait 401 depuis l'interface, puisque l'API est fermée (séance 4).
 *
 * Mode d'emploi : POST /authenticate → copier « jwtToken » → bouton « Authorize » →
 * coller le jeton SEUL (Swagger UI ajoute lui-même le préfixe « Bearer »).
 */
@Configuration
public class OpenApiConfiguration {

    private static final String SCHEMA_JWT = "bearerAuth";

    @Bean
    public OpenAPI bibliothequeOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("API Bibliothèque")
                        .version("1.0")
                        .description("""
                                API REST de gestion de bibliothèque (Spring Boot 3.1.5).

                                **Authentification.** POST /authenticate renvoie un `jwtToken` ;
                                le passer ensuite en en-tête `Authorization: Bearer <jeton>`
                                sur tous les autres endpoints.

                                **Rôles.** `Admin`, `BIBLIOTHECAIRE`, `ADHERENT` (et l'ancien
                                `User`). Les droits sont vérifiés par `@PreAuthorize` dans les
                                contrôleurs : 401 sans jeton, 403 avec un jeton aux droits
                                insuffisants. Un ADHERENT ne voit et ne modifie que ses propres
                                réservations ; son identité est lue dans le jeton, jamais dans
                                le corps de la requête.

                                **Erreurs.** Toute réponse d'erreur (400, 401, 403, 404, 409,
                                500) a le même corps : `message` (texte à afficher),
                                `status` (le code HTTP, répété) et `timestamp` (ISO-8601 avec
                                décalage). Le 401 ajoute `expired` pour distinguer un jeton
                                expiré d'un jeton absent. Les réponses de succès ne sont pas
                                enveloppées.
                                """))
                // Exigence appliquée globalement : Swagger UI enverra le jeton sur chaque
                // appel. /authenticate reste accessible sans (il est permitAll côté sécurité).
                .addSecurityItem(new SecurityRequirement().addList(SCHEMA_JWT))
                .components(new Components().addSecuritySchemes(SCHEMA_JWT,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
