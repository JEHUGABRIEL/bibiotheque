import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReservationService } from './reservation.service';
import { Reservation, StatutReservation } from '../_model/reservation';
import { environment } from '../../environments/environment';

/**
 * Tests unitaires du contrat HTTP de ReservationService.
 * On vérifie en particulier le préfixe /api/reservations (différent du reste de
 * l'API), la sérialisation de newBookName et la query string ?statut=.
 */
describe('ReservationService — contrat HTTP', () => {
  let service: ReservationService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/api/reservations`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ReservationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll interroge GET /api/reservations', () => {
    let result: Reservation[] | undefined;
    service.getAll().subscribe(r => (result = r));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, bookId: 3, userId: 51, statut: StatutReservation.DEMANDE }]);

    expect(result!.length).toBe(1);
  });

  it('getById interroge GET /api/reservations/{id}', () => {
    service.getById(9).subscribe();
    const req = httpMock.expectOne(`${base}/9`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 9, statut: StatutReservation.EN_ATTENTE });
  });

  it('getByStatut passe le statut en query string', () => {
    service.getByStatut(StatutReservation.DEMANDE).subscribe();
    const req = httpMock.expectOne(`${base}?statut=DEMANDE`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getBooksCatalog lit le catalogue complet via /admin/books (contournement documenté)', () => {
    service.getBooksCatalog().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/admin/books`);
    expect(req.request.method).toBe('GET');
    req.flush([{ bookId: 1, bookName: 'Dune', noOfCopies: 0 }]);
  });

  it('create poste la réservation (livre existant)', () => {
    const reservation = new Reservation();
    reservation.bookId = 4;
    service.create(reservation).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    // Spread : le corps est une instance de Reservation, comparée à un objet littéral
    expect({ ...req.request.body }).toEqual({ bookId: 4 });
    req.flush({ id: 10, bookId: 4, statut: StatutReservation.DEMANDE });
  });

  it('create sérialise newBookName pour un livre non enregistré', () => {
    const reservation = new Reservation();
    reservation.newBookName = '  Test C  '.trim();
    service.create(reservation).subscribe();

    const req = httpMock.expectOne(base);
    expect({ ...req.request.body }).toEqual({ newBookName: 'Test C' });
    req.flush({ id: 11, statut: StatutReservation.DEMANDE });
  });

  it('un adhérent ne poste aucun userId (RS-04)', () => {
    const reservation = new Reservation();
    reservation.bookId = 4;
    service.create(reservation).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.body.userId).toBeUndefined();
    req.flush({ id: 12, statut: StatutReservation.DEMANDE });
  });

  it('annuler appelle PATCH /api/reservations/{id}/annuler', () => {
    service.annuler(10).subscribe();
    const req = httpMock.expectOne(`${base}/10/annuler`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush({ id: 10, statut: StatutReservation.ANNULEE });
  });

  it('accepter appelle PATCH /api/reservations/{id}/accepter', () => {
    service.accepter(10).subscribe();
    const req = httpMock.expectOne(`${base}/10/accepter`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush({ id: 10, statut: StatutReservation.EN_ATTENTE });
  });

  it('transmet les erreurs du backend (403 sur annulation d\'autrui)', () => {
    let status = 0;
    service.annuler(10).subscribe({ error: (err) => (status = err.status) });

    httpMock.expectOne(`${base}/10/annuler`).flush(
      { message: 'Accès refusé' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(status).toBe(403);
  });
});
