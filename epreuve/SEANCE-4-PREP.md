# Séance 4 — Fiche de préparation (8 min)

## 1. Comptes de démo (tous mot de passe : `admin123`)

| Compte | Rôle | Réservations au démarrage |
|---|---|---|
| `alice` | ADHERENT | #1 → livre 1 (Le Petit Prince) |
| `karim` | ADHERENT | #2 → livre 2 (1984) |
| `biblio` | BIBLIOTHECAIRE | aucune (voit tout) |
| `admin` | Admin (ancien compte) | — |

Livres : #1 Le Petit Prince (0 ex.), #2 1984 (3 ex. → RG-01 refus), #3 Dune (0 ex. → réservable).

> ⚠️ Après la démo RS-04, la réservation #3 (Dune → alice) existe. Si tu rejoues, annule-la ou supprime-la avec biblio.

## 2. Où chaque règle est implémentée (à citer si le formateur demande)

| Règle | Fichier | Mécanisme |
|---|---|---|
| **RS-01** (401 sans token) | `configuration/WebSecurityConfiguration.java` | aucun `permitAll` sur `/api/reservations/**` → `anyRequest().authenticated()` + `JwtAuthenticationEntryPoint` (401 JSON) |
| **RS-02** (403 rôle insuffisant) | `controller/ReservationController.java` | `@PreAuthorize("hasRole('BIBLIOTHECAIRE')")` sur DELETE ; ADHERENT/BIBLIOTHECAIRE sur le reste |
| **RS-03** (403 réservation d'autrui) | `service/ReservationService.java` | `getByIdFor` / `cancelFor` comparent `reservation.userId` à l'utilisateur du token → `ForbiddenException` → 403 |
| **RS-04** (identité du token) | `service/ReservationService.java` | `createFor()` ÉCRASE `reservation.setUserId(user.getUserId())` pour un ADHERENT ; le `userId` du corps est ignoré |
| **RS-05** (liste filtrée) | `service/ReservationService.java` + `dao/ReservationRepository.java` | `findByUserId(...)` pour l'ADHERENT, `findAll()` pour le BIBLIOTHECAIRE |
| 401 vs 403 | `JwtAuthenticationEntryPoint` (401) / `GlobalExceptionHandler` + `AccessDeniedHandler` (403 JSON) | 401 = inconnu, 403 = connu mais pas le droit |
| **RG-03** (quota 3) | `service/ReservationService.java` | `countByUserIdAndStatutIn(EN_ATTENTE, DISPONIBLE) >= 3` → 409 |

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
# alice ne voit que les siennes
TOKEN=$(curl -s -X POST http://localhost:8080/authenticate -H "Content-Type: application/json" -d '{"username":"alice","password":"admin123"}' | sed -n 's/.*"jwtToken":"\([^"]*\)".*/\1/p')
curl -s http://localhost:8080/api/reservations -H "Authorization: Bearer $TOKEN"
# biblio voit tout
# alice tente DELETE → 403
curl -i -X DELETE http://localhost:8080/api/reservations/1 -H "Authorization: Bearer $TOKEN"
```
Phrase clé : « 403 = je sais qui vous êtes, et vous n'avez pas le droit. »

**3:30–5:00 — RS-03 + RS-04 : la règle d'or (le poste le plus important)**
```bash
# alice tente de VOIR la réservation de karim → 403
curl -i http://localhost:8080/api/reservations/2 -H "Authorization: Bearer $TOKEN"
# alice tente de créer UNE RÉSERVATION AU NOM DE KARIM
curl -s -X POST http://localhost:8080/api/reservations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bookId":3,"userId":101}'   # 101 = karim, mis par le client
```
→ la réponse contient `"userId":51` (alice) : **le corps a été écrasé par l'identité du token**.
Phrase clé : « L'identité vient du token, jamais du corps de la requête. »

**5:00–6:30 — Les tests**
```bash
./mvnw test
```
→ 10/10 verts. Insister : les tests tournent **sans base de données** (Postgres arrêté — le montrer si demandé : `docker ps`).
- Unitaires (`ReservationServiceQuotaTest`) : Mockito pur, repository simulé, quota 3 (2 actifs → OK, 3 actifs → refus).
- Intégration (`ReservationSecurityIntegrationTest`) : vrai contexte Spring + **vrais tokens signés** passant par le vrai filtre JWT → 401 / 200 / 403.

**6:30–7:30 — Montrer le code (si le formateur veut)**
Un seul slide mental : contrôleur = `@PreAuthorize` par rôle, service = identité du token + propriété, config = 401/403 JSON. Ouvrir `ReservationService.createFor()` — 4 lignes qui résument RS-04.

**7:30–8:00 — Clôture**
« Cinq règles, cinq preuves : 401 sans token, 403 hors rôle, 403 hors propriété, identité du token, liste filtrée. Le tout vérifié par 10 tests automatiques. »

## 4. Questions pièges probables & réponses

- **« Pourquoi 403 et pas 404 sur la réservation d'un autre ? »** — Choix assumé : 403 exprime la règle métier (exists mais pas à toi). Alternative défendable : 404 pour ne pas révéler l'existence (énumération). Cite les deux, dis pourquoi tu as choisi 403 (lisibilité du barème RS-03).
- **« Et si le token est expiré ? »** — `JwtRequestFilter` attrape `ExpiredJwtException` → pas d'authentification → 401 (jamais 403).
- **« Pourquoi un handler 403 dédié ? »** — Sans lui : `@RestControllerAdvice` générique transformait l'`AccessDeniedException` en **500**. Le `AccessDeniedHandler` JSON le corrige et distingue bien 401/403.
- **« BIBLIOTHECAIRE peut réserver pour qui ? »** — Oui, n'importe qui (tableau de l'énoncé) : `createFor` n'écrase pas le `userId` pour ce rôle.
- **« Les tests touchent la vraie base ? »** — Non. Unitaires = Mockito pur. Intégration = repos mockés + H2 en mémoire (scope test) pour le bootstrap JPA. Postgres peut être éteint.

## 5. Si tu finis en avance

- RG-01 : réserver « 1984 » (3 exemplaires) → 409 « livre disponible » :
```bash
curl -i -X POST http://localhost:8080/api/reservations -H "Authorization: Bearer $TB" \
  -H "Content-Type: application/json" -d '{"bookId":2,"userId":10}'
```
- Expiration : `TOKEN_VALIDITY` dans `JwtUtil` = 5 h ; un token expiré → 401 + filtre log « Token JWT expiré ».
- Journalisation des refus : déjà en place (`log.warn` dans `GlobalExceptionHandler` et l'`AccessDeniedHandler`).

## 6. Avant de partir — checklist

- [ ] `docker start bibliotheque-db` puis backend démarré (`set -a; source ../docker/backend.env.local; set +a; ./mvnw spring-boot:run`)
- [ ] Login des 3 comptes testé une fois à la main
- [ ] `./mvnw test` → 10/10 verts
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

**Tests (10/10 verts, sans base de données) :**
- `ReservationServiceQuotaTest` — RG-03, repository mocké (Mockito), quota 3 actifs
- `ReservationSecurityIntegrationTest` — vrais tokens signés + vrai filtre JWT : 401 / 200 filtré / 403 propriétaire / 403 DELETE

*(coller ici la capture du résultat `./mvnw test`)*
