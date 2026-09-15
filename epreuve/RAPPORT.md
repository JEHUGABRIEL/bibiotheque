# Épreuve Séance 1 — Rapport

- **Nom / Prénom** : Jehu
- **Branche** : `epreuve/jehu`
- **Date** : 14 août

> Règles de rendu : chaque réponse de la partie 2 doit citer le **chemin exact** du
> fichier (une réponse sans chemin vaut zéro). Les parties 1, 2 et 4 se rédigent ici ;
> la partie 3 (Docker) se rend par les fichiers à leur place normale (racine +
> sous-projets), avec les preuves dans `epreuve/captures/`.

---

## Partie 1 — L'environnement (4 points)

### 1.1 — Versions installées *(1 pt)*

Collez la sortie **brute** (sans la reformuler) :

```bash
$ java -version
[À compléter]

$ node -v
[À compléter]

$ npm -v
[À compléter]

$ docker compose version
[À compléter]

$ git --version
[À compléter]
```

### 1.2 — `mvn -version` vs `java -version` *(1 pt)*

Sortie de `./mvnw -version` (collez-la) :

```bash
$ ./mvnw -version
[À compléter]
```

Est-ce la même version de Java que `java -version` ? Expliquez en **deux phrases**
d'où vient cette version et **quelle variable d'environnement** la détermine.

> _(Réponse — 2 phrases max. Indice : `JAVA_HOME` ; Maven n'utilise pas le Java du
> `PATH` mais celui pointé par cette variable. Vérifiez avec `echo $JAVA_HOME`.)_

### 1.3 — L'échec de `./mvnw clean package` *(2 pts)*

Sortie d'erreur **complète** :

```bash
$ cd bibliotheque-backend
$ ./mvnw clean package
[À compléter — collez toute la sortie, pas seulement la dernière ligne]
```

**Cause de l'échec** (mécanisme, pas recopie du message) :

> _(Réponse. Indice : Lombok est un annotation processor qui modifie l'arbre
> syntaxique de javac via des API internes de `com.sun.tools.javac` ; JDK 16+ a
> refactoré `JCTree$JCImport` — le champ `qualid` n'existe plus ; le pom hérite de
> Lombok ~1.18.20 du parent Spring Boot 2.4.5, trop ancien pour le JDK de la machine.)_

**Les deux stratégies** (une avantage + un inconvénient chacune) :

| Stratégie | Avantage | Inconvénient |
|---|---|---|
| **A. Compiler/exécuter avec un JDK plus ancien** (ex. image Docker JDK 8/11) | [À compléter] | [À compléter] |
| **B. Moderniser le projet** (upgrader Lombok / Spring Boot, `java.version`) | [À compléter] | [À compléter] |

> Indice : seule la stratégie A est réellement applicable dans l'épreuve
> (contrainte partie 3 : ne pas toucher `pom.xml`). La B se **décrit** dans le
> rapport sans être appliquée.

---

## Partie 2 — L'arborescence (4 points)

> Répondez en citant le **chemin exact** à chaque fois. Une réponse sans chemin vaut zéro.

### 2.1 *(0,5 pt)* — Quel fichier contient l'URL, l'utilisateur et le mot de passe de la base de données ?

> _(Réponse — Indice : dans `bibliotheque-backend/src/main/resources/`.)_

### 2.2 *(0,5 pt)* — Quel fichier décide que `POST /authenticate` est accessible sans être connecté ?

> _(Réponse — Indice : cherchez `permitAll()` dans
> `bibliotheque-backend/src/main/java/com/ibizabroker/bibliotheque/configuration/`.)_

### 2.3 *(0,5 pt)* — Quelle classe transforme un objet `Books` en ligne de table MySQL ? Quel nom de table vise-t-elle exactement, et où est-ce écrit ?

> _(Réponse — Indice : annotation `@Table` dans `entity/Books.java`.)_

### 2.4 *(0,5 pt)* — `BooksRepository` est une interface **vide**. Qui écrit le code de la méthode `save()` ? À quel moment ?

> _(Réponse — Indice : Spring Data JPA, au démarrage de l'application.)_

### 2.5 *(1 pt)* — Dans le frontend, trois fichiers contiennent `http://localhost:8080`, pour un total de quatre occurrences. Citez-les toutes. Pourquoi est-ce un problème dès qu'on veut déployer ailleurs que sur son poste ?

> _(Réponse — liste des 3 fichiers + 4 occurrences, puis l'explication.)_

### 2.6 *(1 pt)* — Dans `app-routing.module.ts`, listez les routes réservées au rôle `Admin` et celles réservées au rôle `User`. Trois routes ne sont protégées par aucun `canActivate` : lesquelles, et est-ce normal pour chacune ?

> _(Réponse — Indice : les routes portent `data:{roles:[...]}` ; les trois sans
> `canActivate` sont celles que tout le monde doit pouvoir voir.)_

---

## Partie 4 — Suivre une donnée (4 points)

### 4.1 *(2 pts)* — Trajet complet de **l'emprunt d'un livre**

Reconstituez le trajet, du clic jusqu'à la base, sous forme de tableau. On attend au
minimum : le composant, le service Angular, l'intercepteur, le filtre JWT, le
contrôleur, le ou les repositories, la ou les entités, et le SQL final.

| # | Couche | Fichier (chemin exact) | Ce qui s'y passe |
|---|---|---|---|
| 1 | Navigateur — composant | `bibliotheque-frontend/src/app/borrow-book/borrow-book.component.ts` | [À compléter] |
| 2 | Navigateur — service | `bibliotheque-frontend/src/app/_service/borrow.service.ts` | [À compléter] |
| 3 | Navigateur — intercepteur | `bibliotheque-frontend/src/app/_auth/auth.interceptor.ts` | [À compléter] |
| 4 | Backend — filtre JWT | `bibliotheque-backend/src/main/java/com/ibizabroker/bibliotheque/configuration/JwtRequestFilter.java` | [À compléter] |
| 5 | Backend — contrôleur | `bibliotheque-backend/src/main/java/com/ibizabroker/bibliotheque/controller/BorrowController.java` | [À compléter] |
| 6 | Backend — repository | [À compléter] | [À compléter] |
| 7 | Backend — entité | [À compléter] | [À compléter] |
| 8 | Base — SQL final | — | [À compléter] |

**Ce que `BorrowController.borrowBook()` fait de particulier** par rapport à la
création d'un livre — regardez **combien de tables** sont touchées :

> _(Réponse — Indice : comparez avec le trajet du README, section 6, où la création
> d'un livre ne touche qu'une table.)_

### 4.2 *(1 pt)* — Trois manipulations

Pour chacune : **code HTTP obtenu ou comportement observé**, puis le **fichier
responsable** de cette réponse. Attention : l'une des trois ne produit **aucun appel
réseau** — sachez dire laquelle et pourquoi.

| Manipulation | Code / comportement | Fichier responsable |
|---|---|---|
| `curl -X POST http://localhost:8080/admin/books` sans en-tête `Authorization` | [À compléter] | [À compléter] |
| Se connecter avec un compte de rôle `User`, puis ouvrir `/books` dans le navigateur | [À compléter] | [À compléter] |
| `GET /admin/books/9999` avec un token d'administrateur valide | [À compléter] | [À compléter] |

> _(Réponse — Indice : sans token → qui renvoie le 401 ? Un `User` sur `/books` →
> bloqué **avant** tout appel réseau par le guard, ou bien 403 côté serveur ?
> Id 9999 inexistant → `NotFoundException` ?)_
>
> La manipulation qui ne produit **aucun** appel réseau : [À compléter] — pourquoi ?

### 4.3 *(1 pt)* — La double protection

La liste des livres est protégée par `auth.guard.ts` (navigateur) **et** par
`@PreAuthorize` (contrôleur). Cette double protection est-elle redondante ? Si l'on
devait n'en garder qu'une, laquelle et pourquoi ? **Cinq lignes maximum.**

> _(Réponse — Indice : le guard ne protège que l'interface ; toute requête HTTP peut
> être émise sans passer par le navigateur — curl, script… Seul le serveur peut faire
> autorité.)_

---

## Partie 2 — Les tests (10 points)

> Commande de lancement : `cd bibliotheque-backend && ./mvnw test` — aucun
> démarrage manuel, aucune base PostgreSQL requise. Suite au moment du rendu :
> **38 tests, 0 échec, 0 erreur** (`BUILD SUCCESS`).

### Test unitaire — la règle RG-03 (5 pts)

**Fichier : `bibliotheque-backend/src/test/java/com/ibizabroker/bibliotheque/service/ReservationServiceQuotaTest.java`**

- **Couche testée** : `ReservationService` —
  `bibliotheque-backend/src/main/java/com/ibizabroker/bibliotheque/service/ReservationService.java`
  (méthode `create()`, où RG-03 est implémentée avec `QUOTA_MAX = 3`).
- **Repository simulé** : `ReservationRepository`, `BooksRepository` et
  `UsersRepository` sont des **mocks Mockito** (`@ExtendWith(MockitoExtension.class)`,
  `@Mock` + `@InjectMocks`). Le contexte Spring n'est même pas démarré :
  le test s'exécute en JVM pure, **aucune base ne tourne**.

| Cas exigé | Méthode de test | Vérification |
|---|---|---|
| 2 réservations actives → la 3e est acceptée | `create_avecDeuxReservationsActives_troisiemeAcceptee` | `save()` appelé une fois, demande `DEMANDE` retournée |
| 3 réservations actives → refus | `create_avecTroisReservationsActives_refusee` | `ConflictException` (→ HTTP 409) **et** `verify(reservationRepository, never()).save(...)` : rien n'est écrit |
| *(complément)* le compteur compte les bons statuts | `create_leCompteurIgnoreLesReservationsAnnulees` | `ArgumentCaptor` : quota compté sur `DEMANDE + EN_ATTENTE + DISPONIBLE`, pas sur les annulées |

### Test d'intégration — un endpoint sécurisé (5 pts)

**Fichier : `bibliotheque-backend/src/test/java/com/ibizabroker/bibliotheque/ReservationSecurityIntegrationTest.java`**

Endpoint testé : `GET /api/reservations` — et `GET /api/reservations/{id}` pour le cas 403.

- **Mécanisme** : `@SpringBootTest` + `@AutoConfigureMockMvc` — le contexte Spring
  **réel** démarre (filtre `JwtRequestFilter`, `WebSecurityConfiguration`, annotations
  `@PreAuthorize` du contrôleur `ReservationController`) et chaque requête traverse
  `MockMvc` avec de **vrais JWT signés** produits par `JwtUtil`
  (`bibliotheque-backend/src/main/java/com/ibizabroker/bibliotheque/util/JwtUtil.java`),
  exactement comme le ferait `POST /authenticate` en production.
- **Pourquoi ça passe sans base** : les repositories sont des `@MockBean` — les
  données viennent des tests, jamais d'un SGBD. H2 en mémoire
  (`bibliotheque-backend/src/test/resources/application.properties`, dépendance scope
  `test` dans `bibliotheque-backend/pom.xml`) ne sert qu'au démarrage de JPA ;
  aucun scénario n'y lit ni n'y écrit.

| Cas exigé | Méthode de test | Résultat vérifié |
|---|---|---|
| Sans token → 401 | `getAll_sansToken_renvoie401` | `401 Unauthorized` + message « Authentification requise » |
| Token ADHERENT → 200 | `getAll_adherent_renvoieSesReservationsSeulement` | `200 OK`, ne retourne que SES réservations (RS-05) |
| Token ADHERENT, réservation d'un autre → 403 | `getById_reservationDUnAutreAdherent_renvoie403` | `403 Forbidden` + message « n'appartient pas à l'adhérent… » |

### Couverture du barème sécurité — preuve par les tests

| Poste du barème | Preuve dans la suite (`./mvnw test`) |
|---|---|
| **RS-01** — authentification exigée (4 pts) | 401 sans token sur chaque endpoint : `getAll_sansToken_renvoie401`, `getById_sansToken_renvoie401`, `accepter_sansToken_renvoie401` ; token expiré → 401 avec message dédié (`getById_tokenExpire_renvoie401AvecMessageSessionExpiree`) |
| **RS-02** — autorisations par rôle (5 pts) | `delete_parAdherent_renvoie403` (DELETE réservé au personnel) ; accepter une demande en tant qu'adhérent → 403 (étape 2 de `workflow_adherentCreeDemande_staffAccepte_versEnAttente`) |
| **RS-03 / RS-05** — un adhérent ne voit et ne modifie que les siennes (5 pts) | `getById_reservationDUnAutreAdherent_renvoie403` (403) ; `getById_bibliothecaire_renvoie200` (le personnel, lui, accède) ; filtrage côté service dans `findAllFor` / `cancelFor` (`ReservationService.java`) |
| **RS-04** — l'identité vient du token, pas du corps (4 pts) | `create_adherentAvecUserIdDUnAutreDansLeCorps_identitePriseDuToken` : alice (id 10) falsifie `userId=77` dans le corps JSON → la réservation est créée avec `userId=10` (celui du token) et le quota est compté sur l'id 10 — le corps est ignoré |
| **401 vs 403** (2 pts) | 401 = requête non authentifiable (absence ou expiration du token, levé par `JwtRequestFilter`) ; 403 = authentifié mais non autorisé (`@PreAuthorize` / `ForbiddenException`) — chaque test asserte le code exact |
| **Test unitaire RG-03, repository simulé** (5 pts) | `ReservationServiceQuotaTest` — mocks Mockito, sans base |
| **Test d'intégration endpoint sécurisé** (5 pts) | `ReservationSecurityIntegrationTest` — vraie chaîne de sécurité, sans base |

---

## Bonus (facultatif, +2 pts)

- [ ] **+1** — Service de seed automatique dans `docker-compose.yml` (compte admin + livres au premier démarrage).
- [ ] **+0,5** — README de démarrage rapide (3 commandes max) en tête de la PR.
- [ ] **+0,5** — Un vrai défaut du code repéré et documenté ici (sécurité, gestion d'erreur, cohérence) — sans le corriger.

> Défaut repéré : [À compléter — uniquement si tu traites le bonus]
