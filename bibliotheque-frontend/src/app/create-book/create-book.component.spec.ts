import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { CreateBookComponent } from './create-book.component';
import { Books } from '../_model/books';
import { environment } from '../../environments/environment';

/**
 * Tests du formulaire « Ajouter un livre » : validité des champs, POST
 * /admin/books, message d'erreur du backend et redirection vers la liste.
 */
describe('CreateBookComponent', () => {

  const CATALOG = `${environment.apiUrl}/admin/books`;

  let httpMock: HttpTestingController;

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [CreateBookComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule]
    });

    const fixture = TestBed.createComponent(CreateBookComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    return { fixture, component, router };
  }

  const validBook = (): Books => ({
    bookId: 0, bookName: 'Le Petit Prince', bookAuthor: 'Saint-Exupéry',
    bookGenre: 'Conte', noOfCopies: 5, imageUrl: ''
  } as Books);

  afterEach(() => httpMock.verify());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  describe('validation', () => {
    it('exige le titre, l\'auteur, le genre et un nombre d\'exemplaires >= 0', () => {
      const ctx = setup();
      expect(ctx.component.isFormValid).toBeFalse();

      ctx.component.book = validBook();
      expect(ctx.component.isFormValid).toBeTrue();

      ctx.component.book.bookAuthor = '   ';
      expect(ctx.component.isFormValid).toBeFalse();

      ctx.component.book = validBook();
      ctx.component.book.noOfCopies = undefined as any;
      expect(ctx.component.isFormValid).toBeFalse();

      ctx.component.book.noOfCopies = 0;      // 0 exemplaire est accepté (livre réservable)
      expect(ctx.component.isFormValid).toBeTrue();

      ctx.component.book.noOfCopies = -3;
      expect(ctx.component.isFormValid).toBeFalse();
    });

    it('onSubmit n\'envoie rien tant que le formulaire est invalide', () => {
      const ctx = setup();
      ctx.component.onSubmit();
      httpMock.expectNone(CATALOG);
      expect(ctx.component.loading).toBeFalse();
    });
  });

  describe('enregistrement', () => {
    it('poste le livre puis redirige vers la liste après le délai de confirmation', fakeAsync(() => {
      const ctx = setup();
      ctx.component.book = validBook();
      ctx.component.onSubmit();

      const post = httpMock.expectOne(CATALOG);
      expect(post.request.method).toBe('POST');
      expect(post.request.body.bookName).toBe('Le Petit Prince');
      post.flush({ bookId: 42 });

      expect(ctx.component.loading).toBeFalse();
      expect(ctx.component.successMessage).toContain('succès');
      expect(ctx.router.navigate).not.toHaveBeenCalled();

      tick(1500);                              // setTimeout(() => goToBooksList())
      expect(ctx.router.navigate).toHaveBeenCalledWith(['/books']);
    }));

    it('affiche le message du backend en cas de conflit', () => {
      const ctx = setup();
      ctx.component.book = validBook();
      ctx.component.onSubmit();

      httpMock.expectOne(CATALOG).flush(
        { message: 'Ce livre existe déjà' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(ctx.component.errorMessage).toBe('Ce livre existe déjà');
      expect(ctx.component.loading).toBeFalse();
      expect(ctx.router.navigate).not.toHaveBeenCalled();
    });

    it('affiche « Ce livre existe déjà. » si le backend ne renvoie pas de message', () => {
      const ctx = setup();
      ctx.component.book = validBook();
      ctx.component.onSubmit();

      httpMock.expectOne(CATALOG).flush({}, { status: 409, statusText: 'Conflict' });

      expect(ctx.component.errorMessage).toBe('Ce livre existe déjà.');
    });

    it('affiche un message générique pour toute autre erreur', () => {
      const ctx = setup();
      ctx.component.book = validBook();
      ctx.component.onSubmit();

      httpMock.expectOne(CATALOG).flush({}, { status: 500, statusText: 'Server Error' });

      expect(ctx.component.errorMessage).toContain('erreur');
    });
  });
});
