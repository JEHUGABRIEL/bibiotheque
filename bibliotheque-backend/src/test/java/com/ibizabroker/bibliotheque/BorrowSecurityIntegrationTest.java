package com.ibizabroker.bibliotheque;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.BorrowRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Borrow;
import com.ibizabroker.bibliotheque.entity.Role;
import com.ibizabroker.bibliotheque.entity.StatutBorrow;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests d'intégration de la sécurité sur les endpoints de lecture d'emprunts.
 *
 * Même approche que ReservationSecurityIntegrationTest : contexte Spring complet
 * (filtre JWT réel + SecurityConfig + @PreAuthorize), tokens réellement signés
 * produits par JwtUtil, repositories mockés — le test passe SANS base de données.
 *
 * Règles couvertes (staff-or-self) :
 * - GET /borrow/user/{id}          → BIBLIOTHECAIRE/Admin ou l'adhérent lui-même
 * - GET /borrow/user/{id}/pending  → BIBLIOTHECAIRE/Admin ou l'adhérent lui-même
 * - GET /borrow/book/{id}          → BIBLIOTHECAIRE/Admin uniquement
 */
@SpringBootTest
@AutoConfigureMockMvc
class BorrowSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockBean
    private BorrowRepository borrowRepository;

    @MockBean
    private UsersRepository usersRepository;

    @MockBean
    private BooksRepository booksRepository;

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private Users utilisateur(String username, int userId, String... roleNames) {
        Users user = new Users();
        user.setUserId(userId);
        user.setUsername(username);
        user.setName(username);
        user.setPassword("ignore");
        Set<Role> roles = java.util.Arrays.stream(roleNames)
                .map(n -> {
                    Role role = new Role();
                    role.setRoleId(1);
                    role.setRoleName(n);
                    return role;
                })
                .collect(java.util.stream.Collectors.toSet());
        user.setRole(roles);
        return user;
    }

    private Borrow emprunt(int userId, int bookId, StatutBorrow statut) {
        Borrow borrow = new Borrow();
        borrow.setBookId(bookId);
        borrow.setUserId(userId);
        borrow.setStatut(statut);
        return borrow;
    }

    /** Génère un vrai JWT signé pour l'utilisateur, comme le ferait POST /authenticate. */
    private String tokenPour(String username) {
        UserDetails details = User.withUsername(username).password("ignore").roles("X").build();
        return jwtUtil.generateToken(details);
    }

    // ------------------------------------------------------------------
    // 401 — sans token, aucun accès
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Sans token, GET /borrow/user/{id} renvoie 401")
    void getByUser_sansToken_renvoie401() throws Exception {
        mockMvc.perform(get("/borrow/user/10"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Sans token, GET /borrow/book/{id} renvoie 401")
    void getByBook_sansToken_renvoie401() throws Exception {
        mockMvc.perform(get("/borrow/book/3"))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------
    // GET /borrow/user/{id} — l'adhérent accède à SES emprunts
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Un ADHERENT accède à ses propres emprunts (200)")
    void getByUser_adherentProprietaire_renvoie200() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(usersRepository.existsById(10)).thenReturn(true);
        when(borrowRepository.findByUserId(10)).thenReturn(List.of(
                emprunt(10, 3, StatutBorrow.VALIDEE),
                emprunt(10, 4, StatutBorrow.RENDU)));

        mockMvc.perform(get("/borrow/user/10").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].userId").value(10));
    }

    @Test
    @DisplayName("Un ADHERENT qui accède aux emprunts d'un autre reçoit 403 et la liste n'est jamais renvoyée")
    void getByUser_adherentEtranger_renvoie403() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));

        mockMvc.perform(get("/borrow/user/77").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden());

        verify(borrowRepository, never()).findByUserId(77);
    }

    // ------------------------------------------------------------------
    // GET /borrow/user/{id} — le personnel voit tout
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Le BIBLIOTHECAIRE accède aux emprunts de n'importe quel adhérent (200)")
    void getByUser_bibliothecaire_renvoie200() throws Exception {
        when(usersRepository.findByUsername("biblio")).thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(usersRepository.existsById(77)).thenReturn(true);
        when(borrowRepository.findByUserId(77)).thenReturn(List.of(emprunt(77, 3, StatutBorrow.EN_ATTENTE)));

        mockMvc.perform(get("/borrow/user/77").header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(77));
    }

    @Test
    @DisplayName("L'Admin hérité accède aux emprunts de n'importe quel adhérent (200)")
    void getByUser_admin_renvoie200() throws Exception {
        when(usersRepository.findByUsername("admin")).thenReturn(Optional.of(utilisateur("admin", 2, "Admin")));
        when(usersRepository.existsById(77)).thenReturn(true);
        when(borrowRepository.findByUserId(77)).thenReturn(List.of(emprunt(77, 3, StatutBorrow.EN_ATTENTE)));

        mockMvc.perform(get("/borrow/user/77").header("Authorization", "Bearer " + tokenPour("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    // ------------------------------------------------------------------
    // GET /borrow/user/{id}/pending — mêmes règles que /user/{id}
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Un ADHERENT accède à SES demandes en attente (200)")
    void getPendingByUser_adherentProprietaire_renvoie200() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(usersRepository.existsById(10)).thenReturn(true);
        when(borrowRepository.findByUserIdAndStatut(10, StatutBorrow.EN_ATTENTE))
                .thenReturn(List.of(emprunt(10, 3, StatutBorrow.EN_ATTENTE)));

        mockMvc.perform(get("/borrow/user/10/pending").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].statut").value("EN_ATTENTE"));
    }

    @Test
    @DisplayName("Un ADHERENT qui accède aux demandes d'un autre reçoit 403")
    void getPendingByUser_adherentEtranger_renvoie403() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));

        mockMvc.perform(get("/borrow/user/77/pending").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden());

        verify(borrowRepository, never()).findByUserIdAndStatut(77, StatutBorrow.EN_ATTENTE);
    }

    // ------------------------------------------------------------------
    // GET /borrow/book/{id} — réservé au personnel
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Un ADHERENT qui appelle GET /borrow/book/{id} reçoit 403")
    void getByBook_adherent_renvoie403() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));

        mockMvc.perform(get("/borrow/book/3").header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Le BIBLIOTHECAIRE consulte l'historique d'emprunts d'un livre (200)")
    void getByBook_bibliothecaire_renvoie200() throws Exception {
        when(usersRepository.findByUsername("biblio")).thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(booksRepository.existsById(3)).thenReturn(true);
        when(borrowRepository.findByBookId(3)).thenReturn(List.of(emprunt(10, 3, StatutBorrow.VALIDEE)));

        mockMvc.perform(get("/borrow/book/3").header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].bookId").value(3));
    }

    // ------------------------------------------------------------------
    // Anciennes règles inchangées — garde-fous de non-régression
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Un 'User' (rôle hérité) accède à ses propres emprunts (200)")
    void getByUser_userHerite_renvoie200() throws Exception {
        when(usersRepository.findByUsername("bob")).thenReturn(Optional.of(utilisateur("bob", 20, "User")));
        when(usersRepository.existsById(20)).thenReturn(true);
        when(borrowRepository.findByUserId(20)).thenReturn(List.of(emprunt(20, 3, StatutBorrow.VALIDEE)));

        mockMvc.perform(get("/borrow/user/20").header("Authorization", "Bearer " + tokenPour("bob")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("GET /borrow/my/quota reste réservé à l'adhérent (403 pour le BIBLIOTHECAIRE)")
    void getMyQuota_bibliothecaire_renvoie403() throws Exception {
        when(usersRepository.findByUsername("biblio")).thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));

        mockMvc.perform(get("/borrow/my/quota").header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------
    // DELETE /borrow/{id} — réservé à l'Admin, garde-fou emprunt en cours
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Sans token, DELETE /borrow/{id} renvoie 401")
    void deleteBorrow_sansToken_renvoie401() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/borrow/5"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Un ADHERENT ne peut pas supprimer un emprunt (403)")
    void deleteBorrow_adherent_renvoie403() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/borrow/5")
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden());

        verify(borrowRepository, never()).deleteById(5);
    }

    @Test
    @DisplayName("Le BIBLIOTHECAIRE ne peut pas supprimer un emprunt (403, Admin uniquement)")
    void deleteBorrow_bibliothecaire_renvoie403() throws Exception {
        when(usersRepository.findByUsername("biblio")).thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/borrow/5")
                        .header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isForbidden());

        verify(borrowRepository, never()).deleteById(5);
    }

    @Test
    @DisplayName("L'Admin ne peut pas supprimer un emprunt en cours (409) — l'exemplaire serait perdu")
    void deleteBorrow_admin_empruntEnCours_renvoie409() throws Exception {
        when(usersRepository.findByUsername("admin")).thenReturn(Optional.of(utilisateur("admin", 2, "Admin")));
        Borrow enCours = emprunt(10, 3, StatutBorrow.VALIDEE);
        enCours.setBorrowId(5);
        when(borrowRepository.findById(5)).thenReturn(Optional.of(enCours));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/borrow/5")
                        .header("Authorization", "Bearer " + tokenPour("admin")))
                .andExpect(status().isConflict());

        verify(borrowRepository, never()).delete(enCours);
    }

    @Test
    @DisplayName("L'Admin supprime un emprunt déjà retourné (200)")
    void deleteBorrow_admin_empruntRendu_renvoie200() throws Exception {
        when(usersRepository.findByUsername("admin")).thenReturn(Optional.of(utilisateur("admin", 2, "Admin")));
        Borrow rendu = emprunt(10, 3, StatutBorrow.RENDU);
        rendu.setBorrowId(5);
        rendu.setReturnDate(new java.util.Date());
        when(borrowRepository.findById(5)).thenReturn(Optional.of(rendu));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/borrow/5")
                        .header("Authorization", "Bearer " + tokenPour("admin")))
                .andExpect(status().isOk());

        verify(borrowRepository).delete(rendu);
    }

    @Test
    @DisplayName("L'Admin supprime une demande refusée (200)")
    void deleteBorrow_admin_demandeRefusee_renvoie200() throws Exception {
        when(usersRepository.findByUsername("admin")).thenReturn(Optional.of(utilisateur("admin", 2, "Admin")));
        Borrow refusee = emprunt(10, 3, StatutBorrow.REFUSEE);
        refusee.setBorrowId(7);
        when(borrowRepository.findById(7)).thenReturn(Optional.of(refusee));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/borrow/7")
                        .header("Authorization", "Bearer " + tokenPour("admin")))
                .andExpect(status().isOk());

        verify(borrowRepository).delete(refusee);
    }
}
