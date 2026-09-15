package com.ibizabroker.bibliotheque;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.Role;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;

/**
 * Enveloppe JSON des RÉPONSES D'ERREUR : tout corps d'erreur porte
 * {@code message} + {@code status} + {@code timestamp}, quel que soit le code de sortie
 * et quel que soit le composant qui l'a écrit.
 *
 * <p>Le point à prouver est justement là : un 401/403 ne sort pas du contrôleur. Il est écrit
 * par les filtres Spring Security ({@code JwtAuthenticationEntryPoint}, {@code AccessDeniedHandler})
 * ou par le {@code @RestControllerAdvice} — trois chemins de code distincts. Sans ce test, une
 * seule de ces voies pouvait garder l'ancien corps {@code {"message": ...}} et personne ne
 * l'aurait vu : les tests existants n'assertent que {@code $.message}.</p>
 *
 * <p>Le contexte Spring démarre entièrement (filtre JWT réel + SecurityConfig +
 * {@code @PreAuthorize}) ; les repositories sont simulés, donc aucune base n'est nécessaire.
 * Les jetons sont de vrais JWT signés par {@link JwtUtil}.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiErrorResponseIntegrationTest {

    private static final String RESERVATIONS = "/api/reservations";

    /** Millisecondes + décalage : le format exact exigé du champ {@code timestamp}. */
    private static final Pattern TIMESTAMP_ISO_8601 =
            Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}(Z|[+-]\\d{2}:\\d{2})");

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockBean
    private ReservationRepository reservationRepository;

    @MockBean
    private UsersRepository usersRepository;

    @MockBean
    private BooksRepository booksRepository;

    // ------------------------------------------------------------------
    // Le contrat lui-même
    // ------------------------------------------------------------------

    /**
     * Vérifie le corps commun à toutes les erreurs : code HTTP et champ {@code status}
     * identiques, message non vide, timestamp ISO-8601 avec décalage.
     */
    private void verifierEnveloppe(MvcResult resultat, int statutAttendu) throws Exception {
        String corpsBrut = resultat.getResponse().getContentAsString();
        assertEquals(statutAttendu, resultat.getResponse().getStatus(),
                "ligne de statut HTTP — corps: " + corpsBrut);

        JsonNode corps = objectMapper.readTree(corpsBrut);
        assertEquals(statutAttendu, corps.path("status").asInt(),
                "le corps doit répéter le code HTTP — corps: " + corpsBrut);
        assertFalse(corps.path("message").asText().isBlank(),
                "message absent ou vide — corps: " + corpsBrut);

        String timestamp = corps.path("timestamp").asText();
        assertTrue(TIMESTAMP_ISO_8601.matcher(timestamp).matches(),
                "timestamp non conforme (ISO-8601 + décalage attendu) : " + timestamp);

        long ecartSecondes = Math.abs(ChronoUnit.SECONDS.between(
                OffsetDateTime.parse(timestamp), OffsetDateTime.now()));
        assertTrue(ecartSecondes < 60,
                "timestamp à " + ecartSecondes + " s de l'instant de la réponse : " + timestamp);
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private Users utilisateur(String username, int userId, String roleName) {
        Users user = new Users();
        user.setUserId(userId);
        user.setUsername(username);
        user.setName(username);
        user.setPassword("ignore");
        Role role = new Role();
        role.setRoleId(1);
        role.setRoleName(roleName);
        user.setRole(Set.of(role));
        return user;
    }

    private Books livre(int id, String nom, int copies) {
        Books book = new Books();
        book.setBookId(id);
        book.setBookName(nom);
        book.setNoOfCopies(copies);
        return book;
    }

    private Reservation reservationDe(Integer userId, long id) {
        Reservation reservation = new Reservation();
        reservation.setId(id);
        reservation.setBookId(9);
        reservation.setUserId(userId);
        reservation.setStatut(StatutReservation.EN_ATTENTE);
        return reservation;
    }

    private String tokenPour(String username) {
        UserDetails details = User.withUsername(username).password("ignore").roles("X").build();
        return jwtUtil.generateToken(details);
    }

    private void connecte(String username, int userId, String roleName) {
        when(usersRepository.findByUsername(username))
                .thenReturn(Optional.of(utilisateur(username, userId, roleName)));
    }

    // ------------------------------------------------------------------
    // 401 — JwtAuthenticationEntryPoint (le filtre, avant tout contrôleur)
    // ------------------------------------------------------------------

    @Test
    @DisplayName("401 sans token : message + status 401 + timestamp")
    void sansToken_401_porteLeStatusEtLeTimestamp() throws Exception {
        // andDo(print()) : le corps JSON réel apparaît dans le rapport Surefire, donc un
        // échec de contrat reste lisible seul, sans relancer l'application (ET-B-03).
        verifierEnveloppe(mockMvc.perform(get(RESERVATIONS)).andDo(print()).andReturn(), 401);
    }

    @Test
    @DisplayName("401 sans token : le corps signale aussi expired=false (jeton absent, pas expiré)")
    void sansToken_401_expiredEstFaux() throws Exception {
        MvcResult resultat = mockMvc.perform(get(RESERVATIONS)).andReturn();

        verifierEnveloppe(resultat, 401);
        assertEquals(false, objectMapper.readTree(resultat.getResponse().getContentAsString())
                .path("expired").asBoolean());
    }

    @Test
    @DisplayName("401 identifiants incorrects sur POST /authenticate : même enveloppe (corps écrit par le contrôleur)")
    void identifiantsIncorrects_401_porteLeStatusEtLeTimestamp() throws Exception {
        // findByUsername sur un mock renvoie Optional.empty() → BadCredentials → catch du contrôleur
        MvcResult resultat = mockMvc.perform(post("/authenticate")
                        .contentType(APPLICATION_JSON)
                        .content("{\"username\":\"inconnu\",\"password\":\"mauvais\"}"))
                .andReturn();

        verifierEnveloppe(resultat, 401);
        assertEquals(true, objectMapper.readTree(resultat.getResponse().getContentAsString())
                .path("message").asText().contains("Identifiants incorrects"));
    }

    // ------------------------------------------------------------------
    // 403 — deux chemins distincts vers le même code
    // ------------------------------------------------------------------

    @Test
    @DisplayName("403 par @PreAuthorize (rôle insuffisant) : message + status 403 + timestamp")
    void roleInsuffisant_403_porteLeStatusEtLeTimestamp() throws Exception {
        connecte("alice", 10, "ADHERENT");

        // « accepter » est réservé au personnel : refusé avant même d'atteindre le service.
        verifierEnveloppe(mockMvc.perform(patch(RESERVATIONS + "/99/accepter")
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andReturn(), 403);
    }

    @Test
    @DisplayName("403 métier (réservation d'un autre) : message + status 403 + timestamp")
    void reservationDAutrui_403_porteLeStatusEtLeTimestamp() throws Exception {
        connecte("alice", 10, "ADHERENT");
        when(reservationRepository.findById(99L)).thenReturn(Optional.of(reservationDe(77, 99)));

        MvcResult resultat = mockMvc.perform(get(RESERVATIONS + "/99")
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andReturn();

        verifierEnveloppe(resultat, 403);
        assertEquals(true, objectMapper.readTree(resultat.getResponse().getContentAsString())
                .path("message").asText().contains("n'appartient pas"));
    }

    // ------------------------------------------------------------------
    // 404 / 409 / 400 — le @RestControllerAdvice
    // ------------------------------------------------------------------

    @Test
    @DisplayName("404 réservation inexistante : message + status 404 + timestamp")
    void reservationInexistante_404_porteLeStatusEtLeTimestamp() throws Exception {
        connecte("alice", 10, "ADHERENT");
        when(reservationRepository.findById(99L)).thenReturn(Optional.empty());

        verifierEnveloppe(mockMvc.perform(get(RESERVATIONS + "/99")
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andReturn(), 404);
    }

    @Test
    @DisplayName("409 livre disponible (RG-01) : message + status 409 + timestamp")
    void livreDisponible_409_porteLeStatusEtLeTimestamp() throws Exception {
        connecte("biblio", 1, "BIBLIOTHECAIRE");
        when(booksRepository.findById(2)).thenReturn(Optional.of(livre(2, "1984", 3)));

        verifierEnveloppe(mockMvc.perform(post(RESERVATIONS)
                        .header("Authorization", "Bearer " + tokenPour("biblio"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookId\":2,\"userId\":10}"))
                .andReturn(), 409);
    }

    @Test
    @DisplayName("400 requête incomplète (ni id ni nom de livre) : message + status 400 + timestamp")
    void requeteIncomplete_400_porteLeStatusEtLeTimestamp() throws Exception {
        connecte("alice", 10, "ADHERENT");

        verifierEnveloppe(mockMvc.perform(post(RESERVATIONS)
                        .header("Authorization", "Bearer " + tokenPour("alice"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"userId\":10}"))
                .andReturn(), 400);
    }

    // ------------------------------------------------------------------
    // 500 — filet de sécurité du handler générique
    // ------------------------------------------------------------------

    @Test
    @DisplayName("500 panne inattendue : message générique + status 500 + timestamp (aucun détail technique)")
    void panneInattendue_500_porteLeStatusEtLeTimestamp() throws Exception {
        connecte("biblio", 1, "BIBLIOTHECAIRE");
        when(reservationRepository.findAll()).thenThrow(new IllegalStateException("panne simulée"));

        MvcResult resultat = mockMvc.perform(get(RESERVATIONS)
                        .header("Authorization", "Bearer " + tokenPour("biblio")))
                .andReturn();

        verifierEnveloppe(resultat, 500);

        String message = objectMapper.readTree(resultat.getResponse().getContentAsString())
                .path("message").asText();
        assertFalse(message.contains("panne simulée"),
                "le détail technique ne doit pas fuiter au client : " + message);
    }

    // ------------------------------------------------------------------
    // Garde-fou : les réponses de SUCCÈS ne sont pas enveloppées
    // ------------------------------------------------------------------

    @Test
    @DisplayName("une réponse 2xx garde son contrat : la liste de réservations reste un tableau nu")
    void succes_nonEnveloppe() throws Exception {
        connecte("alice", 10, "ADHERENT");
        when(reservationRepository.findByUserId(10))
                .thenReturn(java.util.List.of(reservationDe(10, 1)));

        MvcResult resultat = mockMvc.perform(get(RESERVATIONS)
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andReturn();

        assertEquals(200, resultat.getResponse().getStatus());
        assertEquals(true, objectMapper.readTree(resultat.getResponse().getContentAsString()).isArray(),
                "le frontend consomme ce tableau tel quel : l'enveloppe ne concerne que les erreurs");
    }
}
