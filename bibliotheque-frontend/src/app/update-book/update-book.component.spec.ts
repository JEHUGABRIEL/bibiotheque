import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { UpdateBookComponent } from './update-book.component';
import { Books } from '../_model/books';
import { environment } from '../../environments/environment';

/**
 * Tests du formulaire « Modifier un livre » : chargement par l'identifiant de
 * la route, PUT /admin/books/{id} et retour à la liste.
 */
describe('UpdateBookComponent', () => {

  const CATALOG = `${environment.apiUrl}/admin/books`;

  let httpMock: HttpTestingController;

  function setup(bookId = 7) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [UpdateBookComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: { bookId } } } }
      ]
    });

    const fixture = TestBed.createComponent(UpdateBookComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    return { fixture, component, router };
  }

  const book = (): Books => ({
    bookId: 7, bookName: 'Dune', bookAuthor: 'F. Herbert',
    bookGenre: 'SF', noOfCopies: 2, imageUrl: ''
  } as Books);

  afterEach(() => httpMock.verify());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  it('charge le livre désigné par l\'URL', () => {
    const ctx = setup(7);
    ctx.fixture.detectChanges();

    expect(ctx.component.bookId).toBe(7);

    const req = httpMock.expectOne(`${CATALOG}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(book());

    expect(ctx.component.book.bookName).toBe('Dune');
    expect(ctx.component.book.noOfCopies).toBe(2);
  });

  it('enregistre les modifications puis revient à la liste', () => {
    const ctx = setup(7);
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${CATALOG}/7`).flush(book());

    ctx.component.book.noOfCopies = 9;
    ctx.component.onSubmit();

    const put = httpMock.expectOne(`${CATALOG}/7`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.noOfCopies).toBe(9);
    put.flush({ message: 'Livre modifié' });

    expect(ctx.router.navigate).toHaveBeenCalledWith(['/books']);
  });

  it('reste sur la page (sans redirection) si l\'enregistrement échoue', () => {
    const ctx = setup(7);
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${CATALOG}/7`).flush(book());

    ctx.component.onSubmit();
    httpMock.expectOne(`${CATALOG}/7`).flush(
      { message: 'Conflit' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(ctx.router.navigate).not.toHaveBeenCalled();
  });
});
