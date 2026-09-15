# Exigences de tests — Sécurisation du module Réservation (Séance 4)

Ce document énonce **ce que les tests doivent prouver**, côté backend et côté frontend, et
où chaque exigence est satisfaite dans le dépôt. Il sert de référence pour la relecture de
la Pull Request et de support pendant la soutenance.

Convention d'identifiant : `ET-B-*` (backend), `ET-F-*` (frontend).
Statut : **✔** couvert · **✎** recommandé, non exigé par l'énoncé.

---

## 0. Commandes de test (les seules à connaître)

```bash
# Backend — 71 tests, H2 en mémoire, AUCUNE base de données requise
cd bibliotheque-backend && ./mvnw test

# Frontend — 234 tests, Chrome headless, AUCUN backend requis
cd bibliotheque-frontend
npm test                                                      # mode watch (dev)
CHROME_BIN=/usr/bin/google-chrome npx ng test --watch=false --browsers=ChromeHeadless   # CI
```

`karma.conf.js` déclare le navigateur `Chrome` **avec watch** par défaut : une exécution
non interactive exige `--watch=false --browsers=ChromeHeadless` (le poste peut surcharger
`CHROME_BIN` par un `ChromeHeadlessNoSandbox` si Chrome refuse de démarrer en sandbox).

---

## 1. Exigences transverses

| Id | Exigence | Statut |
|---|---|---|
| **ET-B-00** | `./mvnw test` exécute toute la suite **sans base de données**, sans variable d'environnement et sans manipulation manuelle (H2 en mémoire via `src/test/resources/application.properties`, `ddl-auto=create-drop`) | ✔ |
| **ET-B-01** | Un test par règle du barème : RS-01 à RS-05, plus RG-01 et RG-03 | ✔ |
| **ET-B-02** | Les noms de méthodes décrivent `<action>_<situation>_<résultat attendu>` (`getAll_sansToken_renvoie401`) — jamais `test1`, `testService` | ✔ |
| **ET-B-03** | Un test qui échoue doit rester diagnostiquable seul : assertion sur le **code HTTP** *et* sur le corps utile (pas seulement `isOk()`) | ✔ |
| **ET-B-04** | Toute réponse d'**erreur** porte le même corps : `{ message, status, timestamp }` (`timestamp` ISO-8601 **avec décalage**), produit par `ApiErrorResponse` — quel que soit le composant qui l'écrit (contrôleur, service, filtres Spring Security) et quel que soit le code (400/401/403/404/409/500) | ✔ |
| **ET-B-05** | Les réponses de **succès** ne sont PAS enveloppées : `GET /api/reservations` reste un tableau nu, consommé tel quel par le frontend | ✔ |
| **ET-F-00** | `npm test` exécute toute la suite sans backend, sans base et sans réseau (tout HTTP passe par `HttpTestingController`) | ✔ |
| **ET-F-01** | Les descriptions de `it()` énoncent le comportement observable (« un adhérent ne poste aucun userId (RS-04) ») | ✔ |

---

## 2. Backend

### 2.1 Tests unitaires — couche service, repository simulé

Exigence de l'énoncé : *« Le repository doit être simulé (mock), pas connecté à une vraie
base. Le test doit passer sans qu'aucune base ne tourne. »*

| Id | Exigence | Test | Statut |
|---|---|---|---|
| **ET-B-U01** | **RG-03** — un adhérent avec **2** réservations actives peut en créer une **3ᵉ** | `ReservationServiceQuotaTest.create_avecDeuxReservationsActives_troisiemeAcceptee` | ✔ |
| **ET-B-U02** | **RG-03** — un adhérent avec **3** réservations actives reçoit un **refus** (`ConflictException`) | `ReservationServiceQuotaTest.create_avecTroisReservationsActives_refusee` | ✔ |
| **ET-B-U03** | Le quota ne compte que les statuts **actifs** : une réservation `ANNULEE` libère une place | `ReservationServiceQuotaTest.create_leCompteurIgnoreLesReservationsAnnulees` | ✔ |
| **ET-B-U04** | Réservation d'un livre **non enregistré** : le livre est créé (0 exemplaire) puis réservé | `ReservationServiceNewBookTest.create_avecLivreNonEnregistre_leCreeEtLeReserve` | ✔ |
| **ET-B-U05** | Un nom de livre existant est **réutilisé**, pas dupliqué (comparaison insensible à la casse) | `ReservationServiceNewBookTest.create_avecNomDeLivreExistant_reutiliseLeLivre` | ✔ |
| **ET-B-U06** | Sans `bookId` **ni** `newBookName`, la création est refusée (`BadRequestException`) | `ReservationServiceNewBookTest.create_sansLivreNiNom_refusee` | ✔ |
| **ET-B-U07** | Le **format** du corps d'erreur est verrouillé sans contexte Spring : ordre des clés (`message`, `status`, `timestamp`), `status` recopié du `HttpStatus` passé, timestamp **reparsable** par `OffsetDateTime.parse` avec le décalage **local** du serveur, `401` enrichi de `expired` | `ApiErrorResponseTest` (5 tests) | ✔ |

Mise en œuvre : `@ExtendWith(MockitoExtension.class)`, `@Mock ReservationRepository /
BooksRepository / UsersRepository`, `@InjectMocks ReservationService`. Aucun contexte Spring,
donc aucun démarrage de base (0,01 s pour la classe `ReservationServiceQuotaTest`).

### 2.2 Tests d'intégration — endpoints sécurisés

Exigence de l'énoncé : *« Écrivez un test d'intégration sur GET `/api/reservations` qui
vérifie : sans token → 401 ; avec un token ADHERENT → 200 ; avec un token ADHERENT, sur la
réservation d'un autre → 403. »*

Mise en œuvre : `@SpringBootTest` + `@AutoConfigureMockMvc`, **vrai** `JwtRequestFilter`,
**vraies** chaînes JWT signées par `JwtUtil`, repositories `@MockBean`. Le filtre, la
configuration de sécurité et les `@PreAuthorize` sont donc réellement traversés — c'est ce
qui distingue ces tests des tests unitaires.

Les exigences **ET-B-I18 à I18c** sont portées par une seconde classe,
`ApiErrorResponseIntegrationTest`, pour une raison de fond : un corps d'erreur n'a pas un
seul auteur. Le **401** est écrit par `JwtAuthenticationEntryPoint` (un filtre, avant tout
contrôleur), le **403** de filtrage par le `AccessDeniedHandler`, le **403 métier** et les
**400/404/409/500** par le `@RestControllerAdvice`, et le **401 d'`/authenticate`**
directement par le contrôleur. Quatre chemins de code pour un même contrat : sans test sur
chacun, trois d'entre eux pouvaient garder l'ancien corps `{"message": ...}` et passer
inaperçu, puisque les tests existants n'assertent que `$.message`.

| Id | Exigence | Test (`ReservationSecurityIntegrationTest`) | Statut |
|---|---|---|---|
| **ET-B-I01** | **RS-01** — `GET /api/reservations` **sans token** → **401** *(exigence explicite de l'énoncé)* | `getAll_sansToken_renvoie401` | ✔ |
| **ET-B-I02** | **RS-01** — `GET /api/reservations/{id}` sans token → **401** | `getById_sansToken_renvoie401` | ✔ |
| **ET-B-I03** | **RS-05** — un ADHERENT reçoit **200** et **uniquement ses** réservations *(exigence explicite)* | `getAll_adherent_renvoieSesReservationsSeulement` | ✔ |
| **ET-B-I04** | **RS-03** — un ADHERENT sur la réservation **d'un autre** → **403** *(exigence explicite)* | `getById_reservationDUnAutreAdherent_renvoie403` | ✔ |
| **ET-B-I05** | Un BIBLIOTHECAIRE lit la réservation de n'importe quel adhérent → 200 | `getById_bibliothecaire_renvoie200` | ✔ |
| **ET-B-I06** | **RS-02** — `DELETE /api/reservations/{id}` par un ADHERENT → **403** | `delete_parAdherent_renvoie403` | ✔ |
| **ET-B-I07** | **RS-04** — un ADHERENT qui place le `userId` **d'un autre** dans le corps obtient une réservation **à son nom** *(le poste le plus lourd du barème)* | `create_adherentAvecUserIdDUnAutreDansLeCorps_identitePriseDuToken` | ✔ |
| **ET-B-I08** | Distinction **401 vs 403** : un token **expiré** → 401 (et non 403) avec le message « Session expirée » | `getById_tokenExpire_renvoie401AvecMessageSessionExpiree` | ✔ |
| **ET-B-I09** | **RG-01** — réserver un livre **disponible** → **409** | `create_livreDisponible_renvoie409` | ✔ |
| **ET-B-I10** | **RG-01** — réserver un livre à **0 exemplaire** → accepté | `create_livreIndisponible_estAccepte` | ✔ |
| **ET-B-I11** | Le personnel qui réserve **pour un adhérent** obtient directement `EN_ATTENTE` (pas `DEMANDE`) | `create_parStaffPourUnAdherent_statutDirectementEnAttente` | ✔ |
| **ET-B-I12** | Workflow complet : l'adhérent crée une `DEMANDE`, le personnel l'accepte → `EN_ATTENTE` | `workflow_adherentCreeDemande_staffAccepte_versEnAttente` | ✔ |
| **ET-B-I13** | `PATCH /{id}/accepter` sur un statut ≠ `DEMANDE` → **409** | `accepter_statutNonDemande_renvoie409` | ✔ |
| **ET-B-I14** | `PATCH /{id}/accepter` sans token → **401** | `accepter_sansToken_renvoie401` | ✔ |
| **ET-B-I15** | **RS-01 exhaustif** : les **six** endpoints de réservation (POST, GET, GET/{id}, PATCH/{id}/annuler, PATCH/{id}/accepter, DELETE/{id}) refusent l'anonyme. La route doit en outre **exister réellement** (vérifié via `RequestMappingHandlerMapping`) : sans ce garde-fou, une faute de frappe dans un chemin rendrait le cas vert pour la mauvaise raison, puisqu'une route inexistante répond 401 elle aussi | `tousLesEndpoints_sansToken_renvoient401` + `endpointsDeReservation()` (`@ParameterizedTest`) | ✔ |
| **ET-B-I16** | **RS-03 sur l'annulation** : `PATCH /{id}/annuler` sur la réservation d'un autre → **403** | `annuler_reservationDUnAutreAdherent_renvoie403` | ✔ |
| **ET-B-I16b** | *Contre-épreuve* de ET-B-I16 : le même adhérent annule **sa** réservation → 200 et statut `ANNULEE`. Sans ce cas, le 403 pourrait tout aussi bien venir d'un endpoint qui refuse tout le monde | `annuler_saPropreReservation_renvoie200EtStatutAnnulee` | ✔ |
| **ET-B-I16c** | Le BIBLIOTHECAIRE annule la réservation de **n'importe quel** adhérent → 200 (seconde moitié de la ligne du tableau des autorisations) | `annuler_parBibliothecaire_reservationDUnAdherent_renvoie200` | ✔ |
| **ET-B-I17** | **RS-05 sur `?statut=`** : le filtre par statut d'un ADHERENT est appliqué **sur son propre id** et ne peut pas faire fuiter les lignes d'un autre. Le stub de `findByStatut` (la méthode légitime pour le personnel) est une **charge piégée** contenant la ligne d'un autre adhérent : si le service empruntait ce chemin, la fuite apparaîtrait dans la réponse et le test échouerait (`size 1` attendu, `2` obtenu) | `getByStatut_adherent_neVoitQueSesPropresReservations` (+ `verify(…, never()).findByStatut(…)`) | ✔ |
| **ET-B-I17b** | *Contre-épreuve* de ET-B-I17 : le BIBLIOTHECAIRE, avec `?statut=`, reçoit bien **toutes** les lignes du statut | `getByStatut_bibliothecaire_voitToutesLesReservationsDuStatut` | ✔ |
| **ET-B-I18** | **Enveloppe d'erreur au niveau HTTP** : 400 (requête incomplète), 401 (sans token *et* identifiants incorrects), 403 (rôle insuffisant *et* réservation d'autrui), 404, 409, 500 — chacun renvoie `message` non vide + `status` **égal au code HTTP** + `timestamp` à moins de 60 s de la réponse | `ApiErrorResponseIntegrationTest` (8 cas) | ✔ |
| **ET-B-I18b** | Le corps du 401 porte `expired` : `false` pour un jeton absent, `true` pour un jeton expiré — c'est ce champ que lit `AuthInterceptor` pour choisir son message | `sansToken_401_expiredEstFaux` | ✔ |
| **ET-B-I18c** | *Contre-épreuve* de ET-B-I18 : une réponse **2xx** (`GET /api/reservations`) reste un **tableau nu**, sans enveloppe — sans ce cas, envelopper tout le body passerait pour un progrès | `succes_nonEnveloppe` | ✔ |

**Hors périmètre séance 4, conservé comme garde-fou :** `BorrowSecurityIntegrationTest`
(18 tests) applique la même méthode aux emprunts — 401 anonyme, staff-ou-propriétaire sur
`GET /borrow/user/{id}` et `/pending`, `GET /borrow/book/{id}` réservé au personnel,
`DELETE /borrow/{id}` réservé à l'Admin, `GET /borrow/my/quota` interdit au personnel.

### 2.3 Traçabilité du barème backend

| Barème (points) | Couvert par |
|---|---|
| Authentification exigée sur tous les endpoints — RS-01 (4) | ET-B-I15 (les 6 routes, existence vérifiée), ET-B-I01, ET-B-I02, ET-B-I14 |
| Autorisations par rôle — RS-02 (5) | ET-B-I06 (`DELETE`), ET-B-I05, ET-B-I13 |
| Un adhérent ne voit et ne modifie que ses réservations — RS-03, RS-05 (5) | ET-B-I03, ET-B-I04, ET-B-I16, ET-B-I17 (+ I16b/I16c/I17b comme contre-épreuves) |
| L'identité vient du token, pas du corps — RS-04 (4) | ET-B-I07, ET-B-U04 |
| Distinction correcte 401 / 403 (2) | ET-B-I08 |
| Test unitaire RG-03, repository simulé (5) | ET-B-U01, ET-B-U02, ET-B-U03 |
| Test d'intégration sur endpoint sécurisé (5) | ET-B-I01, ET-B-I03, ET-B-I04 |

---

## 3. Frontend

Le frontend **ne peut pas prouver** RS-01, RS-02, RS-03 ni RS-04 : ce sont des décisions du
serveur. Les tests Angular vérifient donc deux choses différentes et complémentaires :

1. que le client **envoie ce qu'il doit envoyer** (jeton, absence de `userId` pour un adhérent) ;
2. qu'il **réagit correctement aux décisions du serveur** (401 → reconnexion, 403 → page
   d'interdiction, 409 → message métier sans redirection).

La preuve d'autorisation reste, et doit rester, côté backend (§2.2).

### 3.1 Contrat HTTP des services (unitaires)

Mise en œuvre : `TestBed` + `HttpClientTestingModule` + `HttpTestingController`. Chaque
`it()` vérifie **verbe + URL + corps + en-têtes**, puis l'erreur propagée (`expect(req.request…)`).

| Id | Exigence | Fichier | Statut |
|---|---|---|---|
| **ET-F-S01** | `ReservationService` cible le préfixe `/api/reservations` sur les 6 opérations (liste, détail, création, annulation, acceptation, catalogue) | `_service/reservation.service.spec.ts` (10 tests) | ✔ |
| **ET-F-S02** | **RS-04 côté client** : un adhérent ne place **aucun `userId`** dans le corps du POST | `reservation.service.spec.ts` · `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-S03** | `newBookName` est bien sérialisé pour un livre non enregistré | `reservation.service.spec.ts` | ✔ |
| **ET-F-S04** | Le filtre par statut part en **query string** (`?statut=`) et non dans le corps | `reservation.service.spec.ts` | ✔ |
| **ET-F-S05** | Les opérations d'écriture utilisent le bon verbe (`PATCH …/annuler`, `PATCH …/accepter`) | `reservation.service.spec.ts` | ✔ |
| **ET-F-S06** | Les erreurs du backend (403, 409) remontent intactes au composant | `reservation.service.spec.ts` · `borrow.service.spec.ts` (14 tests) · `books.service.spec.ts` (6) | ✔ |
| **ET-F-S07** | `UserAuthService` : la session est écrite (`roles`, `jwtToken`, `userId`, `name`) et `clear()` **ne détruit que** ces clés — `theme`, `lang`, `bibliotheque.notifRead` et `notifSelfCancel` survivent | `_service/user-auth.service.spec.ts` (9 tests) | ✔ |

### 3.2 Sécurité côté client : intercepteur et garde

| Id | Exigence | Test | Statut |
|---|---|---|---|
| **ET-F-SEC01** | L'`AuthInterceptor` ajoute `Authorization: Bearer <jeton>` à **tous** les appels métier | `auth.interceptor.spec.ts` · `api-security.integration.spec.ts` | ✔ |
| **ET-F-SEC02** | Aucun jeton n'est ajouté aux appels marqués `No-Auth` (`/authenticate`) | `auth.interceptor.spec.ts` · `api-security.integration.spec.ts` | ✔ |
| **ET-F-SEC03** | **401** → purge de la session **et** redirection vers `/login`, en laissant l'erreur remonter | `auth.interceptor.spec.ts` · `api-security.integration.spec.ts` · `login.integration.spec.ts` | ✔ |
| **ET-F-SEC04** | **401 sur `/api/reservations` est traité localement** : la page affiche l'erreur, **pas** de redirection globale (choix assumé : l'utilisateur garde son contexte) | `auth.interceptor.spec.ts` · `api-security.integration.spec.ts` · `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-SEC05** | **403** → `/forbidden` pour un appel global ; **pas** de redirection sur `/api/reservations` (le 403 y est une règle métier : réservation d'autrui) | `auth.interceptor.spec.ts` · `api-security.integration.spec.ts` | ✔ |
| **ET-F-SEC06** | 409 et 500 **ne redirigent pas** : le message du backend est présenté à l'utilisateur | `api-security.integration.spec.ts` | ✔ |
| **ET-F-SEC07** | L'`AuthGuard` : sans jeton → `/login` ; rôle attendu absent → `/forbidden` ; rôle présent → passe (y compris quand aucun rôle n'est exigé) | `auth.guard.spec.ts` (4 tests) | ✔ |

### 3.3 Écrans — tests d'intégration (composant + template + service + intercepteur)

Dossier `src/app/_integration/`. Le backend HTTP est simulé, mais **toute la chaîne cliente
est réelle** : composants, templates, services, intercepteur, routeur.

| Id | Exigence | Fichier | Statut |
|---|---|---|---|
| **ET-F-I01** | La liste affiche les réservations avec le **titre du livre résolu** (jamais « Livre #id ») | `reservation-flow.integration.spec.ts` (24 tests) | ✔ |
| **ET-F-I02** | Un adhérent **n'appelle pas** `/admin/users` ; le personnel charge la liste des adhérents **filtrée du personnel** | `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-I03** | **RG-01 côté client** : seuls les livres à **0 exemplaire** sont réservables ; le conflit 409 du serveur est affiché | `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-I04** | **Libellés par rôle** : « Nouvelle demande de réservation » côté adhérent, « Nouvelle réservation » côté personnel | `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-I05** | Le personnel doit **choisir un adhérent** : aucune requête n'est envoyée sinon | `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-I06** | **Accepter** n'est proposé que sur les `DEMANDE` **et** seulement au personnel ; succès → ligne mise à jour **sans rechargement** | `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-I07** | L'annulation par un adhérent marque le self-cancel (la cloche de notifications l'ignore) ; **une annulation par le personnel ne l'est pas** | `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-I08** | Arrivée depuis une autre page : `?reserve=<id>` présélectionne le livre, `?reserveName=<nom>` pré-remplit un livre inconnu | `reservation-flow.integration.spec.ts` | ✔ |
| **ET-F-I09** | Après connexion, la session est écrite puis redirection vers `/dashboard` ; un mot de passe refusé n'écrit **aucune** session | `login.integration.spec.ts` (6 tests) | ✔ |
| **ET-F-I10** | Les emprunts : tableau unique filtré par statut, validation/refus/retour, suppression simple *vs* renforcée (nom exact), quota adhérent | `borrow-book.integration.spec.ts` (19 tests) | ✔ |
| **ET-F-I11** | Les retours : le personnel charge `GET /borrow`, l'adhérent **uniquement** `GET /borrow/user/{id}` | `return-book.integration.spec.ts` (12 tests) | ✔ |
| **ET-F-I12** | ✎ Parcours de **refus en direct** prêt pour la soutenance : annulation de la réservation d'autrui → 403 affiché, aucun état modifié | à ajouter (variante DOM de ET-B-I16) | ✎ |
| **ET-F-I13** | **Libellé d'annulation piloté par le statut** : une `DEMANDE` pas encore validée par l'admin s'annule en tant que **demande**, une `EN_ATTENTE` (validée) ou `DISPONIBLE` en tant que **réservation** — dans la modale de détail **et** dans la modale de confirmation. Le libellé se recalcule si le statut change modale ouverte (acceptation en direct) et ne dépend **pas** du rôle | `reservation-flow.integration.spec.ts` (describe « libellé de l'annulation dans la modale de détail », 5 tests) · `reservation-container.component.spec.ts` (`cancelLabelFor`, 5 tests) · `reservation-details.component.spec.ts` (6 tests) | ✔ |

| **ET-F-I14** | **Diaporama plein écran de la page d'accueil** : la barre du haut porte le logo (icône + « Bibliothèque ») à gauche et « Se connecter » à droite (masqué une fois connecté), le sous-titre retiré n'est plus rendu, et les textes du slide courant occupent le centre. Chaque image porte ses propres textes (étiquette, titre, paragraphe, bouton), un seul slide est actif à la fois. Navigation par **pastilles** et par **clavier** (les flèches à l'écran ont été retirées à la demande de l'utilisateur), défilement automatique, suspension au survol, et **aucun minuteur survivant à la destruction** du composant. Le bouton d'un slide mène à la fonctionnalité décrite pour un compte connecté, et à `/login` pour un visiteur | `home.component.spec.ts` (18 tests) | ✔ |
| **ET-F-I15** | **Bouton de retour sur la page de connexion** : un bouton (et non un lien) ramène à l'accueil par navigation Angular, sans rechargement ni chevauchement du formulaire | `login.component.spec.ts` (4 tests) | ✔ |

> La couverture d'une image plein écran ne se prouve pas en test unitaire (la fixture Karma n'a pas de hauteur de viewport) : elle a été **mesurée au navigateur** via le protocole DevTools sur `ng build` servi localement — à 1920x1080, 1280x800, 1024x768 et 390x844, `.app-main` a `padding: 0` et l'image du slide actif occupe exactement la taille du viewport, sans débordement.

Les autres écrans sont couverts par un spec unitaire de composant (34 fichiers `*.spec.ts`
au total, 268 tests) : `books-list`, `users-list`, `create-book`, `update-book`,
`book-details`, `user-details`, `update-user`, `registration`, `sidebar`, `header`, `home`,
`forbidden`, `logout`, plus les modèles (`_model/*.spec.ts`).

### 3.4 Limites assumées

- **Aucun test end-to-end** (Cypress / Playwright / Protractor) : le projet n'en a pas, et
  en ajouter sort du périmètre de la séance. Les garanties d'autorisation sont donc
  **backend**, pas navigateur.
- Les tests d'intégration frontend **simulent** le backend : ils ne détectent pas une
  divergence de contrat (l'API peut renvoyer un 200 là où le test attend un 403). C'est
  exactement ce que couvrent les tests d'intégration backend (§2.2), et la raison pour
  laquelle les deux niveaux coexistent.
- Les dates de l'API sont au format `dd-MM-yyyy` (et non ISO) : les fixtures des tests
  doivent respecter ce format. Utiliser une date ISO dans une fixture **masque** un
  `InvalidPipeArgument` réel — c'est arrivé une fois sur la page Emprunter.

---

## 4. Ce qu'il reste à faire

Tous les manques qui touchaient le barème sont comblés : RS-01 sur les six routes
(ET-B-I15), l'annulation d'autrui (ET-B-I16) et le filtre par statut (ET-B-I17). Les deux
chemins de lecture de `/api/reservations` sont désormais couverts au niveau HTTP.

Il ne reste qu'une amélioration, utile à la démonstration mais **non exigée** par l'énoncé :

1. **ET-F-I12** — variante DOM du refus d'annulation côté frontend (le backend est déjà
   couvert par ET-B-I16 ; inutile de le faire si le temps manque).

Une PR qui l'ajoute doit aussi mettre à jour les tableaux ci-dessus — ce sont eux qui font foi.

---

## 5. Rejouer la démonstration

```bash
docker compose up -d db                                   # base PostgreSQL (port 5432)
cd bibliotheque-backend
set -a; source ../docker/backend.env.local; set +a
./mvnw spring-boot:run                                    # backend sur :8080

cd ../.. && ./docker/seed-demo.sh                         # comptes + catalogue + réservations
```

`docker/seed-demo.sh` est **idempotent** : il ne recrée pas ce qui existe. Il affiche les
identifiants, les réservations à présenter, et il vérifie lui-même 401 / 200 / 403 en direct.

**Explorer l'API :** Swagger UI sur <http://localhost:8080/swagger-ui/index.html>
(descriptif OpenAPI sur `/v3/api-docs`). Le bouton « Authorize » attend le jeton renvoyé par
`POST /authenticate`, **sans** le préfixe `Bearer` — Swagger UI l'ajoute lui-même. C'est le
moyen le plus rapide de reproduire RS-01/RS-02/RS-03 sans écrire de `curl` :
- sans jeton → 401 ;
- avec le jeton d'`adherent1`, `GET /api/reservations/{id}` sur la réservation #2 (qui
  appartient à `adherent2`) → 403.

> Le jeton est résolu au démarrage : un backend lancé **avant** l'ajout de la dépendance
> springdoc répond 401 sur `/swagger-ui/index.html`. Redémarrer le backend suffit.
