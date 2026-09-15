import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthInterceptor } from '../_auth/auth.interceptor';
import { UserAuthService } from '../_service/user-auth.service';
import { BorrowService } from '../_service/borrow.service';
import { BooksService } from '../_service/books.service';
import { UsersService } from '../_service/users.service';
import { ReservationService } from '../_service/reservation.service';
import { environment } from '../../environments/environment';

/**
 * Test d'INTÉGRATION : services réels → AuthInterceptor réel → HttpClient simulé.
 *
 * Le testeur ne fabrique plus de faux HttpRequest (contrairement à
 * auth.interceptor.spec.ts) : il appelle les services comme le ferait un
 * composant et observe ce qui sort réellement du client HTTP, puis ce que
 * l'intercepteur fait des réponses d'erreur (purge de session, redirections).
 *
 * Aucun backend n'est requis.
 */
describe('Intégration — API + intercepteur JWT', () => {
  let httpMock: HttpTestingController;
  let auth: UserAuthService;
  let router: Router;
  let borrowService: BorrowService;
  let booksService: BooksService;
  let usersService: UsersService;
  let reservationService: ReservationService;

  const API = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(UserAuthService);
    router = TestBed.inject(Router);
    borrowService = TestBed.inject(BorrowService);
    booksService = TestBed.inject(BooksService);
    usersService = TestBed.inject(UsersService);
    reservationService = TestBed.inject(ReservationService);

    spyOn(router, 'navigate');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ---------- Injection du jeton ----------

  describe('jeton Bearer', () => {
    it('ajoute Authorization: Bearer <token> à tous les appels métier', () => {
      auth.setToken('jwt-abc');

      borrowService.getBorrowList().subscribe();       // GET  /borrow
      booksService.getBooksList().subscribe();         // GET  /admin/books
      reservationService.getAll().subscribe();         // GET  /api/reservations
      reservationService.accepter(10).subscribe();     // PATCH /api/reservations/10/accepter

      ['/borrow', '/admin/books', '/api/reservations', '/api/reservations/10/accepter']
        .forEach(path => {
          const req = httpMock.expectOne(`${API}${path}`);
          expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-abc');
          req.flush([]);
        });
    });

    it('n\'ajoute aucun jeton à l\'authentification (/authenticate est marqué No-Auth)', () => {
      usersService.login({ username: 'admin', password: 'admin123' } as any).subscribe();

      const req = httpMock.expectOne(`${API}/authenticate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBeNull();
      expect(req.request.headers.get('No-Auth')).toBe('True');
      req.flush({ jwtToken: 'nouveau-jeton' });
    });

    it('la connexion reste possible après une purge de session', () => {
      // Premier essai refusé (mauvais mot de passe) : l'erreur est gérée par le formulaire.
      usersService.login({ username: 'admin', password: 'faux' } as any)
        .subscribe({ error: () => {} });
      httpMock.expectOne(`${API}/authenticate`).flush({}, { status: 401, statusText: 'Unauthorized' });

      usersService.login({ username: 'admin', password: 'admin123' } as any)
        .subscribe({ error: () => {} });
      const req = httpMock.expectOne(`${API}/authenticate`);
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({ jwtToken: 'ok' });
    });
  });

  // ---------- Réactions aux erreurs ----------

  describe('401 — session invalide', () => {
    it('purge la session, redirige vers /login et laisse remonter l\'erreur', () => {
      auth.setToken('jwt-expire');
      auth.setUserId(51);

      let received: any = null;
      booksService.getBooksList().subscribe({ error: (err) => (received = err) });

      httpMock.expectOne(`${API}/admin/books`).flush(
        { message: 'Jeton expiré', expired: true },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(localStorage.getItem('jwtToken')).toBeNull();
      expect(localStorage.getItem('userId')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
      // Le composant doit pouvoir lire le statut ET le message du backend.
      expect(received.status).toBe(401);
      expect(received.error.message).toBe('Jeton expiré');
    });

    it('garde la gestion du 401 LOCALE sur /api/reservations (pas de redirection)', () => {
      auth.setToken('jwt-expire');

      let received: any = null;
      reservationService.getAll().subscribe({ error: (err) => (received = err) });

      httpMock.expectOne(`${API}/api/reservations`).flush(
        { message: 'Session expirée', expired: true },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(router.navigate).not.toHaveBeenCalled();
      expect(received.status).toBe(401);
      // La session est purgée dans tous les cas : le lien « Réessayer » force une reconnexion.
      expect(localStorage.getItem('jwtToken')).toBeNull();
    });
  });

  describe('403 — droits insuffisants', () => {
    it('redirige vers /forbidden pour un appel global', () => {
      auth.setToken('jwt-abc');

      usersService.getUsersList().subscribe({ error: () => {} });
      httpMock.expectOne(`${API}/admin/users`).flush(
        { message: 'Accès refusé' },
        { status: 403, statusText: 'Forbidden' }
      );

      expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
      // Un 403 n'est pas un problème de session : le jeton reste valide.
      expect(localStorage.getItem('jwtToken')).toBe('jwt-abc');
    });

    it('ne redirige pas sur /api/reservations (annulation de la réservation d\'un autre)', () => {
      auth.setToken('jwt-abc');

      let status = 0;
      reservationService.annuler(10).subscribe({ error: (err) => (status = err.status) });
      httpMock.expectOne(`${API}/api/reservations/10/annuler`).flush(
        { message: 'Accès refusé' },
        { status: 403, statusText: 'Forbidden' }
      );

      expect(router.navigate).not.toHaveBeenCalled();
      expect(status).toBe(403);
    });
  });

  describe('erreurs métier', () => {
    it('ne redirige pas sur 409 et transmet le message au composant', () => {
      auth.setToken('jwt-abc');

      let status = 0;
      let message = '';
      borrowService.confirmBorrow(12).subscribe({
        error: (err) => {
          status = err.status;
          message = err.error.message;
        }
      });

      httpMock.expectOne(`${API}/borrow/12/confirmer`).flush(
        { message: 'Emprunt déjà refusé' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(router.navigate).not.toHaveBeenCalled();
      expect(status).toBe(409);
      expect(message).toBe('Emprunt déjà refusé');
    });

    it('ne redirige pas sur 500', () => {
      auth.setToken('jwt-abc');
      borrowService.getBorrowList().subscribe({ error: () => {} });
      httpMock.expectOne(`${API}/borrow`).flush({}, { status: 500, statusText: 'Server Error' });

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
