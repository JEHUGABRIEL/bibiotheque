package com.ibizabroker.bibliotheque;

import com.ibizabroker.bibliotheque.dao.RoleRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Role;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.Set;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Création d'un compte par l'API d'administration : qui a le droit, et avec quel rôle.
 *
 * <p>Ce test existe à cause d'un trou réel : {@code POST /admin/users} était le SEUL
 * endpoint de {@code AdminController} sans {@code @PreAuthorize}. N'importe quel
 * utilisateur authentifié — un simple ADHERENT — pouvait donc créer un compte avec
 * le rôle {@code Admin}, puis se connecter avec et obtenir tous les droits.
 * Les autres méthodes du contrôleur ({@code GET}, {@code PUT}) étaient bien protégées,
 * ce qui rendait l'oubli invisible à la lecture rapide.</p>
 *
 * <p>Le contexte Spring démarre entièrement : filtre JWT réel + SecurityConfig +
 * {@code @PreAuthorize}. Les tokens sont de vrais tokens signés par {@link JwtUtil}.
 * Les repositories sont simulés : aucun base de données n'est nécessaire.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminUserSecurityIntegrationTest {

    private static final String ENDPOINT = "/admin/users";
    private static final String CORPS_ADHERENT = """
            {"username":"nouveau","name":"Nouveau Membre","password":"test1234",
             "role":[{"roleName":"ADHERENT"}]}
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockBean
    private UsersRepository usersRepository;

    @MockBean
    private RoleRepository roleRepository;

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

    /** Vrai JWT signé, comme celui produit par {@code POST /authenticate}. */
    private String tokenPour(String username) {
        UserDetails details = User.withUsername(username).password("ignore").roles("X").build();
        return jwtUtil.generateToken(details);
    }

    private void connecte(String username, String roleName, int userId) {
        when(usersRepository.findByUsername(username))
                .thenReturn(Optional.of(utilisateur(username, userId, roleName)));
    }

    // ------------------------------------------------------------------
    // Le trou : qui peut créer un compte ?
    // ------------------------------------------------------------------

    @Test
    @DisplayName("sans token, POST /admin/users renvoie 401")
    void addUser_sansToken_renvoie401() throws Exception {
        mockMvc.perform(post(ENDPOINT).contentType(APPLICATION_JSON).content(CORPS_ADHERENT))
                .andExpect(status().isUnauthorized());

        verify(usersRepository, never()).save(any(Users.class));
    }

    @Test
    @DisplayName("un ADHERENT ne peut pas créer de compte : 403 (régression — l'endpoint était ouvert)")
    void addUser_adherent_renvoie403() throws Exception {
        connecte("alice", "ADHERENT", 10);

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("alice"))
                        .contentType(APPLICATION_JSON)
                        .content(CORPS_ADHERENT))
                .andExpect(status().isForbidden());

        verify(usersRepository, never()).save(any(Users.class));
    }

    @Test
    @DisplayName("un ADHERENT ne peut pas se fabriquer un compte Admin : 403, rien n'est écrit")
    void addUser_adherentQuiDemandeLeRoleAdmin_renvoie403() throws Exception {
        connecte("alice", "ADHERENT", 10);
        String escalade = """
                {"username":"escalade","name":"Escalade","password":"test1234",
                 "role":[{"roleName":"Admin"}]}
                """;

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("alice"))
                        .contentType(APPLICATION_JSON)
                        .content(escalade))
                .andExpect(status().isForbidden());

        verify(usersRepository, never()).save(any(Users.class));
    }

    @Test
    @DisplayName("un BIBLIOTHECAIRE ne peut pas créer de compte : 403 (réservé à l'Admin)")
    void addUser_bibliothecaire_renvoie403() throws Exception {
        connecte("biblio", "BIBLIOTHECAIRE", 1);

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("biblio"))
                        .contentType(APPLICATION_JSON)
                        .content(CORPS_ADHERENT))
                .andExpect(status().isForbidden());

        verify(usersRepository, never()).save(any(Users.class));
    }

    // ------------------------------------------------------------------
    // L'Admin, lui, peut — et le rôle vient de la base, pas du corps
    // ------------------------------------------------------------------

    @Test
    @DisplayName("un Admin crée un compte : 200, et le rôle enregistré est celui résolu en base")
    void addUser_admin_renvoie200_etLeRoleVientDeLaBase() throws Exception {
        connecte("admin", "Admin", 1);
        Role roleAdherent = new Role();
        roleAdherent.setRoleId(4);
        roleAdherent.setRoleName("ADHERENT");
        when(roleRepository.findByRoleName("ADHERENT")).thenReturn(Optional.of(roleAdherent));
        when(usersRepository.save(any(Users.class))).thenAnswer(invocation -> {
            Users enregistre = invocation.getArgument(0);
            enregistre.setUserId(151);
            return enregistre;
        });

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("admin"))
                        .contentType(APPLICATION_JSON)
                        .content(CORPS_ADHERENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(151))
                .andExpect(jsonPath("$.message", containsString("créé avec succès")));

        ArgumentCaptor<Users> capture = ArgumentCaptor.forClass(Users.class);
        verify(usersRepository).save(capture.capture());
        Users ecrit = capture.getValue();

        assertEquals("nouveau", ecrit.getUsername());
        // L'entité Role persistée, pas un objet Role reconstruit depuis la requête
        assertEquals(4, ecrit.getRole().iterator().next().getRoleId());
        assertEquals("ADHERENT", ecrit.getRole().iterator().next().getRoleName());
        // Le mot de passe est encodé, jamais stocké en clair
        assertEquals(false, "test1234".equals(ecrit.getPassword()));
    }

    @Test
    @DisplayName("un nom de rôle inconnu est refusé en 400 : les valeurs valides sont celles de la base")
    void addUser_roleInconnu_renvoie400() throws Exception {
        connecte("admin", "Admin", 1);
        when(roleRepository.findByRoleName(anyString())).thenReturn(Optional.empty());
        String roleAccentue = """
                {"username":"essai","name":"Essai","password":"test1234",
                 "role":[{"roleName":"Adhérent"}]}
                """;

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("admin"))
                        .contentType(APPLICATION_JSON)
                        .content(roleAccentue))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Adhérent")))
                .andExpect(jsonPath("$.message", containsString("introuvable")));

        verify(usersRepository, never()).save(any(Users.class));
    }
}
