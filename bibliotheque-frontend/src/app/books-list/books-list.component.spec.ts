import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { BooksListComponent } from './books-list.component';
import { ModalComponent } from '../_shared/modal.component';
import { ConfirmModalComponent } from '../_shared/confirm-modal.component';
import { Books } from '../_model/books';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { ToastService } from '../_service/toast.service';
import { environment } from '../../environments/environment';

/**
 * Tests de la page Livres : chargement, pagination, création, édition,
 * suppression renforcée (nom exact + avertissement si le livre est emprunté),
 * modale de détail et navigation vers emprunt / réservation.
 */
describe('BooksListComponent', () => {

  const API = environment.apiUrl;
  const CATALOG = `${API}/admin/books`;

  const makeBook = (id: number, name: string, copies = 1, author = 'A. Auteur'): Books =>
    ({ bookId: id, bookName: name, bookAuthor: author, bookGenre: 'Roman', noOfCopies: copies, imageUrl: '' } as Books);

  let httpMock: HttpTestingController;

  function setup(role: 'Admin' | 'BIBLIOTHECAIRE' | 'ADHERENT' = 'BIBLIOTHECAIRE') {
    localStorage.clear();
    localStorage.setItem('jwtToken', 'jwt-test');
    localStorage.setItem('roles', JSON.stringify([{ roleName: role }]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [BooksListComponent, ModalComponent, ConfirmModalComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule]
    });

    const fixture = TestBed.createComponent(BooksListComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const toast = TestBed.inject(ToastService);

    spyOn(router, 'navigate');
    spyOn(toast, 'success');
    spyOn(toast, 'error');

    return { fixture, component, router, toast };
  }

  function loadCatalog(ctx: ReturnType<typeof setup>, books: Books[] = [makeBook(1, 'Dune'), makeBook(2, '1984', 0)]) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(CATALOG).flush(books);
    ctx.fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  // ---------- Chargement et pagination ----------

  describe('liste', () => {
    it('charge le catalogue au démarrage et l\'affiche', () => {
      const ctx = setup();
      loadCatalog(ctx);

      expect(ctx.component.books.length).toBe(2);
      expect(ctx.component.loading).toBeFalse();
      expect(ctx.fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
      expect(ctx.fixture.nativeElement.textContent).toContain('Dune');
    });

    it('pagine par 10 et affiche « x–y sur n »', () => {
      const ctx = setup();
      loadCatalog(ctx, Array.from({ length: 12 }, (_, i) => makeBook(i + 1, 'Livre ' + (i + 1))));

      expect(ctx.component.totalPages).toBe(2);
      expect(ctx.component.paginatedBooks.length).toBe(10);
      expect(ctx.component.pageNumbers).toEqual([1, 2]);
      expect(ctx.component.resultsInfo).toBe('1–10 sur 12');

      ctx.component.goToPage(2);
      expect(ctx.component.paginatedBooks.length).toBe(2);
      expect(ctx.component.resultsInfo).toBe('11–12 sur 12');

      ctx.component.goToPage(5);           // page inexistante ignorée
      expect(ctx.component.currentPage).toBe(2);
    });

    it('isStaff couvre les deux modèles de rôles du personnel', () => {
      const ctx = setup('BIBLIOTHECAIRE');
      loadCatalog(ctx);
      expect(ctx.component.isStaff).toBeTrue();
      expect(ctx.fixture.nativeElement.textContent).not.toBe('');
    });
  });

  // ---------- Création ----------

  describe('création', () => {
    it('un formulaire incomplet n\'est pas valide et n\'envoie rien', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.openCreateModal();
      expect(ctx.component.isCreateValid).toBeFalse();

      ctx.component.newBook = makeBook(0, 'Nouveau');
      ctx.component.newBook.noOfCopies = undefined as any;
      expect(ctx.component.isCreateValid).toBeFalse();

      ctx.component.newBook.noOfCopies = -1;
      expect(ctx.component.isCreateValid).toBeFalse();

      ctx.component.newBook.noOfCopies = 0;
      expect(ctx.component.isCreateValid).toBeTrue();
    });

    it('submitCreate poste le livre puis recharge la liste', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.openCreateModal();
      ctx.component.newBook = makeBook(0, 'Le Petit Prince', 3);

      ctx.component.submitCreate();

      const post = httpMock.expectOne(CATALOG);
      expect(post.request.method).toBe('POST');
      expect(post.request.body.bookName).toBe('Le Petit Prince');
      post.flush({ bookId: 42 });

      httpMock.expectOne(CATALOG).flush([makeBook(1, 'Dune'), makeBook(42, 'Le Petit Prince', 3)]);

      expect(ctx.toast.success).toHaveBeenCalledWith('Livre ajouté avec succès');
      expect(ctx.component.showCreateModal).toBeFalse();
      expect(ctx.component.createLoading).toBeFalse();
    });

    it('un 409 affiche le message du backend et garde la modale ouverte', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.openCreateModal();
      ctx.component.newBook = makeBook(0, 'Dune', 3);
      ctx.component.submitCreate();

      httpMock.expectOne(CATALOG).flush(
        { message: 'Ce livre existe déjà' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(ctx.toast.error).toHaveBeenCalledWith('Ce livre existe déjà');
      expect(ctx.component.showCreateModal).toBeTrue();
    });
  });

  // ---------- Édition ----------

  describe('édition', () => {
    it('openEditModal copie le livre (sans le lier) et pré-remplit l\'id', () => {
      const ctx = setup();
      const book = makeBook(7, 'Dune', 2);
      loadCatalog(ctx, [book]);

      ctx.component.openEditModal(book);

      expect(ctx.component.showEditModal).toBeTrue();
      expect(ctx.component.editBookId).toBe(7);
      expect(ctx.component.editBook.bookName).toBe('Dune');
      // Copie : modifier le formulaire ne touche pas la ligne du tableau
      ctx.component.editBook.bookName = 'Dune — 2e édition';
      expect(book.bookName).toBe('Dune');
    });

    it('submitEdit envoie un PUT sur l\'id édité et recharge la liste', () => {
      const ctx = setup();
      const book = makeBook(7, 'Dune', 2);
      loadCatalog(ctx, [book]);

      ctx.component.openEditModal(book);
      ctx.component.editBook.noOfCopies = 5;
      ctx.component.submitEdit();

      const put = httpMock.expectOne(`${CATALOG}/7`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.noOfCopies).toBe(5);
      put.flush({ message: 'Livre modifié' });

      httpMock.expectOne(CATALOG).flush([book]);
      expect(ctx.toast.success).toHaveBeenCalledWith('Livre modifié avec succès');
      expect(ctx.component.showEditModal).toBeFalse();
    });
  });

  // ---------- Suppression ----------

  describe('suppression', () => {
    const activeBorrows = [
      { borrowId: 1, bookId: 7, userId: 51, statut: StatutBorrow.VALIDEE, returnDate: null },
      { borrowId: 2, bookId: 7, userId: 52, statut: StatutBorrow.RENDU, returnDate: '05-09-2026' }
    ] as unknown as Borrow[];

    it('openDeleteConfirm vérifie les emprunts en cours du livre', () => {
      const ctx = setup();
      const book = makeBook(7, 'Dune');
      loadCatalog(ctx, [book]);

      ctx.component.openDeleteConfirm(book);

      const req = httpMock.expectOne(`${API}/borrow/book/7`);
      expect(req.request.method).toBe('GET');
      req.flush(activeBorrows);
      ctx.fixture.detectChanges();

      expect(ctx.component.showDeleteConfirm).toBeTrue();
      // Seuls les emprunts non rendus comptent
      expect(ctx.component.deleteBookBorrows.length).toBe(1);
      expect(ctx.component.deleteMessage).toContain('actuellement emprunté');
    });

    it('la suppression exige le nom exact du livre', () => {
      const ctx = setup();
      const book = makeBook(7, 'Dune');
      loadCatalog(ctx, [book]);

      ctx.component.openDeleteConfirm(book);
      httpMock.expectOne(`${API}/borrow/book/7`).flush([]);

      expect(ctx.component.isDeleteInputValid).toBeFalse();
      ctx.component.deleteInputValue = 'dune';       // casse différente refusée
      expect(ctx.component.isDeleteInputValid).toBeFalse();
      ctx.component.deleteInputValue = 'Dune';
      expect(ctx.component.isDeleteInputValid).toBeTrue();
      // Le message ne mentionne plus d'emprunt en cours
      expect(ctx.component.deleteMessage).not.toContain('actuellement emprunté');
    });

    it('confirmDelete appelle DELETE puis recharge la liste', () => {
      const ctx = setup();
      const book = makeBook(7, 'Dune');
      loadCatalog(ctx, [book]);

      ctx.component.openDeleteConfirm(book);
      httpMock.expectOne(`${API}/borrow/book/7`).flush([]);
      ctx.component.deleteInputValue = 'Dune';
      ctx.component.confirmDelete();

      const del = httpMock.expectOne(`${CATALOG}/7`);
      expect(del.request.method).toBe('DELETE');
      del.flush({ message: 'ok' });

      httpMock.expectOne(CATALOG).flush([]);
      expect(ctx.toast.success).toHaveBeenCalledWith('Livre « Dune » supprimé avec succès');
      expect(ctx.component.showDeleteConfirm).toBeFalse();
      expect(ctx.component.bookToDelete).toBeNull();
    });

    it('un conflit backend (409) affiche l\'erreur et rafraîchit quand même', () => {
      const ctx = setup();
      const book = makeBook(7, 'Dune');
      loadCatalog(ctx, [book]);

      ctx.component.openDeleteConfirm(book);
      httpMock.expectOne(`${API}/borrow/book/7`).flush([]);
      ctx.component.deleteInputValue = 'Dune';
      ctx.component.confirmDelete();

      httpMock.expectOne(`${CATALOG}/7`).flush(
        { message: 'Livre encore emprunté' },
        { status: 409, statusText: 'Conflict' }
      );
      httpMock.expectOne(CATALOG).flush([book]);

      expect(ctx.toast.error).toHaveBeenCalledWith('Livre encore emprunté');
    });

    it('cancelDelete réinitialise l\'état de confirmation', () => {
      const ctx = setup();
      const book = makeBook(7, 'Dune');
      loadCatalog(ctx, [book]);

      ctx.component.openDeleteConfirm(book);
      httpMock.expectOne(`${API}/borrow/book/7`).flush([]);
      ctx.component.deleteInputValue = 'Du';
      ctx.component.cancelDelete();

      expect(ctx.component.showDeleteConfirm).toBeFalse();
      expect(ctx.component.deleteInputValue).toBe('');
      expect(ctx.component.deleteBookBorrows).toEqual([]);
    });
  });

  // ---------- Modale de détail ----------

  describe('modale de détail', () => {
    it('bookDetails charge le livre et gère l\'erreur', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.bookDetails(3);
      expect(ctx.component.showDetailModal).toBeTrue();
      expect(ctx.component.detailLoading).toBeTrue();

      httpMock.expectOne(`${CATALOG}/3`).flush(makeBook(3, 'Du côté de chez Swann', 0));
      expect(ctx.component.detailBook.bookName).toBe('Du côté de chez Swann');
      expect(ctx.component.detailLoading).toBeFalse();

      ctx.component.bookDetails(404);
      httpMock.expectOne(`${CATALOG}/404`).flush(
        { message: 'Livre introuvable' },
        { status: 404, statusText: 'Not Found' }
      );
      expect(ctx.component.detailError).toBe('Livre introuvable');
      expect(ctx.component.detailLoading).toBeFalse();
    });

    it('editFromDetail ferme le détail et ouvre l\'édition', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.detailBook = makeBook(1, 'Dune', 0);
      ctx.component.showDetailModal = true;
      ctx.component.editFromDetail();

      expect(ctx.component.showDetailModal).toBeFalse();
      expect(ctx.component.showEditModal).toBeTrue();
      expect(ctx.component.editBookId).toBe(1);
    });

    it('ne fait rien si aucun livre en détail', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.showDetailModal = true;
      expect(() => ctx.component.editFromDetail()).not.toThrow();
      expect(ctx.component.showEditModal).toBeFalse();
    });

    it('depuis le détail, un livre indisponible part vers la réservation (RG-01)', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.detailBook = makeBook(2, '1984', 0);
      ctx.component.reserveFromDetail();

      expect(ctx.router.navigate).toHaveBeenCalledWith(['/reservations'], { queryParams: { reserve: 2 } });
    });

    it('depuis le détail, un livre disponible part vers l\'emprunt pré-rempli', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.detailBook = makeBook(1, 'Dune', 3);
      ctx.component.borrowFromDetail();

      expect(ctx.router.navigate).toHaveBeenCalledWith(['/borrow-book'], { queryParams: { book: 1 } });
    });

    it('updateBook et reserveFromDetail ne naviguent pas sans livre sélectionné', () => {
      const ctx = setup();
      loadCatalog(ctx);

      ctx.component.detailBook = null;
      ctx.component.reserveFromDetail();
      ctx.component.borrowFromDetail();
      expect(ctx.router.navigate).not.toHaveBeenCalled();

      ctx.component.updateBook(9);
      expect(ctx.router.navigate).toHaveBeenCalledWith(['update-book', 9]);
    });
  });
});
