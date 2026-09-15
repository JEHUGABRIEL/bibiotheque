# Séance 4 — Fiche de préparation (8 min)

> Les exigences de tests (backend et frontend) et leur traçabilité vers les fichiers de
test sont dans [`EXIGENCES-TESTS.md`](./EXIGENCES-TESTS.md).

## 1. Comptes de démo

Créés et vérifiés par `./docker/seed-demo.sh` (idempotent : à relancer si la base est
réinitialisée).

| Compte | Mot de passe | Rôle | Au démarrage |
|---|---|---|---|
| `adherent1` | `adherent123` | ADHERENT | réservation **#1** → livre 4 « Les Misérables » (**EN_ATTENTE**) |
| `adherent2` | `adherent123` | ADHERENT | **#2** → livre 5 « L'Aventure ambiguë » (**DEMANDE**) ; **#3** → livre 7 « Voyage au bout de la nuit » (EN_ATTENTE) |
| `biblio1` | `biblio123` | BIBLIOTHECAIRE | aucune (voit tout) |
| `admin` | `admin123` | Admin (ancien compte) | — |

Catalogue : **#1** L'Étranger (3 ex.), **#2** Le Petit Prince (2 ex.), **#3** Une si longue
lettre (1 ex.) → empruntables. **#4** Les Misérables, **#5** L'Aventure ambiguë, **#6** Le
Vieux Nègre et la Médaille, **#7** Voyage au bout de la nuit → 0 exemplaire, donc
**réservables** (RG-01 interdit de réserver un livre disponible).

> ⚠️ **#6 « Le Vieux Nègre et la Médaille » (0 ex.) est laissé libre** : c'est le livre à
> utiliser pour une création de réservation en direct. Une fois réservé, il reste bloqué par
> la règle « une seule réservation active par livre » (409 au second essai).

## 2. Où chaque règle est implémentée (à citer si le formateur demande)

| Règle | Fichier | Mécanisme |
|---|---|---|
| **RS-01** (401 sans token) | `configuration/WebSecurityConfiguration.java` | aucun `permitAll` sur `/api/reservations/**` → `anyRequest().authenticated()` + `JwtAuthenticationEntryPoint` (401 JSON) |
| **RS-02** (403 rôle insuffisant) | `controller/ReservationController.java` | `@PreAuthorize("hasRole('BIBLIOTHECAIRE')")` sur DELETE ; ADHERENT/BIBLIOTHECAIRE sur le reste |
| **RS-03** (403 réservation d'autrui) | `service/ReservationService.java` | `getByIdFor` / `cancelFor` comparent `reservation.userId` à l'utilisateur du token → `ForbiddenException` → 403 |
| **RS-04** (identité du token) | `service/ReservationService.java` | `createFor()` ÉCRASE `reservation.setUserId(user.getUserId())` pour un ADHERENT ; le `userId` du corps est ignoré |
| **RS-05** (liste filtrée) | `service/ReservationService.java` + `dao/ReservationRepository.java` | `findByUserId(...)` pour l'ADHERENT, `findAll()` pour le BIBLIOTHECAIRE |
| 401 vs 403 | `JwtAuthenticationEntryPoint` (401) / `GlobalExceptionHandler` + `AccessDeniedHandler` (403 JSON) | 401 = inconnu, 403 = connu mais pas le droit |
| **RG-03** (quota 3) | `service/ReservationService.java` | `countByUserIdAndStatutIn(DEMANDE, EN_ATTENTE, DISPONIBLE) >= 3` → 409 (les `ANNULEE`/`EXPIREE`/`HONOREE` libèrent une place) |

## 3. Déroulé chronométré (8:00)

**0:00–0:45 — Le problème (accroche)**
« La semaine dernière, l'API de réservation fonctionnait... pour tout le monde. N'importe qui pouvait lire les réservations des autres et les annuler. Aujourd'hui je l'ai fermée, et je le prouve par des tests. »

**0:45–2:00 — RS-01 : 401 sans token**
```bash
curl -i http://localhost:8080/api/reservations
curl -i -X DELETE http://localhost:8080/api/reservations/1
```
→ 401 + `{"message":"Authentification requise"}` sur TOUS les endpoints.
Phrase clé : « 401 = je ne sais pas qui vous êtes. »

**2:00–3:30 — RS-05 + RS-02 : qui voit quoi**
```bash
token() { curl -s -X POST http://localhost:8080/authenticate -H "Content-Type: application/json" \
  -d "{\"username\":\"$1\",\"password\":\"$2\"}" | jq -r .jwtToken; }
TA=$(token adherent1 adherent123)   # adhérent : ne voit que les siennes (200, 2 lignes)
TB=$(token biblio1 biblio123)       # personnel : voit tout (200, 3 lignes)
curl -s http://localhost:8080/api/reservations -H "Authorization: Bearer $TA"
curl -s http://localhost:8080/api/reservations -H "Authorization: Bearer $TB"
# adhérent tente une action du personnel → 403
curl -i -X DELETE http://localhost:8080/api/reservations/1 -H "Authorization: Bearer $TA"
```
Phrase clé : « 403 = je sais qui vous êtes, et vous n'avez pas le droit. »

**3:30–5:00 — RS-03 + RS-04 : la règle d'or (le poste le plus important)**
```bash
# adherent1 tente de VOIR la réservation #2, qui appartient à adherent2 → 403
curl -i http://localhost:8080/api/reservations/2 -H "Authorization: Bearer $TA"
# adherent1 tente de créer UNE RÉSERVATION AU NOM D'ADHERENT2
curl -s -X POST http://localhost:8080/api/reservations \
  -H "Authorization: Bearer $TA" -H "Content-Type: application/json" \
  -d '{"bookId":6,"userId":52}'   # 52 = adherent2, valeur envoyée par le client
```
→ la réponse contient `"userId":51` (adherent1) : **le corps a été écrasé par l'identité du token**.
Phrase clé : « L'identité vient du token, jamais du corps de la requête. »

> Le livre 6 est ensuite occupé. Pour rejouer l'effet, supprime la réservation créée
> (`DELETE /api/reservations/<id>` avec `$TB`) ou relance `./docker/seed-demo.sh`.

**5:00–6:30 — Les tests**
```bash
./mvnw test
```
→ 50/50 verts (5 classes). Insister : les tests tournent **sans base de données** (H2 en
mémoire, `src/test/resources/application.properties` — Postgres peut être arrêté, le
montrer si demandé : `docker ps`).
- Unitaires (`ReservationServiceQuotaTest`) : Mockito pur, repository simulé, quota 3 (2 actifs → OK, 3 actifs → refus).
- Intégration (`ReservationSecurityIntegrationTest`, 25 tests) : vrai contexte Spring + **vrais tokens signés** passant par le vrai filtre JWT → 401 / 200 / 403.
- À montrer si le formateur demande « et si on ajoute un endpoint sans le sécuriser ? » :
  `tousLesEndpoints_sansToken_renvoient401` est paramétré sur les 6 routes et vérifie que
  chacune **existe réellement** — une faute de frappe dans un chemin ferait échouer le test.

**6:30–7:30 — Montrer le code (si le formateur veut)**
Un seul slide mental : contrôleur = `@PreAuthorize` par rôle, service = identité du token + propriété, config = 401/403 JSON. Ouvrir `ReservationService.createFor()` — 4 lignes qui résument RS-04.

**7:30–8:00 — Clôture**
« Cinq règles, cinq preuves : 401 sans token, 403 hors rôle, 403 hors propriété, identité du token, liste filtrée. Le tout vérifié par 50 tests automatiques, sans base de données. »

## 4. Questions pièges probables & réponses

- **« Pourquoi 403 et pas 404 sur la réservation d'un autre ? »** — Choix assumé : 403 exprime la règle métier (exists mais pas à toi). Alternative défendable : 404 pour ne pas révéler l'existence (énumération). Cite les deux, dis pourquoi tu as choisi 403 (lisibilité du barème RS-03).
- **« Et si le token est expiré ? »** — Géré (bonus) : `JwtRequestFilter` attrape `ExpiredJwtException` → 401 avec le message dédié « Session expirée, veuillez vous reconnecter » + `expired:true`. Test d'intégration dédié (vrai JWT signé mais expiré).
- **« Pourquoi un handler 403 dédié ? »** — Sans lui : `@RestControllerAdvice` générique transformait l'`AccessDeniedException` en **500**. Le `AccessDeniedHandler` JSON le corrige et distingue bien 401/403.
- **« BIBLIOTHECAIRE peut réserver pour qui ? »** — Oui, n'importe qui (tableau de l'énoncé) : `createFor` n'écrase pas le `userId` pour ce rôle.
- **« Les tests touchent la vraie base ? »** — Non. Unitaires = Mockito pur. Intégration = repos mockés + H2 en mémoire (scope test) pour le bootstrap JPA. Postgres peut être éteint.

## 5. Si tu finis en avance — les 3 bonus sont FAITS

1. **Expiration du token (fait)** — montrer en live :
```bash
# n'importe quel token expiré (ou attendre 5h, TOKEN_VALIDITY dans JwtUtil)
curl -i http://localhost:8080/api/reservations -H "Authorization: Bearer <token_expiré>"
# → 401 {"message":"Session expirée, veuillez vous reconnecter","expired":true}
```
2. **Journalisation des refus (fait)** — lancer un appel refusé puis `grep "Accès refusé"` dans la console du backend : chaque refus loggue **[401]/[403], la méthode, l'URI, l'utilisateur et la raison** (entry point, AccessDeniedHandler, ForbiddenException).
3. **RG-01 (fait + testé)** — réserver « L'Étranger » (3 exemplaires) → 409 « livre disponible » ; couvert par 2 tests d'intégration (409 si disponible, 201 + EN_ATTENTE si 0 exemplaire).

## 6. Avant de partir — checklist

- [ ] `docker compose up -d db` puis backend démarré (`set -a; source ../docker/backend.env.local; set +a; ./mvnw spring-boot:run`)
- [ ] `./docker/seed-demo.sh` (comptes + catalogue + réservations, et vérifie 401/200/403)
- [ ] Login des 4 comptes testé une fois à la main
- [ ] `./mvnw test` → 50/50 verts · `npx ng test --watch=false --browsers=ChromeHeadless` → 234/234
- [ ] Swagger UI ouverte une fois : <http://localhost:8080/swagger-ui/index.html>
      (« Authorize » + jeton d'`adherent1` → tester RS-01/RS-03 sans `curl`)
- [ ] Branche poussée + PR ouverte (description ci-dessous)

## 7. Description de Pull Request (à copier)

**Sécurisation du module Réservation (Séance 4)**

Fermeture de `/api/reservations` : authentification obligatoire, rôles ADHERENT/BIBLIOTHECAIRE, filtrage par propriétaire, identité dérivée du token JWT.

**Règles implémentées :**
- **RS-01** — `WebSecurityConfiguration` : aucun permitAll sur `/api/reservations/**` (401 via `JwtAuthenticationEntryPoint`)
- **RS-02** — `ReservationController` : `@PreAuthorize` par rôle, DELETE réservé au BIBLIOTHECAIRE
- **RS-03** — `ReservationService.getByIdFor/cancelFor` : vérification de propriété → 403
- **RS-04** — `ReservationService.createFor` : `userId` du corps écrasé par l'identité du token
- **RS-05** — `ReservationService.findAllFor` + `ReservationRepository.findByUserId` : liste filtrée par adhérent

**Bonus :**
- **Expiration du token** — `JwtRequestFilter` + `JwtAuthenticationEntryPoint` : 401 « Session expirée, veuillez vous reconnecter » (+ `expired:true`)
- **Journalisation des accès refusés** — chaque 401/403 est loggué avec qui, où et pourquoi (entry point, `AccessDeniedHandler`, `GlobalExceptionHandler`)
- **RG-01 testé** — 2 tests d'intégration : 409 sur livre disponible, 201 + EN_ATTENTE sur livre indisponible

**Tests (50/50 verts, sans base de données) :**
- `ReservationServiceQuotaTest` — RG-03, repository mocké (Mockito), quota 3 actifs
- `ReservationSecurityIntegrationTest` (25 tests) — vrais tokens signés + vrai filtre JWT : 401 sur les **6** endpoints (paramétré, avec vérification que la route existe) / 200 filtré / 403 lecture et **403 annulation** d'autrui / 200 annulation de la sienne / 403 DELETE / **?statut= filtré sur l'id du token** / token expiré → message dédié / RG-01 (409 livre disponible, 201 livre indisponible)

*(coller ici la capture du résultat `./mvnw test`)*
