package com.ibizabroker.bibliotheque;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.Role;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.util.JwtUtil;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests d'intégration de la sécurité sur GET /api/reservations et GET /api/reservations/{id}.
 *
 * Le contexte Spring démarre entièrement : filtre JWT réel + SecurityConfig + @PreAuthorize.
 * Couvre aussi RG-01 : seule la réservation d'un livre INDISPONIBLE (0 exemplaire) est acceptée.
 * Les tokens sont de VRAIS tokens signés produits par JwtUtil (comme en production) et passent
 * par le pipeline complet : JwtRequestFilter → JwtService (rôles → ROLE_x) → @PreAuthorize.
 *
 * Les repositories sont des mocks : le test passe SANS base de données installée
 * (H2 en mémoire n'est là que pour le démarrage de JPA).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ReservationSecurityIntegrationTest {

    private static final String ENDPOINT = "/api/reservations";

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

    /** Génère un vrai JWT signé pour l'utilisateur, comme le ferait POST /authenticate. */
    private String tokenPour(String username) {
        UserDetails details = User.withUsername(username).password("ignore").roles("X").build();
        return jwtUtil.generateToken(details);
    }

    /** Génère un JWT valablement signé MAIS expiré depuis une heure. */
    private String tokenExpire() {
        SecretKey key = Keys.hmacShaKeyFor("SuperSecretKeyForJwtTokenGeneration2026".getBytes(StandardCharsets.UTF_8));
        long ilYAUneHeure = System.currentTimeMillis() - 3_600_000L;
        return Jwts.builder()
                .subject("alice")
                .issuedAt(new Date(ilYAUneHeure * 2))
                .expiration(new Date(ilYAUneHeure))
                .signWith(key)
                .compact();
    }

    // ------------------------------------------------------------------
    // RS-01 — Sans token : 401 partout
    // ------------------------------------------------------------------

    @Test
    @DisplayName("RS-01 : sans token, GET /api/reservations renvoie 401")
    void getAll_sansToken_renvoie401() throws Exception {
        mockMvc.perform(get(ENDPOINT))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentification requise"));
    }

    @Test
    @DisplayName("RS-01 : sans token, GET /api/reservations/{id} renvoie 401")
    void getById_sansToken_renvoie401() throws Exception {
        mockMvc.perform(get(ENDPOINT + "/99"))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------
    // RS-05 — Un ADHERENT ne voit que SES réservations
    // ------------------------------------------------------------------

    @Test
    @DisplayName("RS-05 : GET /api/reservations avec token ADHERENT renvoie 200 et ses réservations seulement")
    void getAll_adherent_renvoieSesReservationsSeulement() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(reservationRepository.findByUserId(10)).thenReturn(List.of(reservationDe(10, 1L)));

        mockMvc.perform(get(ENDPOINT).header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(10));
    }

    // ------------------------------------------------------------------
    // RS-03 — Un ADHERENT ne peut pas accéder à la réservation d'un autre
    // ------------------------------------------------------------------

    @Test
    @DisplayName("RS-03 : un ADHERENT qui accède à la réservation d'un autre reçoit 403")
    void getById_reservationDUnAutreAdherent_renvoie403() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(reservationRepository.findById(99L)).thenReturn(Optional.of(reservationDe(77, 99L)));

        mockMvc.perform(get(ENDPOINT + "/99").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("La réservation 99 n'appartient pas à l'adhérent 'alice'"));
    }

    @Test
    @DisplayName("RS-03 : le BIBLIOTHECAIRE, lui, accède à la réservation de n'importe quel adhérent (200)")
    void getById_bibliothecaire_renvoie200() throws Exception {
        when(usersRepository.findByUsername("biblio"))
                .thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(reservationRepository.findById(99L)).thenReturn(Optional.of(reservationDe(77, 99L)));

        mockMvc.perform(get(ENDPOINT + "/99").header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(77));
    }

    @Test
    @DisplayName("RS-02 : un ADHERENT qui appelle DELETE /api/reservations/{id} reçoit 403")
    void delete_parAdherent_renvoie403() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete(ENDPOINT + "/5").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------
    // Bonus — expiration du token : 401 avec un message dédié
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Bonus : un token expiré renvoie 401 avec le message « Session expirée »")
    void getById_tokenExpire_renvoie401AvecMessageSessionExpiree() throws Exception {
        mockMvc.perform(get(ENDPOINT + "/1").header("Authorization", "Bearer " + tokenExpire()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Session expirée, veuillez vous reconnecter"))
                .andExpect(jsonPath("$.expired").value(true));
    }

    // ------------------------------------------------------------------
    // Bonus — RG-01 : seul un livre INDISPONIBLE (0 exemplaire) est réservable
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Bonus RG-01 : réserver un livre disponible (copies > 0) est refusé (409)")
    void create_livreDisponible_renvoie409() throws Exception {
        when(usersRepository.findByUsername("biblio"))
                .thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(booksRepository.findById(2)).thenReturn(Optional.of(livre(2, "1984", 3)));

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("biblio"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookId\":2,\"userId\":10}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("disponible")));
    }

    @Test
    @DisplayName("Bonus RG-01 : un livre indisponible (0 exemplaire) est accepté (201, EN_ATTENTE)")
    void create_livreIndisponible_estAccepte() throws Exception {
        when(usersRepository.findByUsername("alice"))
                .thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(usersRepository.findById(10)).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(booksRepository.findById(3)).thenReturn(Optional.of(livre(3, "Dune", 0)));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(3), anyList())).thenReturn(false);
        when(reservationRepository.countByUserIdAndStatutIn(eq(10), anyList())).thenReturn(0L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("alice"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookId\":3,\"userId\":10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.statut").value("DEMANDE"))
                .andExpect(jsonPath("$.userId").value(10));
    }

    // ------------------------------------------------------------------
    // Workflow DEMANDE → acceptation par le personnel
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Workflow : un adhérent qui soumet une réservation crée une DEMANDE ; le staff l'accepte → EN_ATTENTE")
    void workflow_adherentCreeDemande_staffAccepte_versEnAttente() throws Exception {
        // 1. L'adhérent soumet → DEMANDE (201)
        when(usersRepository.findByUsername("alice"))
                .thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(usersRepository.findById(10)).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(booksRepository.findById(3)).thenReturn(Optional.of(livre(3, "Dune", 0)));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(3), anyList())).thenReturn(false);
        when(reservationRepository.countByUserIdAndStatutIn(eq(10), anyList())).thenReturn(0L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("alice"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookId\":3,\"userId\":10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.statut").value("DEMANDE"));

        // 2. Un adhérent ne peut PAS accepter (403)
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch(ENDPOINT + "/55/accepter").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden());

        // 3. Le personnel accepte → EN_ATTENTE (200)
        when(usersRepository.findByUsername("biblio"))
                .thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        Reservation demande = reservationDe(10, 55L);
        demande.setStatut(StatutReservation.DEMANDE);
        when(reservationRepository.findById(55L)).thenReturn(Optional.of(demande));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch(ENDPOINT + "/55/accepter").header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("EN_ATTENTE"));
    }

    @Test
    @DisplayName("Workflow : accepter une réservation qui n'est pas une DEMANDE est refusé (409)")
    void accepter_statutNonDemande_renvoie409() throws Exception {
        when(usersRepository.findByUsername("biblio"))
                .thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(reservationRepository.findById(55L)).thenReturn(Optional.of(reservationDe(10, 55L))); // EN_ATTENTE

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch(ENDPOINT + "/55/accepter").header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("DEMANDE")));
    }

    @Test
    @DisplayName("Workflow : accepter sans token renvoie 401")
    void accepter_sansToken_renvoie401() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch(ENDPOINT + "/55/accepter"))
                .andExpect(status().isUnauthorized());
    }
}
