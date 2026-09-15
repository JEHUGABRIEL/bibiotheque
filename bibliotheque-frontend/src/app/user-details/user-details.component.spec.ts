import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

import { UserDetailsComponent } from './user-details.component';
import { Books } from '../_model/books';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { Users } from '../_model/users';
import { environment } from '../../environments/environment';

/**
 * Tests de la page « détail d'un adhérent » : identité, catalogue (pour les
 * titres) et historique d'emprunts, d'après l'identifiant de la route.
 */
describe('UserDetailsComponent', () => {

  const API = environment.apiUrl;

  let httpMock: HttpTestingController;

  function setup(userId = 51) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [UserDetailsComponent],
      imports: [CommonModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: { userId } } } }
      ]
    });

    const fixture = TestBed.createComponent(UserDetailsComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    return { fixture, component };
  }

  afterEach(() => httpMock.verify());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  it('charge l\'identité, le catalogue et les emprunts de l\'adhérent', () => {
    const ctx = setup(51);
    ctx.fixture.detectChanges();

    expect(ctx.component.id).toBe(51);

    httpMock.expectOne(`${API}/admin/users/51`).flush({
      userId: 51, username: 'jehu', name: 'Jehu Binga', password: '',
      role: [{ roleName: 'ADHERENT' }]
    } as Users);

    const catalog = httpMock.expectOne(`${API}/admin/books`);
    expect(catalog.request.method).toBe('GET');
    catalog.flush([
      { bookId: 1, bookName: 'Dune' } as Books,
      { bookId: 2, bookName: '1984' } as Books
    ]);

    const history = httpMock.expectOne(`${API}/borrow/user/51`);
    expect(history.request.method).toBe('GET');
    history.flush([
      { borrowId: 1, bookId: 1, userId: 51, statut: StatutBorrow.VALIDEE },
      { borrowId: 2, bookId: 2, userId: 51, statut: StatutBorrow.RENDU, returnDate: '05-09-2026' }
    ] as unknown as Borrow[]);

    expect(ctx.component.user.name).toBe('Jehu Binga');
    expect(ctx.component.books.length).toBe(2);
    expect(ctx.component.borrow.length).toBe(2);
  });

  it('résout le titre d\'un livre et retombe sur « Livre #id »', () => {
    const ctx = setup(51);
    ctx.fixture.detectChanges();

    httpMock.expectOne(`${API}/admin/users/51`).flush({ userId: 51, name: 'Jehu Binga' } as Users);
    httpMock.expectOne(`${API}/admin/books`).flush([{ bookId: 1, bookName: 'Dune' } as Books]);
    httpMock.expectOne(`${API}/borrow/user/51`).flush([]);

    expect(ctx.component.getBookName(1)).toBe('Dune');
    expect(ctx.component.getBookName(99)).toBe('Livre #99');
  });

  it('un adhérent sans emprunt affiche une liste vide', () => {
    const ctx = setup(52);
    ctx.fixture.detectChanges();

    httpMock.expectOne(`${API}/admin/users/52`).flush({ userId: 52, name: 'Marie' } as Users);
    httpMock.expectOne(`${API}/admin/books`).flush([]);
    httpMock.expectOne(`${API}/borrow/user/52`).flush([]);

    expect(ctx.component.borrow).toEqual([]);
    expect(ctx.component.books).toEqual([]);
  });
});
