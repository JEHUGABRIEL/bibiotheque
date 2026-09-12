# Project Knowledge: Bibliothèque

Full-stack library management application for a course project (Épreuve Séance 1).
- **Backend**: Spring Boot 3.1.5 REST API (`bibliotheque-backend/`, port 8080)
- **Frontend**: Angular 14 UI (`bibliotheque-frontend/`, port 4200)
- **Database**: PostgreSQL (env vars: `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`)
- **Auth**: JWT (jjwt 0.12.7) + BCrypt passwords, role-based (Admin/User)
- **Current branch**: `feature/reservation-securite-jehu-binga` — adds reservations + borrow validation workflow (EN_ATTENTE → VALIDEE/REFUSEE → RENDU)
- **Roles**: Admin, User, plus new `BIBLIOTHECAIRE` (staff) and `ADHERENT` (member) roles used in borrow endpoints

## Key Directories
- `bibliotheque-backend/src/main/java/com/ibizabroker/bibliotheque/`
  - `entity/`: JPA entities (Books, Users, Role, Borrow, Reservation, JwtRequest/Response)
  - `dao/`: Spring Data repositories
  - `controller/`: REST endpoints (BooksController, AdminController, BorrowController, JwtController, ReservationController)
  - `service/`: Business logic (JwtService, ReservationService)
  - `configuration/`: Security (WebSecurityConfiguration, JwtRequestFilter, CorsConfig)
  - `util/`: JwtUtil (token creation/validation)
- `bibliotheque-frontend/src/app/`
  - `_service/`: HTTP services (books, users, borrow, reservation, user-auth, translation)
  - `_auth/`: Auth guard and interceptor
  - `_model/`: TypeScript types
  - Components: One folder per screen (15+), shared components (sidebar, modal, reservation-*)
- `epreuve/`: Assignment report (RAPPORT.md) and screenshots
- Backend `entity/StatutBorrow.java` + frontend `_model/borrow.ts`: shared enum `EN_ATTENTE | VALIDEE | REFUSEE | EN_COURS | RENDU` — keep both in sync
- Backend `entity/StatutReservation.java` + frontend `_model/reservation.ts`: shared enum `DEMANDE | EN_ATTENTE | DISPONIBLE | ANNULEE | EXPIREE | HONOREE` — keep both in sync
- **Reservation workflow**: ADHERENT creating a reservation → statut `DEMANDE` (a REQUEST the staff must accept); staff creating → `EN_ATTENTE` directly. `PATCH /api/reservations/{id}/accepter` (BIBLIOTHECAIRE/Admin only) moves DEMANDE → EN_ATTENTE (409 otherwise, 403 for adherents). Annulation allows DEMANDE/EN_ATTENTE/DISPONIBLE. "Active" status for quota/duplicate checks = DEMANDE + EN_ATTENTE + DISPONIBLE (`STATUTS_ACTIFS`). DB: `reservation_statut_check` constraint must include DEMANDE. Don't revert adherent creation to EN_ATTENTE — the DEMANDE approval step is an explicit user requirement.
- Frontend `_shared/`: reusable `modal`, `confirm-modal`, `toast` components (with `toast.service.ts`)

## Commands

### Backend (requires JDK 21)
```bash
cd bibliotheque-backend
./mvnw spring-boot:run        # Dev server on :8080
./mvnw test                   # Only context-load test exists
./mvnw clean package          # Builds target/bibliotheque-0.0.1-SNAPSHOT.jar
```

### Frontend (Angular 14, Node 18 recommended)
```bash
cd bibliotheque-frontend
npm install                   # No package-lock.json in repo
npm start                     # ng serve on :4200
npm test                      # Karma + Jasmine (headless Chrome)
npm run build
```

### Docker
```bash
docker compose up             # Backend + frontend, no DB service
```
Secrets from `docker/backend.env` + gitignored `docker/backend.env.local`.

## Borrow Workflow (Business Rules)
- `POST /borrow`: staff (BIBLIOTHECAIRE/Admin) borrows directly → `VALIDEE`; ADHERENT/User creates request → `EN_ATTENTE`.
- `PATCH /borrow/{id}/confirmer` and `/refuser`: staff validates or refuses borrows (confirm decrements `noOfCopies`; refusing a VALIDEE borrow increments it back before marking REFUSEE — refusing RENDU/REFUSEE is a 409).
- `PUT /borrow`: staff registers return; `PUT /borrow/request`: ADHERENT requests return of own borrow.
- Quotas (ADHERENT only): QUOTA-01 max 3 active borrows (EN_ATTENTE+VALIDEE), QUOTA-02 max 1 active borrow per book.
- `GET /borrow/my/quota`: active count + remaining quota for logged-in ADHERENT.
- Custom exceptions: `BadRequestException`, `ConflictException`, `ForbiddenException`, `NotFoundException` (→ 400/409/403/404).

## Data Flow
Component → `_service` → interceptor (adds Bearer token) → CORS → JwtRequestFilter → security config → controller (`@PreAuthorize`) → repository → entity → DB.

## Conventions & Gotchas
- **README is outdated**: Still documents Spring Boot 2.4.5/Java 8/MySQL. Current: Boot 3.1.5/Java 21/PostgreSQL.
- **API URL centralized**: all services use `environment.apiUrl` (`src/environments/environment.ts` for dev, `environment.prod.ts` swapped in by `fileReplacements` on `ng build --configuration production`). Default is `http://localhost:8080` in both; nginx.conf has no `/api` proxy, so prod still expects the API on the same host.
- **Security config**: `permitAll` covers only `/authenticate`, `/admin/books/` (trailing slash) and `OPTIONS`. Per-role checks via `@PreAuthorize` in controllers (NOT in security config) — `GET /borrow/user/{id}` and `/borrow/book/{id}` have no `@PreAuthorize`.
- **JWT secret has code default**: Override via env in real deployments.
- **Local run needs password sourced**: `docker/backend.env.local` only read by docker compose, not `./mvnw spring-boot:run`. Source it first: `set -a; source ../docker/backend.env.local; set +a`.
- **Commits**: Conventional Commits in French (`feat:`, `fix:`, `chore:`). Never push directly to `main`.
- **Assignment report**: `epreuve/RAPPORT.md` to fill; proof screenshots in `epreuve/captures/`.
- **Database**: Backend does NOT create schema, only tables (`ddl-auto=update`). Create DB first, seed first admin via SQL (BCrypt hash for `admin123` in README §5).
- **Return page (staff)**: `return-book` loads `GET /borrow` (all borrows) for staff, not `/borrow/user/{id}` — staff returns cover every member's VALIDEE borrow. Members load their own via `getBooksBorrowedByUser(userId)` (self-allowed by the `borrowSecurity` bean) — never point members at `GET /borrow`, it's staff-only (403).
- **Frontend builds**: `npx ng build` defaults to the production configuration, which inlines Google Fonts and FAILS offline (`Inlining of fonts failed`). In this environment verify with `npx ng build --configuration development` (optimization off, no font fetch), or add `NG_BUILD_OPTIMIZE_CHUNKS`-style font bypass only if truly needed.
- `DELETE /borrow/{id}`: Admin-only. Safe-delete mirrors book deletion — deleting an in-progress borrow (VALIDEE, no returnDate) is a 409 (the decremented copy would be lost); returned/refused borrows delete fine. UI: borrow-book has ONE unified admin table (all borrows, incl. pending requests) with per-row actions — details (modal), valider/refuser/retourner (generic confirm modal), supprimer (chained: confirm modal → typed-book-name modal for active borrows/requests; SINGLE simple confirm modal for RENDU/REFUSEE — no typed-name step, per user request). Pending requests (EN_ATTENTE) live on a DEDICATED PAGE `/pending-borrows` (`pending-borrows` component, STAFF route Admin+BIBLIOTHECAIRE — matches the backend `hasAnyRole('BIBLIOTHECAIRE','Admin')` on GET /borrow and confirmer/refuser; do NOT revert to Admin-only) opened by the "Voir toutes les demandes d'emprunt" button AND via the "Demandes d'emprunt" sidebar link (staff Gestion section, `sidebar.pending-borrows` i18n key) — NOT an inline folded table (tried twice, removed twice at the user's request). No borrow count in the main table heading. The old "Tous les emprunts" heading is REPLACED by a statut filter `<select>` (Tous les emprunts + 5 statuts), sitting in the same `.table-actions-bar` row as the two buttons (same height, flex layout).
- **No emoji/IA icons**: all icons are inline SVG (bootstrap-icons paths). Status labels are plain text (no ⏳✅❌ …) — the colored `status-badge` carries the meaning.
- **Borrow/return forms**: "Nouvel emprunt" / "Nouveau retour" open modal forms (`borrow-book` / `return-book` components). Staff pick a member + resource (borrowing for anyone, immediate VALIDEE); adherents never send `userId` in the body — the backend takes identity from the JWT (RS-04). Staff book picker = `<select>`; **adherent book picker = predictive autocomplete input** (same `.form-group.autocomplete` pattern as the reservation modal): typing filters the FULL catalogue (incl. 0-copy books), selecting a 0-copy book shows "indisponible — Le réserver" and an unknown name shows "Aucun livre — Le réserver quand même", both routing to `/reservations?reserve=<id>` (existing book) or `/reservations?reserveName=<nom>` (unknown → `newBookName`). Submit is blocked unless the selected book has copies and isn't already borrowed. `borrow-book` also accepts `?book=<id>` to prefill the modal (linked from book-details "Emprunter"). The borrow page has NO catalog table anymore — it was removed at the user's request (books are browsable on the Livres page; the modal's book picker covers selection). Do NOT re-add a books listing table to borrow-book, and no `scrollToCatalog`/`openBorrowModalWithBook`/direct `borrowBook()` helpers. The borrow table rows are NOT clickable — details open ONLY via the eye icon (user request, do not re-add row-click).
- **Native select popups**: `color-scheme: dark` is set on `:root` (and `light` on `body.light-theme`) in `styles.css` — this is what keeps the `<option>` dropdown cards (status enum filters) on-charte; removing it makes Chrome render them white with blue hover.
- **Reservation modal**: the "Adhérent" select group is staff-only (`*ngIf="isStaff"` wraps the whole `.form-group`); adherents submit without a user block.
- **Global select styling**: all `<select>` elements share the charte graphique via the `select.form-control` / `.modal-form .form-group select` / `.form-card select` rules in `styles.css` (purple SVG chevron, hover/focus ring, themed options). New selects get it automatically; bare selects in modals must sit inside `.modal-form .form-group`. Same pattern for action cells: `.actions-cell` (flex + 0.5rem gap, defined per component css) wraps table row action buttons — every table's actions `<td>` needs it (reservation-list was missing it, buttons were glued together). `.form-actions` is GLOBAL in styles.css (flex + gap, right-aligned); `.modal-form .form-actions` only adds the border-top/spacing — so detail modals using `form-actions` OUTSIDE a `modal-form` get proper button spacing too.
- **Endpoint security**: All endpoints have `@PreAuthorize` guards. Borrow reads follow a staff-or-self rule: `GET /borrow/user/{id}` and `/user/{id}/pending` allow BIBLIOTHECAIRE/Admin or the owner (via the `borrowSecurity` SpEL bean in BorrowController); `GET /borrow/book/{id}` is staff-only. Reservation ownership is enforced in `ReservationService` from the JWT identity (RS-03/RS-04).
- **jjwt 0.12.7**: Modern API (`Keys.hmacShaKeyFor`, `Jwts.parser().verifyWith()`). Old code samples won't compile.
- **Notification read-state**: bell notifications are client-derived (`_service/notification.service.ts`); the published stream contains ALL notifications with a computed `read` flag, and read IDs persist per-user in localStorage under `bibliotheque.notifRead` (`{ dismissed: [...], markAllOnOpen: bool }` — badge counts unread only). Per-user preference "mark all read on panel open" toggled in the panel footer. `UserAuthService.clear()` removes only session keys (`roles`, `jwtToken`, `userId`, `name`) — never use `localStorage.clear()`, it would wipe `theme`, `lang` and notification read-state too. Member notifications include borrow request confirmed/refused (VALIDEE/REFUSEE) and reservation request accepted (EN_ATTENTE)/refused (ANNULEE, excluding self-cancels tracked in `bibliotheque.notifSelfCancel` per user — `markSelfCancelled()` is called on member self-cancellation in reservation-container). Notifications display book TITLES (loaded once via BooksService) not `Livre #id`. NOTE: the autocomplete "create new book" option in the reservation modal renders whenever suggestions are shown — the list is NOT gated on `bookSuggestions.length > 0` (that gate made unknown titles like "Test C" unreservable).
- **Backend restarts**: devtools restart is DISABLED in `application.properties`; `./mvnw spring-boot:run` picks up code changes only on a fresh start. A stale server returning 401/403 for endpoints that should work is the first suspect when the UI bounces to login. A stale server also WROTE bad rows this once: borrows created while an old build ran had `statut = NULL` (empty table rows). The `borrow.statut` column is now `NOT NULL DEFAULT 'EN_ATTENTE'` with a CHECK constraint at the DB level — new rows can't be corrupt even from a stale build.
