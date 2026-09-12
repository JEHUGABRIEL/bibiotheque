# Project Knowledge

This file gives Freebuff context about your project: goals, commands, conventions, and gotchas.

## Quickstart
- **Setup**:
  - Backend: `cd bibliotheque-backend && ./mvnw spring-boot:run` (requires JDK 21, PostgreSQL running)
  - Frontend: `cd bibliotheque-frontend && npm install && npm start` (Node 18 recommended)
  - Docker: `docker compose up` (backend + frontend only, no DB service)
- **Dev**:
  - Backend hot-reload: `spring-boot-devtools` is enabled
  - Frontend watch: `npm run watch`
- **Test**:
  - Backend: `./mvnw test` (only context-load test)
  - Frontend: `npm test` (Karma + Jasmine headless Chrome)

## Architecture
- **Key directories**:
  - `bibliotheque-backend/`: Spring Boot REST API (port 8080)
    - `src/main/java/com/ibizabroker/bibliotheque/`
      - `entity/`: JPA entities (Books, Users, Role, Borrow, Reservation)
      - `dao/`: Spring Data repositories
      - `controller/`: REST endpoints (BooksController, AdminController, BorrowController, JwtController, ReservationController)
      - `service/`: Business logic (JwtService, ReservationService)
      - `configuration/`: Security (WebSecurityConfiguration, JwtRequestFilter, CorsConfig)
      - `util/`: JwtUtil (jjwt 0.12.7)
    - `src/main/resources/application.properties`: DB config (PostgreSQL, env vars)
  - `bibliotheque-frontend/`: Angular 14 UI (port 4200)
    - `src/app/_service/`: HTTP services (books, users, borrow, reservation, user-auth, translation)
    - `src/app/_auth/`: Auth guard and interceptor
    - `src/app/_model/`: TypeScript types
    - Components: One folder per screen (15+), shared components (sidebar, modal, reservation-*)
  - `epreuve/`: Assignment report (RAPPORT.md) and screenshots
  - `docker/`: Docker env files (backend.env, backend.env.local)
- **Data flow**: Component → `_service` → interceptor (adds Bearer token) → CORS → JwtRequestFilter → security config → controller (`@PreAuthorize`) → repository → entity → DB.

## Conventions
- **Formatting/linting**:
  - Backend: Lombok for boilerplate reduction
  - Frontend: Angular style guide (TypeScript 4.7)
- **Patterns to follow**:
  - One controller per resource (BooksController, AdminController, BorrowController, ReservationController)
  - Services for business logic (JwtService, ReservationService)
  - Repositories extend Spring Data JPA interfaces
  - Frontend: One component per screen, services for HTTP calls, models for TypeScript types
  - Auth: JWT tokens in localStorage, BCrypt passwords, role-based guards
- **Things to avoid**:
  - Hardcoding API URLs (currently `http://localhost:8080` in 4 services)
  - Pushing directly to `main` branch
  - Committing `node_modules/`, `target/`, `dist/`
  - Using deprecated jjwt APIs (old `setSigningKey(String)`)
  - Running `./mvnw spring-boot:run` without sourcing `docker/backend.env.local` for DB password
  - Modifying `pom.xml` or `package.json` unless absolutely necessary
  - Committing secrets (use `docker/backend.env.local` which is gitignored)

## Gotchas
- **README is outdated**: Still documents Spring Boot 2.4.5/Java 8/MySQL. Current: Boot 3.1.5/Java 21/PostgreSQL.
- **Security config quirks**: `permitAll` covers `/authenticate`, `/borrow/**`, `/admin/books/` (trailing slash). Per-role checks via `@PreAuthorize` in controllers.
- **ReservationController**: No `@PreAuthorize` — any authenticated user can call `/api/reservations`; only Angular route restricts to Admin.
- **JWT secret has code default**: Override via env in real deployments.
- **Local run needs password sourced**: `docker/backend.env.local` only read by docker compose, not `./mvnw spring-boot:run`. Source it first: `set -a; source ../docker/backend.env.local; set +a`.
- **Database**: Backend does NOT create schema, only tables (`ddl-auto=update`). Create DB first, seed first admin via SQL (BCrypt hash for `admin123` in README §5).
- **jjwt 0.12.7**: Modern API (`Keys.hmacShaKeyFor`, `Jwts.parser().verifyWith()`). Old code samples won't compile.
- **Commits**: Conventional Commits in French (`feat:`, `fix:`, `chore:`). Never push directly to `main`.
- **Assignment report**: `epreuve/RAPPORT.md` to fill; proof screenshots in `epreuve/captures/`.
