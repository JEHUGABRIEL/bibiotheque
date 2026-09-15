import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';

import { ReturnBookComponent } from '../return-book/return-book.component';
import { ModalComponent } from '../_shared/modal.component';
import { AuthInterceptor } from '../_auth/auth.interceptor';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { Books } from '../_model/books';
import { Users } from '../_model/users';
import { ToastService } from '../_service/toast.service';
import { environment } from '../../environments/environment';

/**
 * Test d'INTÉGRATION de la page « Rendre ».
 *
 * Chaîne réelle : composant + template + services (Borrow/Books/Users/UserAuth)
 * + AuthInterceptor, avec un backend HTTP simulé. On vérifie la règle centrale
 * de l'écran : le personnel enregistre directement le retour (PUT /borrow sur
 * TOUS les emprunts), l'adhérent ne fait qu'une demande (PUT /borrow/request sur
 * SES emprunts) — et jamais un membre n'appelle GET /borrow (staff-only, 403).
 */
describe('Intégration — page Rendre (return-book)', () => {

  const API = environment.apiUrl;

  const BOOKS = [
    { bookId: 1, bookName: 'Dune', bookAuthor: 'F. Herbert', bookGenre: 'SF', noOfCopies: 2, imageUrl: '' },
    { bookId: 2, bookName: '1984', bookAuthor: 'G. Orwell', bookGenre: 'SF', noOfCopies: 0, imageUrl: '' }
  ] as Books[];

  const USERS = [
    { userId: 51, username: 'jehu', name: 'Jehu Binga', password: '', role: [{ roleName: 'ADHERENT' }] },
    { userId: 1, username: 'staff', name: 'Staff Biblio', password: '', role: [{ roleName: 'BIBLIOTHECAIRE' }] }
  ] as Users[];

  // Dates au format de l'API (« dd-MM-yyyy ») : la liste ne les affiche pas,
  // seules les options de la modale passent issueDate au pipe `date`.
  const BORROWS = [
    { borrowId: 101, bookId: 1, userId: 51, statut: StatutBorrow.EN_ATTENTE, issueDate: '11-09-2026' },
    { borrowId: 102, bookId: 1, userId: 51, statut: StatutBorrow.VALIDEE, issueDate: '10-09-2026', dueDate: '17-09-2026' },
    { borrowId: 103, bookId: 2, userId: 99, statut: StatutBorrow.VALIDEE, issueDate: '08-09-2026', returnDate: '09-09-2026' },
    { borrowId: 104, bookId: 2, userId: 99, statut: StatutBorrow.RENDU, issueDate: '01-09-2026', returnDate: '05-09-2026' }
  ] as unknown as Borrow[];

  let httpMock: HttpTestingController;

  function setup(opts: { role?: 'Admin' | 'BIBLIOTHECAIRE' | 'ADHERENT'; userId?: number } = {}) {
    const role = opts.role ?? 'BIBLIOTHECAIRE';
    const userId = opts.userId ?? 1;

    localStorage.clear();
    localStorage.setItem('jwtToken', 'jwt-test');
    localStorage.setItem('roles', JSON.stringify([{ roleName: role }]));
    localStorage.setItem('userId', JSON.stringify(userId));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [ReturnBookComponent, ModalComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }]
    });

    const fixture: ComponentFixture<ReturnBookComponent> = TestBed.createComponent(ReturnBookComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate');
    spyOn(toast, 'success');
    spyOn(toast, 'error');
    spyOn(toast, 'info');

    return { fixture, component, toast, router };
  }

  /** Personnel : catalogue + tous les emprunts + annuaire. */
  function loadStaff(ctx: ReturnType<typeof setup>, borrows: Borrow[] = BORROWS) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
    const all = httpMock.expectOne(`${API}/borrow`);
    expect(all.request.headers.get('Authorization')).toBe('Bearer jwt-test');
    all.flush(borrows);
    httpMock.expectOne(`${API}/admin/users`).flush(USERS);
    ctx.fixture.detectChanges();
  }

  /** Adhérent : catalogue + ses emprunts uniquement. */
  function loadMember(ctx: ReturnType<typeof setup>, own: Borrow[] = BORROWS) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
    httpMock.expectOne(`${API}/borrow/user/${ctx.component.userId}`).flush(own);
    ctx.fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ==================== Chargement ====================

  describe('chargement de la liste', () => {
    it('le personnel voit TOUS les emprunts validés non rendus, avec le nom des adhérents', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      // Seuls les VALIDEE sans date de retour sont rendables
      expect(ctx.component.borrow.map((b: Borrow) => b.borrowId)).toEqual([102]);
      expect(ctx.component.getUserName(51)).toBe('Jehu Binga');
      expect(ctx.component.getBookName(1)).toBe('Dune');

      const rows = ctx.fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Jehu Binga');
      expect(rows[0].textContent).toContain('Dune');
    });

    it('un adhérent ne charge que ses propres emprunts et n\'appelle pas les endpoints du personnel', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMember(ctx);

      httpMock.expectNone(`${API}/borrow`);
      httpMock.expectNone(`${API}/admin/users`);
      expect(ctx.component.isStaff).toBeFalse();
      expect(ctx.component.borrow.map((b: Borrow) => b.borrowId)).toEqual([102]);
      // La colonne « Adhérent » est réservée au personnel (6 colonnes pour un adhérent)
      expect(ctx.fixture.nativeElement.querySelectorAll('thead th').length).toBe(6);
    });

    it('un bibliothécaire voit la colonne « Adhérent » (rôle personnel, pas seulement Admin)', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      // 7 colonnes dès qu'on est du personnel (Admin ou Bibliothécaire)
      expect(ctx.fixture.nativeElement.querySelectorAll('thead th').length).toBe(7);
      expect(ctx.component.getBookName(999)).toBe('Livre #999');
    });
  });

  // ==================== Formulaire « Nouveau retour » ====================

  describe('modale « Nouveau retour »', () => {
    it('le personnel choisit d\'abord l\'adhérent : ses emprunts rendables sont chargés à la demande', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      ctx.component.openReturnModal();
      // Le formulaire recharge l'annuaire à l'ouverture
      httpMock.expectOne(`${API}/admin/users`).flush(USERS);
      ctx.fixture.detectChanges();

      expect(ctx.component.showReturnModal).toBeTrue();
      expect(ctx.component.isReturnFormValid).toBeFalse();

      ctx.component.selectedUserId = 51;
      ctx.component.onStaffUserChange();

      expect(ctx.component.loadingBorrows).toBeTrue();
      const memberBorrows = httpMock.expectOne(`${API}/borrow/user/51`);
      expect(memberBorrows.request.method).toBe('GET');
      memberBorrows.flush(BORROWS);

      // Filtrage : un seul emprunt est réellement rendable
      expect(ctx.component.modalBorrows.map((b: Borrow) => b.borrowId)).toEqual([102]);
      expect(ctx.component.loadingBorrows).toBeFalse();
      expect(ctx.component.selectedBorrowId).toBeNull();

      ctx.component.selectedBorrowId = 102;
      expect(ctx.component.isReturnFormValid).toBeTrue();
    });

    it('changer d\'adhérent réinitialise l\'emprunt sélectionné', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);
      ctx.component.openReturnModal();
      httpMock.expectOne(`${API}/admin/users`).flush(USERS);

      ctx.component.selectedUserId = 51;
      ctx.component.selectedBorrowId = 102;
      ctx.component.onStaffUserChange();
      httpMock.expectOne(`${API}/borrow/user/51`).flush(BORROWS);

      expect(ctx.component.selectedBorrowId).toBeNull();
    });

    it('un adhérent retrouve ses propres emprunts dans la modale, sans choisir d\'adhérent', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMember(ctx);

      ctx.component.openReturnModal();

      expect(ctx.component.modalBorrows.map((b: Borrow) => b.borrowId)).toEqual([102]);
      expect(ctx.component.isReturnFormValid).toBeFalse();   // aucun emprunt choisi

      ctx.component.selectedBorrowId = 102;
      expect(ctx.component.isReturnFormValid).toBeTrue();
      // Pas de requête réseau supplémentaire : la liste est déjà en mémoire
      httpMock.expectNone(`${API}/admin/users`);
    });

    it('le personnel enregistre le retour (PUT /borrow) puis rafraîchit la liste', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);
      ctx.component.openReturnModal();
      httpMock.expectOne(`${API}/admin/users`).flush(USERS);
      ctx.component.selectedUserId = 51;
      ctx.component.onStaffUserChange();
      httpMock.expectOne(`${API}/borrow/user/51`).flush(BORROWS);

      ctx.component.selectedBorrowId = 102;
      ctx.component.submitReturn();

      const put = httpMock.expectOne(`${API}/borrow`);
      expect(put.request.method).toBe('PUT');
      expect({ ...put.request.body }).toEqual({ borrowId: 102 });
      put.flush({ message: 'Retour enregistré' });

      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);
      expect(ctx.toast.success).toHaveBeenCalledWith('Retour enregistré');
      expect(ctx.component.showReturnModal).toBeFalse();
      expect(ctx.component.formSubmitting).toBeFalse();
    });

    it('un adhérent déclare une demande de retour (PUT /borrow/request)', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMember(ctx);

      ctx.component.openReturnModal();
      ctx.component.selectedBorrowId = 102;
      ctx.component.submitReturn();

      const put = httpMock.expectOne(`${API}/borrow/request`);
      expect(put.request.method).toBe('PUT');
      expect({ ...put.request.body }).toEqual({ borrowId: 102 });
      put.flush({ message: 'Demande de retour transmise' });

      httpMock.expectOne(`${API}/borrow/user/51`).flush(BORROWS);
      expect(ctx.toast.success).toHaveBeenCalled();
    });

    it('un retour refusé (409) affiche le message du backend et garde la modale ouverte', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);
      ctx.component.openReturnModal();
      httpMock.expectOne(`${API}/admin/users`).flush(USERS);
      ctx.component.selectedUserId = 51;
      ctx.component.onStaffUserChange();
      httpMock.expectOne(`${API}/borrow/user/51`).flush(BORROWS);

      ctx.component.selectedBorrowId = 102;
      ctx.component.submitReturn();

      httpMock.expectOne(`${API}/borrow`).flush(
        { message: 'Cet emprunt a déjà été rendu' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(ctx.component.formError).toBe('Cet emprunt a déjà été rendu');
      expect(ctx.component.showReturnModal).toBeTrue();
      expect(ctx.toast.success).not.toHaveBeenCalled();
    });
  });

  // ==================== Action directe dans le tableau ====================

  describe('bouton « Rendre » d\'une ligne', () => {
    it('le personnel enregistre le retour et recharge emprunts + catalogue', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      ctx.component.returnBook(102);

      const put = httpMock.expectOne(`${API}/borrow`);
      expect(put.request.method).toBe('PUT');
      expect({ ...put.request.body }).toEqual({ borrowId: 102 });
      put.flush({ message: 'Retour effectué' });

      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);

      expect(ctx.toast.success).toHaveBeenCalledWith('Retour effectué');
      expect(ctx.component.returningBorrowId).toBeNull();
    });

    it('un adhérent envoie une demande et reçoit un message informatif', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMember(ctx);

      ctx.component.returnBook(102);

      const put = httpMock.expectOne(`${API}/borrow/request`);
      expect({ ...put.request.body }).toEqual({ borrowId: 102 });
      put.flush({ message: 'Demande transmise' });

      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      httpMock.expectOne(`${API}/borrow/user/51`).flush(BORROWS);

      expect(ctx.toast.info).toHaveBeenCalledWith('Demande transmise');
      expect(ctx.toast.success).not.toHaveBeenCalled();
    });

    it('un échec laisse l\'emprunt rendable et affiche l\'erreur', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMember(ctx);

      ctx.component.returnBook(102);
      httpMock.expectOne(`${API}/borrow/request`).flush(
        { message: 'Cet emprunt ne vous appartient pas' },
        { status: 403, statusText: 'Forbidden' }
      );

      expect(ctx.toast.error).toHaveBeenCalledWith('Cet emprunt ne vous appartient pas');
      expect(ctx.component.returningBorrowId).toBeNull();
    });
  });
});
