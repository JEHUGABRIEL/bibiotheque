package com.ibizabroker.bibliotheque;

import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
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

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests d'intégration de la sécurité sur GET /api/reservations et GET /api/reservations/{id}.
 *
 * Le contexte Spring démarre entièrement : filtre JWT réel + SecurityConfig + @PreAuthorize.
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
}
