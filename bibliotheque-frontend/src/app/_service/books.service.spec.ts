import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BooksService } from './books.service';
import { Books } from '../_model/books';
import { environment } from '../../environments/environment';

/**
 * Tests unitaires du contrat HTTP de BooksService (CRUD /admin/books).
 * Aucun backend nécessaire : HttpTestingController capture les requêtes.
 */
describe('BooksService — contrat HTTP', () => {
  let service: BooksService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/admin/books`;

  const makeBook = (id: number, name: string): Books => ({
    bookId: id, bookName: name, bookAuthor: 'A. Auteur',
    bookGenre: 'Roman', noOfCopies: 1, imageUrl: ''
  } as Books);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(BooksService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getBooksList interroge GET /admin/books', () => {
    let result: Books[] | undefined;
    service.getBooksList().subscribe(b => (result = b));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([makeBook(1, 'Dune')]);

    expect(result!.length).toBe(1);
    expect(result![0].bookName).toBe('Dune');
  });

  it('getBookById interroge GET /admin/books/{id}', () => {
    service.getBookById(3).subscribe();
    const req = httpMock.expectOne(`${base}/3`);
    expect(req.request.method).toBe('GET');
    req.flush(makeBook(3, '1984'));
  });

  it('createBook poste le livre complet', () => {
    service.createBook(makeBook(0, 'Le Petit Prince')).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.bookName).toBe('Le Petit Prince');
    expect(req.request.body.noOfCopies).toBe(1);
    req.flush({ bookId: 42 });
  });

  it('updateBook envoie un PUT sur /admin/books/{id}', () => {
    service.updateBook(7, makeBook(7, 'Dune — édition revue')).subscribe();

    const req = httpMock.expectOne(`${base}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.bookName).toBe('Dune — édition revue');
    req.flush({ message: 'Livre mis à jour' });
  });

  it('deleteBook envoie un DELETE sur /admin/books/{id}', () => {
    service.deleteBook(7).subscribe();

    const req = httpMock.expectOne(`${base}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Livre supprimé' });
  });

  it('transmet le message de conflit du backend (livre encore emprunté)', () => {
    let status = 0;
    let message = '';
    service.deleteBook(7).subscribe({
      error: (err) => {
        status = err.status;
        message = err.error?.message;
      }
    });

    httpMock.expectOne(`${base}/7`).flush(
      { message: 'Impossible de supprimer : des emprunts sont en cours' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(status).toBe(409);
    expect(message).toContain('emprunts sont en cours');
  });
});
