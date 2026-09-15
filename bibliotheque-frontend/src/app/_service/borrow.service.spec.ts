import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BorrowService } from './borrow.service';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { environment } from '../../environments/environment';

/**
 * Tests unitaires du contrat HTTP de BorrowService : chaque méthode doit
 * appeler le bon verbe sur la bonne URL, avec le bon corps. Aucun backend
 * n'est nécessaire — HttpTestingController intercepte les requêtes.
 */
describe('BorrowService — contrat HTTP', () => {
  let service: BorrowService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/borrow`;

  const makeBorrow = (bookId: number, userId?: number): Borrow => {
    const b = new Borrow();
    b.bookId = bookId;
    if (userId !== undefined) {
      b.userId = userId;
    }
    return b;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(BorrowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('lectures', () => {
    it('getBorrowList interroge GET /borrow', () => {
      let result: Borrow[] | undefined;
      service.getBorrowList().subscribe(list => (result = list));

      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush([{ borrowId: 1, bookId: 4, userId: 51, statut: StatutBorrow.EN_ATTENTE }]);

      expect(result!.length).toBe(1);
      expect(result![0].statut).toBe(StatutBorrow.EN_ATTENTE);
    });

    it('getPendingBorrows interroge GET /borrow/pending', () => {
      service.getPendingBorrows().subscribe();
      const req = httpMock.expectOne(`${base}/pending`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('getBooksBorrowedByUser interroge GET /borrow/user/{id}', () => {
      service.getBooksBorrowedByUser(51).subscribe();
      const req = httpMock.expectOne(`${base}/user/51`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('getPendingBorrowsByUser interroge GET /borrow/user/{id}/pending', () => {
      service.getPendingBorrowsByUser(51).subscribe();
      const req = httpMock.expectOne(`${base}/user/51/pending`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('getBookBorrowHistory interroge GET /borrow/book/{id}', () => {
      service.getBookBorrowHistory(7).subscribe();
      const req = httpMock.expectOne(`${base}/book/7`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('getMyQuota interroge GET /borrow/my/quota et renvoie le quota de l\'adhérent', () => {
      let quota: { activeCount: number; maxQuota: number; remaining: number } | undefined;
      service.getMyQuota().subscribe(q => (quota = q));

      const req = httpMock.expectOne(`${base}/my/quota`);
      expect(req.request.method).toBe('GET');
      req.flush({ activeCount: 2, maxQuota: 3, remaining: 1 });

      expect(quota).toEqual({ activeCount: 2, maxQuota: 3, remaining: 1 });
    });
  });

  describe('création d\'emprunt', () => {
    it('borrowBook poste le corps tel quel sur POST /borrow', () => {
      const borrow = makeBorrow(4, 51);
      service.borrowBook(borrow).subscribe();

      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      // Spread : le corps est une instance de Borrow, comparée à un objet littéral
      expect({ ...req.request.body }).toEqual({ bookId: 4, userId: 51 });
      req.flush({ message: 'ok' });
    });

    it('un adhérent envoie un corps sans userId (RS-04 : identité prise dans le token)', () => {
      service.borrowBook(makeBorrow(4)).subscribe();

      const req = httpMock.expectOne(base);
      // userId non renseigné → absent du JSON (undefined est ignoré par JSON.stringify)
      expect(req.request.body.userId).toBeUndefined();
      expect((req.request.body as any).bookId).toBe(4);
      req.flush({ message: 'demande enregistrée' });
    });
  });

  describe('workflow du personnel', () => {
    it('confirmBorrow appelle PATCH /borrow/{id}/confirmer', () => {
      service.confirmBorrow(12).subscribe();
      const req = httpMock.expectOne(`${base}/12/confirmer`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ message: 'Emprunt confirmé' });
    });

    it('refuseBorrow appelle PATCH /borrow/{id}/refuser', () => {
      service.refuseBorrow(12).subscribe();
      const req = httpMock.expectOne(`${base}/12/refuser`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ message: 'Emprunt refusé' });
    });

    it('returnBook enregistre un retour sur PUT /borrow', () => {
      const borrow = new Borrow();
      borrow.borrowId = 12;
      service.returnBook(borrow).subscribe();

      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('PUT');
      expect({ ...req.request.body }).toEqual({ borrowId: 12 });
      req.flush({ message: 'Retour enregistré' });
    });

    it('requestReturn (adhérent) utilise PUT /borrow/request', () => {
      const borrow = new Borrow();
      borrow.borrowId = 12;
      service.requestReturn(borrow).subscribe();

      const req = httpMock.expectOne(`${base}/request`);
      expect(req.request.method).toBe('PUT');
      expect({ ...req.request.body }).toEqual({ borrowId: 12 });
      req.flush({ message: 'Demande de retour enregistrée' });
    });

    it('deleteBorrow appelle DELETE /borrow/{id}', () => {
      service.deleteBorrow(12).subscribe();
      const req = httpMock.expectOne(`${base}/12`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Emprunt supprimé' });
    });
  });

  describe('propagation des erreurs', () => {
    it('transmet le message d\'erreur du backend au composant (409)', () => {
      let status = 0;
      let message = '';
      service.deleteBorrow(12).subscribe({
        error: (err) => {
          status = err.status;
          message = err.error?.message;
        }
      });

      httpMock.expectOne(`${base}/12`).flush(
        { message: 'Emprunt en cours : il doit être rendu avant suppression' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(status).toBe(409);
      expect(message).toContain('rendu avant suppression');
    });
  });
});
