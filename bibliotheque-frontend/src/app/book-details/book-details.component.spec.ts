import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

import { BookDetailsComponent } from './book-details.component';
import { Books } from '../_model/books';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { Users } from '../_model/users';
import { environment } from '../../environments/environment';

/**
 * Tests de la page « détail d'un livre » : chargement du livre et de son
 * historique d'emprunts d'après l'identifiant de la route.
 */
describe('BookDetailsComponent', () => {

  const API = environment.apiUrl;

  let httpMock: HttpTestingController;

  function setup(bookId = 3) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [BookDetailsComponent],
      imports: [CommonModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: { bookId } } } }
      ]
    });

    const fixture = TestBed.createComponent(BookDetailsComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    return { fixture, component };
  }

  afterEach(() => httpMock.verify());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  it('charge le livre et son historique d\'emprunts au démarrage', () => {
    const ctx = setup(3);
    ctx.fixture.detectChanges();

    expect(ctx.component.id).toBe(3);

    httpMock.expectOne(`${API}/admin/books/3`).flush({
      bookId: 3, bookName: '1984', bookAuthor: 'G. Orwell',
      bookGenre: 'SF', noOfCopies: 0, imageUrl: ''
    } as Books);

    const history = httpMock.expectOne(`${API}/borrow/book/3`);
    expect(history.request.method).toBe('GET');
    history.flush([
      { borrowId: 1, bookId: 3, userId: 51, statut: StatutBorrow.RENDU, returnDate: '05-09-2026' }
    ] as unknown as Borrow[]);

    expect(ctx.component.book.bookName).toBe('1984');
    expect(ctx.component.book.noOfCopies).toBe(0);
    expect(ctx.component.borrow.length).toBe(1);
  });

  it('getUserData interroge l\'annuaire pour l\'identifiant demandé', () => {
    const ctx = setup(3);
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${API}/admin/books/3`).flush({ bookId: 3, bookName: '1984' } as Books);
    httpMock.expectOne(`${API}/borrow/book/3`).flush([]);

    ctx.component.getUserData(51);

    const req = httpMock.expectOne(`${API}/admin/users/51`);
    expect(req.request.method).toBe('GET');
    req.flush({ userId: 51, name: 'Jehu Binga', username: 'jehu' } as Users);

    expect(ctx.component.user.name).toBe('Jehu Binga');
  });
});
