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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests d'intégration de la sécurité sur /api/reservations : les six endpoints
 * (POST, GET, GET/{id}, PATCH/{id}/annuler, PATCH/{id}/accepter, DELETE/{id}).
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

    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

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
        return reservationDe(userId, id, StatutReservation.EN_ATTENTE);
    }

    private Reservation reservationDe(Integer userId, long id, StatutReservation statut) {
        Reservation reservation = new Reservation();
        reservation.setId(id);
        reservation.setBookId(9);
        reservation.setUserId(userId);
        reservation.setStatut(statut);
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

    /**
     * RS-01 dans son énoncé littéral : « sans token, TOUT endpoint de réservation renvoie 401 ».
     * Un test par endpoint laisserait la porte ouverte à un oubli le jour où un endpoint est
     * ajouté : cette source est donc la liste exhaustive des routes de ReservationController.
     */
    @ParameterizedTest(name = "{0} {1} — {2}")
    @DisplayName("RS-01 : sans token, les six endpoints de réservation renvoient 401")
    @MethodSource("endpointsDeReservation")
    void tousLesEndpoints_sansToken_renvoient401(String methode, String chemin, String description)
            throws Exception {
        // Garde-fou indispensable : une route INEXISTANTE répond elle aussi 401 (la sécurité
        // tranche avant que le DispatcherServlet ne cherche un handler). Sans cette vérification,
        // une faute de frappe dans un chemin rendrait le cas « vert » pour la mauvaise raison.
        assertTrue(routeExiste(methode, ENDPOINT + chemin), () -> "Aucun mapping " + methode + " "
                + ENDPOINT + chemin + " dans ReservationController — le 401 attendu serait un faux positif");

        MockHttpServletRequestBuilder requete =
                MockMvcRequestBuilders.request(HttpMethod.valueOf(methode), ENDPOINT + chemin);
        // Un corps n'a de sens que pour les méthodes qui en portent un ; la sécurité
        // doit de toute façon refuser AVANT que le contrôleur ne lise quoi que ce soit.
        if (!"GET".equals(methode)) {
            requete = requete.contentType(APPLICATION_JSON).content("{}");
        }

        mockMvc.perform(requete)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentification requise"));
    }

    /** Les six routes exposées par ReservationController (RS-01 est une exigence par endpoint). */
    static Stream<Arguments> endpointsDeReservation() {
        return Stream.of(
                arguments("POST", "", "créer une réservation"),
                arguments("GET", "", "lister les réservations"),
                arguments("GET", "/99", "lire une réservation"),
                arguments("PATCH", "/99/annuler", "annuler une réservation"),
                arguments("PATCH", "/99/accepter", "accepter une demande de réservation"),
                arguments("DELETE", "/99", "supprimer une réservation"));
    }

    /**
     * Vrai si un handler déclaré correspond à ce couple méthode/chemin concret
     * (les chemins du contrôleur sont des motifs : « /api/reservations/{id} »).
     */
    private boolean routeExiste(String methode, String cheminConcret) {
        PathContainer chemin = PathContainer.parsePath(cheminConcret);
        RequestMethod methodeAttendue = RequestMethod.valueOf(methode);
        return handlerMapping.getHandlerMethods().keySet().stream()
                .anyMatch(info -> info.getPathPatternsCondition() != null
                        && info.getPathPatternsCondition().getPatterns().stream()
                                .anyMatch(motif -> motif.matches(chemin))
                        && info.getMethodsCondition().getMethods().contains(methodeAttendue));
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

    /**
     * RS-05 sur le chemin FILTRÉ : c'est là que la fuite est la plus facile à introduire,
     * parce que la méthode « toutes les réservations d'un statut » existe et est légitime
     * pour le personnel. Le second stub est donc une CHARGE PIÉGÉE : il contient la ligne de
     * l'adhérent 77. Si le service appelait findByStatut au lieu de findByUserIdAndStatut,
     * la réponse servirait cette ligne et le test échouerait.
     */
    @Test
    @DisplayName("RS-05 : avec ?statut=, un ADHERENT est filtré sur SON id et ne voit pas les autres adhérents")
    void getByStatut_adherent_neVoitQueSesPropresReservations() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(reservationRepository.findByStatut(StatutReservation.DEMANDE))
                .thenReturn(List.of(reservationDe(10, 1L, StatutReservation.DEMANDE),
                        reservationDe(77, 2L, StatutReservation.DEMANDE)));
        when(reservationRepository.findByUserIdAndStatut(10, StatutReservation.DEMANDE))
                .thenReturn(List.of(reservationDe(10, 1L, StatutReservation.DEMANDE)));

        mockMvc.perform(get(ENDPOINT).param("statut", "DEMANDE")
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(10));

        verify(reservationRepository).findByUserIdAndStatut(10, StatutReservation.DEMANDE);
        verify(reservationRepository, never()).findByStatut(any());
    }

    @Test
    @DisplayName("RS-05 (contre-épreuve) : avec ?statut=, le BIBLIOTHECAIRE voit TOUTES les réservations du statut")
    void getByStatut_bibliothecaire_voitToutesLesReservationsDuStatut() throws Exception {
        when(usersRepository.findByUsername("biblio"))
                .thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(reservationRepository.findByStatut(StatutReservation.DEMANDE))
                .thenReturn(List.of(reservationDe(10, 1L, StatutReservation.DEMANDE),
                        reservationDe(77, 2L, StatutReservation.DEMANDE)));

        mockMvc.perform(get(ENDPOINT).param("statut", "DEMANDE")
                        .header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        verify(reservationRepository).findByStatut(StatutReservation.DEMANDE);
        verify(reservationRepository, never()).findByUserIdAndStatut(any(), any());
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

    // ------------------------------------------------------------------
    // RS-03 — Annulation : la même règle de propriété que la lecture
    // ------------------------------------------------------------------

    @Test
    @DisplayName("RS-03 : un ADHERENT qui annule la réservation d'un autre reçoit 403")
    void annuler_reservationDUnAutreAdherent_renvoie403() throws Exception {
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(reservationRepository.findById(99L)).thenReturn(Optional.of(reservationDe(77, 99L)));

        mockMvc.perform(patch(ENDPOINT + "/99/annuler")
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("La réservation 99 n'appartient pas à l'adhérent 'alice'"));
    }

    @Test
    @DisplayName("RS-03 (contre-épreuve) : un ADHERENT annule SA réservation → 200 et statut ANNULEE")
    void annuler_saPropreReservation_renvoie200EtStatutAnnulee() throws Exception {
        // Sans ce cas, le 403 ci-dessus pourrait passer pour la mauvaise raison :
        // un endpoint cassé qui refuserait TOUT LE MONDE.
        when(usersRepository.findByUsername("alice")).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(reservationRepository.findById(55L)).thenReturn(Optional.of(reservationDe(10, 55L)));
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(patch(ENDPOINT + "/55/annuler")
                        .header("Authorization", "Bearer " + tokenPour("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(10))
                .andExpect(jsonPath("$.statut").value("ANNULEE"));
    }

    @Test
    @DisplayName("RS-03 : le BIBLIOTHECAIRE annule la réservation de n'importe quel adhérent (200)")
    void annuler_parBibliothecaire_reservationDUnAdherent_renvoie200() throws Exception {
        when(usersRepository.findByUsername("biblio"))
                .thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(reservationRepository.findById(77L)).thenReturn(Optional.of(reservationDe(10, 77L)));
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(patch(ENDPOINT + "/77/annuler")
                        .header("Authorization", "Bearer " + tokenPour("biblio")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(10))
                .andExpect(jsonPath("$.statut").value("ANNULEE"));
    }

    // ------------------------------------------------------------------
    // RS-02 — Actions réservées au personnel
    // ------------------------------------------------------------------

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
    // RS-04 — L'identité vient du token, pas du corps de la requête
    // ------------------------------------------------------------------

    @Test
    @DisplayName("RS-04 : un ADHERENT qui met le userId d'un autre dans le corps se voit attribuer SON propre id (token)")
    void create_adherentAvecUserIdDUnAutreDansLeCorps_identitePriseDuToken() throws Exception {
        // alice (id 10) tente de créer une réservation POUR l'adhérent 77 en trichant sur le corps
        when(usersRepository.findByUsername("alice"))
                .thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(usersRepository.findById(10)).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(booksRepository.findById(3)).thenReturn(Optional.of(livre(3, "Dune", 0)));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(3), anyList())).thenReturn(false);
        // Le quota est compté sur l'id du TOKEN (10) — la preuve que le corps a été ignoré
        when(reservationRepository.countByUserIdAndStatutIn(eq(10), anyList())).thenReturn(0L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("alice"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookId\":3,\"userId\":77}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(10));
    }

    // ------------------------------------------------------------------
    // Workflow DEMANDE → acceptation par le personnel
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Workflow : une réservation créée par le personnel pour un adhérent est directement EN_ATTENTE (pas une DEMANDE)")
    void create_parStaffPourUnAdherent_statutDirectementEnAttente() throws Exception {
        // Le staff (biblio, id 1) crée une réservation POUR l'adhérent alice (id 10)
        when(usersRepository.findByUsername("biblio"))
                .thenReturn(Optional.of(utilisateur("biblio", 1, "BIBLIOTHECAIRE")));
        when(usersRepository.findById(10)).thenReturn(Optional.of(utilisateur("alice", 10, "ADHERENT")));
        when(booksRepository.findById(3)).thenReturn(Optional.of(livre(3, "Dune", 0)));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(3), anyList())).thenReturn(false);
        // Le quota est compté sur l'adhérent VISÉ (10), pas sur le staff
        when(reservationRepository.countByUserIdAndStatutIn(eq(10), anyList())).thenReturn(0L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(post(ENDPOINT)
                        .header("Authorization", "Bearer " + tokenPour("biblio"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookId\":3,\"userId\":10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(10))
                .andExpect(jsonPath("$.statut").value("EN_ATTENTE"));
    }

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
