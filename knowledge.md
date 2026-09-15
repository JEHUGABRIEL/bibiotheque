# Project Knowledge: Bibliothèque

Full-stack library management app (course project, Épreuve Séance 1).
- **Backend**: Spring Boot 3.1.5 REST API (`bibliotheque-backend/`, port 8080), JDK 21, Maven wrapper
- **Frontend**: Angular 14 UI (`bibliotheque-frontend/`, port 4200), TypeScript 4.7, Node 18 recommended
- **Database**: PostgreSQL (env vars `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`; a `db` service exists in compose and publishes 5432 on the host, so the non-Docker backend reaches it too)
- **Auth**: JWT (jjwt 0.12.7) + BCrypt passwords, role-based (`Admin`, `BIBLIOTHECAIRE`, `ADHERENT`, `User`)
- **Current branch**: `feature/reservation-securite-jehu-binga` — reservations + borrow validation workflow (EN_ATTENTE → VALIDEE/REFUSEE → RENDU)

## Key Directories
- `bibliotheque-backend/src/main/java/com/ibizabroker/bibliotheque/`
  - `entity/`: JPA entities (Books, Users, Role, Borrow, Reservation, StatutBorrow, StatutReservation, JwtRequest/Response)
  - `dao/`: Spring Data repositories (Books, Users, Borrow, Reservation, Role)
  - `controller/`: REST endpoints (BooksController, AdminController, BorrowController, JwtController, ReservationController)
  - `service/`: Business logic (JwtService, ReservationService)
  - `configuration/`: Security (WebSecurityConfiguration, JwtRequestFilter, JwtAuthenticationEntryPoint, CorsConfiguration)
  - `util/`: JwtUtil; `exceptions/`: NotFound/BadRequest/Conflict/Forbidden
- `bibliotheque-backend/src/main/resources/application.properties`: port, datasource, `ddl-auto=update`
  - `configuration/OpenApiConfiguration.java`: Swagger UI (springdoc 2.3.0) — `bearerAuth` scheme so the **Authorize** button can send the JWT. UI: `/swagger-ui/index.html`, spec: `/v3/api-docs`
- `bibliotheque-frontend/src/app/`
  - `_service/`: HTTP services (books, users, borrow, reservation, user-auth, translation, notification)
  - `_auth/`: auth.guard.ts, auth.interceptor.ts
  - `_model/`: TypeScript types; `_shared/`: modal, confirm-modal, toast
  - One folder per screen (15+ components), each with `*.spec.ts`
- `bibliotheque-frontend/src/environments/`: `environment.ts` / `environment.prod.ts` (`apiUrl`, default `http://localhost:8080`)
- `docker/`: `backend.env`, `app.env` (tracked), `*.env.local` (gitignored, hold real passwords)
- `epreuve/`: assignment report (`RAPPORT.md`) + `captures/` screenshots; `screenshots/`: README images
- **Shared enums — keep backend and frontend in sync**
  - `entity/StatutBorrow.java` ↔ `_model/borrow.ts`: `EN_ATTENTE | VALIDEE | REFUSEE | EN_COURS | RENDU`
  - `entity/StatutReservation.java` ↔ `_model/reservation.ts`: `DEMANDE | EN_ATTENTE | DISPONIBLE | ANNULEE | EXPIREE | HONOREE`

## Commands

### Backend (JDK 21 required)
```bash
cd bibliotheque-backend
set -a; source ../docker/backend.env.local; set +a   # DB password is NOT read by mvnw
./mvnw spring-boot:run        # dev server on :8080
./mvnw test                   # 5 test classes, 50 tests, all green, no DB needed
./mvnw clean package          # -> target/bibliotheque-0.0.1-SNAPSHOT.jar
```

### Frontend (Angular 14, Node 18 recommended)
```bash
cd bibliotheque-frontend
npm install                                        # no package-lock.json -> not npm ci
npm start                                          # ng serve on :4200
npm test                                           # karma default browser is Chrome + watch
CHROME_BIN=/usr/bin/google-chrome npx ng test --watch=false --browsers=ChromeHeadless  # CI run, 234 tests
npx ng build --configuration development           # safe build offline (see Gotchas)
```

### Docker
```bash
docker compose up -d db       # RECOMMENDED first step: PostgreSQL 16 on host:5432
docker compose up             # db + backend + frontend (backend image must be rebuilt after code changes)
```
- `db` service: `postgres:16-alpine`, named volume `db-data`, healthcheck, port `${POSTGRES_PORT:-5432}` **published on the host** — this is what makes the non-Docker backend work with no sudo and no host PostgreSQL install.
- `backend` gets `SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/bibliotheque` (overrides `docker/backend.env`, which points at `host.docker.internal`).
- `bibliotheque-backend/Dockerfile`: Maven 21 build → JRE 21, `mvn package -DskipTests`
- `bibliotheque-frontend/Dockerfile`: node:18-alpine build → nginx:alpine, SPA fallback via `nginx.conf`
- Env: `docker/backend.env` + `docker/app.env` (tracked) layered with gitignored `*.env.local`
- ⚠️ The `backend` image goes stale silently: `docker compose up -d` reuses it and you get a **Spring Boot 2 / Tomcat 9** jar that fails with `Failed to load driver class org.postgresql.Driver`. Rebuild after any backend change: `docker compose build backend`.

### Backend without Docker (dev loop)
```bash
cd /home/pkf/bibiotheque
docker compose up -d db                          # once: PostgreSQL on host:5432 (no sudo)
cd bibliotheque-backend
set -a; source ../docker/backend.env.local; set +a
./mvnw spring-boot:run                           # recompile per run; devtools restart is off
```
- Do NOT start the host PostgreSQL cluster (`sudo pg_ctlcluster 15 main start`) at the same time — both bind 5432. `docker compose stop db` first.
- First boot creates the TABLES only (`ddl-auto=update`), never the DB. `db-data` already holds `bibliotheque`, the 4 roles and the seeded `admin` / `admin123` account.
- **Demo dataset**: `./docker/seed-demo.sh` (needs `jq`, idempotent) creates the 3 accounts (`adherent1`/`adherent123`, `adherent2`/`adherent123`, `biblio1`/`biblio123`), a mixed catalogue and one reservation per member, then asserts 401/200/403 live. Everything goes through the API, so BCrypt and the business rules are the app's own.

## Borrow Workflow (Business Rules)
- `POST /borrow`: staff (BIBLIOTHECAIRE/Admin) borrows directly → `VALIDEE`; ADHERENT/User creates request → `EN_ATTENTE`.
- `PATCH /borrow/{id}/confirmer` and `/refuser`: staff validates/refuses (confirm decrements `noOfCopies`; refusing a VALIDEE borrow re-increments it before REFUSEE; refusing RENDU/REFUSEE → 409).
- `PUT /borrow`: staff registers return; `PUT /borrow/request`: ADHERENT requests return of own borrow.
- Quotas (ADHERENT only): QUOTA-01 max 3 active borrows (EN_ATTENTE+VALIDEE), QUOTA-02 max 1 active borrow per book.
- `GET /borrow/my/quota`: active count + remaining quota for logged-in ADHERENT.
- `DELETE /borrow/{id}`: Admin-only; deleting an active VALIDEE borrow (no returnDate) → 409 (would lose the decremented copy).

## Reservation Workflow
- ADHERENT creating a reservation → `DEMANDE` (a request staff must accept); staff creating → `EN_ATTENTE` directly. This is decided by the AUTHENTICATED ACTOR (`byStaff` in `createFor`), NOT the target user's roles: a staff-created reservation FOR an adherent is EN_ATTENTE, never DEMANDE. Don't revert adherent creation to EN_ATTENTE — the approval step is an explicit requirement.
- `PATCH /api/reservations/{id}/accepter` (BIBLIOTHECAIRE/Admin only) moves DEMANDE → EN_ATTENTE (409 otherwise, 403 for adherents).
- Cancellation allowed for DEMANDE/EN_ATTENTE/DISPONIBLE. "Active" (quota + duplicate checks) = DEMANDE + EN_ATTENTE + DISPONIBLE (`STATUTS_ACTIFS`).
- DB: the `reservation_statut_check` constraint must include DEMANDE.

## Data Flow
Component → `_service` → interceptor (adds Bearer token) → CORS → JwtRequestFilter → security config → controller (`@PreAuthorize`) → repository → entity → DB.

## Tests
- `BibliothequeApplicationTests`: context loads.
- `BorrowSecurityIntegrationTest` (18 tests) and `ReservationSecurityIntegrationTest` (25 tests): full Spring context with the real JWT filter + `@PreAuthorize`, real tokens signed by `JwtUtil`, repositories `@MockBean` — **pass without a database**. Cover 401 without token, staff-or-self ownership on `GET /borrow/user/{id}` (+ `/pending`), staff-only `GET /borrow/book/{id}`, RS-03/RS-04/RS-05 reservation rules, RS-01 on all six reservation routes, RS-05 with `?statut=`.
  - Both new guards were verified by deliberately breaking the production code and watching the test go red: a typo'd path (`/99/annulerX`) trips the route-existence check, and making `findAllFor` call `findByStatut` for members makes the leak test fail with `size 1` expected / `2` returned. Keep the trapped-payload stubs in `getByStatut_*`: they are what makes those cases non-vacuous.
  - `ReservationSecurityIntegrationTest.tousLesEndpoints_sansToken_renvoient401` is a `@ParameterizedTest` over the six routes; because a **non-existent** route also answers 401 (security resolves before the handler), it additionally asserts each route exists via `RequestMappingHandlerMapping` + `PathPattern.matches`. Keep that guard: without it a typo in a path silently turns the case green.
- `ApiErrorResponseIntegrationTest` (10 tests): HTTP-level contract of **error bodies** across all three writers (entry point, `AccessDeniedHandler`/advice, controller): 400/401/403(x2)/404/409/500 each carry `message` + `status` + ISO-8601 `timestamp`, 401 adds `expired`, and a 2xx stays an un-wrapped array.
- `ApiErrorResponseTest` (5 tests, no Spring context): locks the format itself — key order, `status` copied from the `HttpStatus` given, timestamp parseable by `OffsetDateTime.parse` with the server's local offset, `unauthorized()` adds `expired`.
- `ReservationServiceQuotaTest` (3) and `ReservationServiceNewBookTest` (3): Mockito unit tests on `ReservationService`, repos mocked.
- Frontend: Karma + Jasmine (`karma.conf.js` default browser `Chrome`, watch mode on), 234 tests green. Two levels coexist by design:
  - **Unit tests** live next to the code. Service specs (`_service/*.spec.ts`) drive the HTTP contract through `HttpTestingController` (verb, URL, body, error propagation) — `borrow`, `reservation` and `books` services are fully covered. Screen specs use `TestBed` + `HttpClientTestingModule` and assert both state and DOM: `books-list`, `users-list`, `create-book`, `update-book`, `book-details`, `user-details`, `update-user`, `registration`, `sidebar`, `header`, `home`, `reservation-container`, plus the pure-logic `users.service`, guards/interceptor.
  - **Integration tests** live in `src/app/_integration/` and wire the real chain: real components + real templates + real services + real `AuthInterceptor` + mocked HTTP backend (`api-security`, `borrow-book`, `reservation-flow`, `return-book`, `login`). They assert DOM, outgoing requests (Bearer header, `RS-04` = no `userId` in the body for members) and the automatic refresh after each action. No backend or database needed.
  - Shared gotchas: components that inject `UsersService` need `HttpClientTestingModule` even if they never call HTTP; `RouterTestingModule` re-exports `RouterModule` (so `routerLink` works); a fixture created without `detectChanges()` has no `ngOnInit` (no requests, no timers — handy for the login carousels); `HostBinding` updates only on the next change-detection cycle.
  - Fixture caveat: request bodies posted as entity instances (`new Borrow()`, `new Reservation()`) must be compared with a spread (`expect({ ...req.request.body }).toEqual({...})`) — Jasmine 4 refuses `toEqual` between a class instance and an object literal.

## Conventions & Gotchas
- **README is outdated**: still documents Spring Boot 2.4.5 / Java 8 / MySQL and says no Docker files exist. Current: Boot 3.1.5 / Java 21 / PostgreSQL, Dockerfiles + compose present. The README's "what's missing" section is the assignment brief, not the repo state.
- **API URL centralized**: services use `environment.apiUrl` (`fileReplacements` swaps in `environment.prod.ts` on `ng build --configuration production`). Both files default to `http://localhost:8080`; `nginx.conf` has no `/api` proxy, so prod expects the API on the same host.
- **Security config**: `permitAll` covers only `/authenticate`, the Swagger paths (`/swagger-ui.html`, `/swagger-ui/**`, `/v3/api-docs`, `/v3/api-docs/**`, `/v3/api-docs.yaml`) and the dead `/admin/books/`. Per-role checks live in controllers via `@PreAuthorize`, not in the security config.
- **Trailing-slash trap (bit twice)**: Spring 6 no longer matches a path with a trailing slash, so `"/admin/books/"` in `permitAll` is dead code, and `"/v3/api-docs/**"` does NOT cover the root `/v3/api-docs` — list it separately. `requestMatchers(HttpHeaders.ALLOW)` is also inert (it becomes the path `/Allow`).
- **Swagger works only after a restart**: `springdoc` is resolved at startup, so an instance started before the dependency was added keeps answering **401** on `/swagger-ui/index.html` — the 401 is misleading, because Spring Security rejects *before* routing, so a route that does not exist yet also returns 401. Always check the running PID's TTY before concluding a config change failed: `ps -o pid,tty,lstart -p $(ss -ltnp | grep :8080 | grep -oP 'pid=\K[0-9]+')`.
- **Endpoint security**: borrow reads follow staff-or-self via the `borrowSecurity` SpEL bean (`GET /borrow/user/{id}`, `/user/{id}/pending`); `GET /borrow/book/{id}` is staff-only. Reservation ownership is enforced in `ReservationService` from JWT identity (RS-03/RS-04); adherents never send `userId` (backend takes it from the token).
- **`@PreAuthorize` is per-method, so every new endpoint needs its own — and a missing one is invisible**: `POST /admin/users` was the ONLY method of `AdminController` without it (the `GET`/`PUT` siblings all had it), which let any authenticated account — including a plain ADHERENT — create an account carrying `roleName: "Admin"` and then log in with it. Fixed (`@PreAuthorize("hasRole('Admin')")` added) and locked by `AdminUserSecurityIntegrationTest` (6 tests: 401 no token, 403 for ADHERENT/BIBLIOTHECAIRE, 200 + role resolved from the DB for Admin, 400 for an unknown role). When adding an endpoint, check the whole controller — the security config only does 401-vs-authenticated, never roles.
- **Role names must match the DB EXACTLY** (case and accents): the `role` table holds `Admin`, `User` (legacy), `BIBLIOTHECAIRE`, `ADHERENT`. `AdminController` resolves the role via `roleRepository.findByRoleName(...)` — an exact string match — so `"Adhérent"` or `"adherent"` fails with `400 {"message":"Rôle \"Adhérent\" introuvable"}`. The frontend never sends French labels: it sends the raw `roleName` (`users.select.role`, `roleLabelKey()` only picks the display key). `User` still works (legacy accounts) and `STAFF_ROLES` treats `Admin` + `BIBLIOTHECAIRE` as staff.
- **JWT secret has a code default**: override via env in real deployments.
- **Local run needs the password sourced**: `docker/*.env.local` is read by docker compose only, not `./mvnw spring-boot:run`. Source first: `set -a; source ../docker/backend.env.local; set +a`.
- **Database**: backend does NOT create the schema, only tables (`ddl-auto=update`). Create the `bibliotheque` DB first, seed the first admin via SQL (BCrypt hash for `admin123` in README §5).
- **jjwt 0.12.7**: modern API (`Keys.hmacShaKeyFor`, `Jwts.parser().verifyWith()`); older samples won't compile. Lombok 1.18.34 is pinned for JDK 21.
- **Backend restarts**: devtools restart is DISABLED in `application.properties`; `./mvnw spring-boot:run` picks up code changes only on a fresh start. A stale server returning 401/403 on endpoints that should work is the first suspect when the UI bounces to login. A stale server also once wrote rows with `statut = NULL`; `borrow.statut` is now `NOT NULL DEFAULT 'EN_ATTENTE'` with a DB CHECK, so corrupt rows can't recur.
- **Frontend builds**: `npx ng build` defaults to the production configuration, which inlines Google Fonts and FAILS offline (`Inlining of fonts failed`). Verify with `npx ng build --configuration development` (optimization off, no font fetch).
- **Dates de l'API = `dd-MM-yyyy`** (`JsonDataSerializer` côté backend, appliqué aux dates de `Borrow` et `Reservation`) : **ne jamais** passer une date reçue de l'API au pipe `date` d'Angular, il lève `InvalidPipeArgument: Unable to convert "17-09-2026" into a date` (et casse tout le rendu du tableau). Chaque page a son `formatDate()` public qui parse le format de l'API à la main — le réutiliser dans le template (`{{ formatDate(b.dueDate) }}`).
- **i18n — no French literals in templates or TS**: every user-facing string goes through `TranslationService.t(key)`. `t(key, params?)` substitutes `{{ nom }}` placeholders (`t('toast.reservation.cancelled', { name })`), so quantities/names never need string concatenation. A component whose template calls `t.t(...)` MUST inject `public t: TranslationService` — a missing injection is a build error (`Property 't' does not exist on type`) that `tsc` does not catch, only `ng build`. `TRANSLATIONS` is exported so `translation.service.spec.ts` can assert fr/en key parity, non-empty values and identical `{{ }}` parameters per key — a key added on one side only renders raw (`reservations.filter`) at runtime. Adding a key means adding it in BOTH blocks.
- **Escaping in `translation.service.ts`**: values are single-quoted strings, so a French apostrophe MUST be escaped (`'...d\\'emprunt'`) or the file stops compiling — and the breakage is a syntax error, not a type error, so it looks like "translations stopped working" rather than a build failure. Use a double-quoted value (`"...l'emprunt..."`) when the text has one. 7 values were broken this way at once; the parity spec plus `ng build` catch it.
- **Every error body is built by `ApiErrorResponse` — three write paths, one contract**: `{ "message": ..., "status": ..., "timestamp": ... }` (plus `expired` on the 401). The three writers are the `@RestControllerAdvice` (`GlobalExceptionHandler`, which also derives the HTTP line and the body `status` from the same `HttpStatus` via its private `erreur(...)` helper, so they cannot diverge), `JwtAuthenticationEntryPoint` (401) and the `AccessDeniedHandler` lambda in `WebSecurityConfiguration` (403 for filter-level denials). Writing a new error response as `Map.of("message", ...)` re-opens the drift — one path keeps the old shape and nothing catches it, because existing tests only assert `$.message`. Success responses are deliberately NOT wrapped: `/api/reservations` returns a bare array the frontend maps directly.
- **Backend error messages are French and pass through untranslated**: several components prefer `err.error.message` over their own key, so a server-side refusal (e.g. `Accès refusé : ...`) shows in French even in EN mode. That is inherent — the string is built server-side. Translate the wrapper (`error.load.members.detail`) and accept that the `{{ detail }}` part stays as the API sent it.
- **Commits**: Conventional Commits in French (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`). Never push directly to `main`.
- **Assignment report**: `epreuve/RAPPORT.md` (untracked, being filled); proof screenshots in `epreuve/captures/`.
- **Séance 4 deliverables** in `epreuve/`: `EXIGENCES-TESTS.md` (test requirements, `ET-B-*` backend / `ET-F-*` frontend, each mapped to the real test that covers it — keep it in sync when adding tests) and `SEANCE-4-PREP.md` (8-minute demo script, seeded accounts, PR description).

### UI / UX rules (all user-mandated — do not "improve" them away)
- **Role-split labels**: create-button on reservations is « Nouvelle réservation » (`reservations.add`) for staff vs « Nouvelle demande de réservation » (`reservations.add.self` + `.title.self`) for adherents. Modal submits: reservations `reservations.submit` / `.submit.self`; borrow modal staff = « Enregistrer l'emprunt » (never « Valider l'emprunt » — that wording is reserved for the workflow validation action in table rows, detail modals and confirm dialogs), adherent = « Envoyer la demande d'emprunt ». Member-facing wording always says "demande" — members can only submit requests, never act directly.
- **Sidebar keys are role-split** but share routes: members use `sidebar.reserve` (Mes réservations), `sidebar.my-borrows` (Mes emprunts), `sidebar.my-returns` (Mes retours); staff Gestion uses `sidebar.reservations` (Reservation), `sidebar.borrow` (Emprunt), `sidebar.return` (Rendre) — same `/reservations`, `/borrow-book`, `/return-book`.
- **Page headers** are management-style for both roles: `/borrow-book` = « Gestion des emprunts — Créer, consulter et annuler des emprunts »; `/return-book` = « Gestion des retours… ». No per-role conditional subtitle on borrow-book.
- **Pending borrows live in the main table**: borrow-book has ONE unified staff table (all borrows incl. EN_ATTENTE — gated on `isStaff`, NOT `isAdmin`, so BIBLIOTHECAIRE sees it too) with a statut `<select>` filter in the same `.table-actions-bar` row as the buttons. The "Voir toutes les demandes d'emprunt" button, the folded section and the `/pending-borrows` page were all removed twice at the user's request — do NOT re-add them. No count in the table heading.
- **Borrow page has no catalog table** — removed at the user's request (books are browsable on the Livres page; the modal picker covers selection). Don't re-add a listing table or `scrollToCatalog`/`openBorrowModalWithBook`/direct `borrowBook()` helpers. Table rows are NOT clickable: details open only via the eye icon.
- **Book picker in the "Nouvel emprunt" modal is a predictive autocomplete for EVERYONE** (staff and adherents — the old staff `<select>` was replaced). Typing filters the FULL catalogue including 0-copy books; a 0-copy book shows « indisponible — Le réserver » and an unknown name shows « Aucun livre — Le réserver quand même », both routing to `/reservations?reserve=<id>` or `/reservations?reserveName=<nom>` (→ `newBookName`). The reserve-fallback hints are not gated on role. Submit is blocked unless the selected book has copies and isn't already borrowed. `borrow-book` also accepts `?book=<id>` to prefill the modal (linked from book-details « Emprunter »).
- **Réservation — libellé d'annulation piloté par le STATUT, jamais par le rôle** : DEMANDE (pas encore validée par l'admin) = « Annuler la demande » (`reservations.cancel`), EN_ATTENTE (validée) / DISPONIBLE = « Annuler la réservation » (`reservations.cancel.reservation`). Deux endroits, même règle : `reservation-container.cancelLabelFor()` (modale de détail de la liste + libellé de la modale de confirmation d'annulation) et `reservation-details.cancelLabel` (page `/reservation-details/:id`). Le libellé est recalculé à chaque cycle : si l'admin accepte pendant que la modale est ouverte, le bouton change de texte — c'est couvert par `cancelLabelFor` (spec du conteneur), `reservation-details.component.spec.ts` et `reservation-flow.integration.spec.ts`.
- **Règle d'annulation identique partout** : DEMANDE, EN_ATTENTE et DISPONIBLE sont annulables par leur propriétaire ou par le personnel (`reservation-list.canCancel`, `reservation-container.canCancelReservation` / `canCancelDetail`, `reservation-details.canCancel`) — c'est la règle du backend (`ReservationService.cancelFor`, RS-03). Ne PAS restreindre la page de détail aux seuls EN_ATTENTE/DISPONIBLE : elle divergeait du reste et rendait le libellé DEMANDE inatteignable.
- **Reservation modal**: the « Adhérent » select group is staff-only (`*ngIf="isStaff"` wraps the whole `.form-group`); adherents submit with no user block. The autocomplete "create new book" option must render whenever suggestions are shown — the list is NOT gated on `bookSuggestions.length > 0` (that gate made unknown titles unreservable).
- **Return page**: staff `return-book` loads `GET /borrow` (all borrows); members load their own via `getBooksBorrowedByUser(userId)` (self-allowed by the `borrowSecurity` bean). Never point members at `GET /borrow` — staff-only, 403.
- **Home page = diaporama PLEIN ÉCRAN** (`home/`) : l'image couvre tout l'écran et porte TROIS zones — barre du haut (logo icône + « Bibliothèque » à gauche, bouton « Se connecter » **blanc** à droite, masqué une fois connecté), centre (textes du slide courant : étiquette, titre, paragraphe, bouton), bas (pastilles). Il n'y a plus de hero : le sous-titre « Gestion de livres, d'emprunts et de réservations » a été **retiré à la demande de l'utilisateur** (la clé `home.subtitle` reste dans le dictionnaire mais n'est plus rendue — ne pas la réafficher sans demande). Chaque image porte ses propres textes (`home.slideN.alt|tag|title|text|cta`, fr + en). Navigation : **pastilles** (souris/tactile) et **flèches du clavier** (le slider a `tabindex="0"`) — les flèches précédent/suivant à l'écran ont été **retirées à la demande de l'utilisateur**, ne pas les réintroduire ; défilement automatique toutes les `slideDelay` (6 s), suspendu au survol et au focus. Trois pièges à conserver : (1) `goToSlide()` **redémarre** le minuteur, sinon un clic manuel juste avant l'échéance enchaîne aussitôt ; (2) `ngOnDestroy` libère l'intervalle ; (3) `:host { display: block; height: 100% }` dans `home.component.css` — sans hauteur sur `<app-home>`, `height: 100%` se résout contre une hauteur auto et l'image ne couvre plus que la hauteur de son contenu. Un visiteur non connecté voit les boutons de slide pointer vers `/login`. Les URLs d'images Unsplash en 1920x1080 suivent la convention du slider de la page de connexion.
- **Page de connexion — bouton retour** : `.back-btn` en haut à gauche (`login.back`, « Retour à l'accueil ») appelle `goHome()` → `router.navigate(['/'])`. C'est le SEUL moyen de quitter l'écran de connexion pour un visiteur ; c'est un `<button>`, pas un `<a href="/">` (un lien rechargerait toute l'application). Les bascules thème/langue restent en haut à droite (`.login-topbar`), sans chevauchement avec le formulaire — vérifié au navigateur de 390 à 1920 px. Son **survol est celui du bouton blanc « Se connecter » de la page d'accueil** : au survol (et au focus clavier) il passe en **fond blanc, texte sombre, bordure blanche, `translateY(-2px)` et ombre portée** — très visible en thème sombre, où il est une carte foncée au repos, discret en thème clair où il est déjà blanc. `:active` garde le blanc en enfonçant légèrement (`translateY(-1px) scale(.98)`). Vérifié au navigateur (CDP, `CSS.forcePseudoState(['hover'])`) dans les deux thèmes : sombre → `rgb(255,255,255)` + `matrix(1,0,0,1,0,-2)`. Ne pas revenir à un simple fondu d'opacité ni au survol des bascules.
- **Pleine page = `.app-main.main-full`, pas `.main-full`** : les règles `@media` de `app.component.css` (`max-width: 1024px / 768px / 480px`) réappliquent `padding` et `height` à `.app-main` et, à spécificité égale, l'emportent sur un `.main-full` déclaré plus haut — la page gardait alors une marge et une hauteur `100vh - 52px`. Le sélecteur doublé (0-2-0) gagne partout. Vérifié au navigateur (CDP) sur `/` et `/login` : 1920x1080, 1280x800, 1024x768 et 390x844 → `padding: 0`, page et image exactement à la taille du viewport, aucun débordement.
- **No emoji / AI-looking icons**: all icons are inline SVG (bootstrap-icons paths). Status labels are plain text — the colored `status-badge` carries the meaning.
- **Styling system in `styles.css`**: `color-scheme: dark` on `:root` (and `light` on `body.light-theme`) is what keeps native `<select>`/`<option>` dropdown cards on-charte — removing it makes Chrome render them white with blue hover. All `<select>`s inherit the charte via `select.form-control` / `.modal-form .form-group select` / `.form-card select` (purple SVG chevron, hover/focus ring) — new selects get it free, but bare selects inside modals must sit in `.modal-form .form-group`. Table action `<td>`s need the `.actions-cell` class (flex + 0.5rem gap, defined per component CSS) or buttons glue together. `.form-actions` is global (flex, gap, right-aligned); `.modal-form .form-actions` only adds the border-top/spacing, so detail modals using it outside a `modal-form` still get proper spacing.
- **Notification read-state is client-derived** (`_service/notification.service.ts`): the stream holds all notifications with a computed `read` flag, read IDs persist per-user in localStorage under `bibliotheque.notifRead` (`{ dismissed: [...], markAllOnOpen: bool }`; badge counts unread only), plus a per-user "mark all read on panel open" preference. `UserAuthService.clear()` removes only session keys (`roles`, `jwtToken`, `userId`, `name`) — never `localStorage.clear()`, it would wipe `theme`, `lang` and notification state. Member notifications cover borrow request confirmed/refused (VALIDEE/REFUSEE) and reservation accepted (EN_ATTENTE)/refused (ANNULEE), excluding self-cancels tracked in `bibliotheque.notifSelfCancel` (`markSelfCancelled()` on member self-cancellation). Notifications show book TITLES (loaded once via BooksService), never `Livre #id`.
