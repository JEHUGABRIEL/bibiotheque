import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { BorrowBookComponent } from '../borrow-book/borrow-book.component';
import { ModalComponent } from '../_shared/modal.component';
import { ConfirmModalComponent } from '../_shared/confirm-modal.component';
import { AuthInterceptor } from '../_auth/auth.interceptor';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { Books } from '../_model/books';
import { Users } from '../_model/users';
import { ToastService } from '../_service/toast.service';
import { environment } from '../../environments/environment';

/**
 * Test d'INTÉGRATION de la page « Emprunter ».
 *
 * Contrairement à un test unitaire de composant (où tous les services sont des
 * doublures), on câble ici la vraie chaîne : composant réel + template réel +
 * services réels (Borrow/Books/Users/UserAuth/Toast) + AuthInterceptor réel +
 * HttpClient simulé. On observe donc simultanément l'écran (DOM), les appels
 * HTTP sortants (URL, verbe, corps, en-tête Bearer) et les rafraîchissements
 * déclenchés après chaque action. Aucun backend, aucune base de données.
 */
describe('Intégration — page Emprunter (borrow-book)', () => {

  const API = environment.apiUrl;

  const BOOKS = [
    { bookId: 1, bookName: 'Dune', bookAuthor: 'F. Herbert', bookGenre: 'SF', noOfCopies: 2, imageUrl: '' },
    { bookId: 2, bookName: '1984', bookAuthor: 'G. Orwell', bookGenre: 'SF', noOfCopies: 0, imageUrl: '' },
    { bookId: 3, bookName: 'Du côté de chez Swann', bookAuthor: 'M. Proust', bookGenre: 'Roman', noOfCopies: 5, imageUrl: '' }
  ] as Books[];

  const USERS = [
    { userId: 51, username: 'jehu', name: 'Jehu Binga', password: '', role: [{ roleName: 'ADHERENT' }] },
    { userId: 1, username: 'staff', name: 'Staff Biblio', password: '', role: [{ roleName: 'BIBLIOTHECAIRE' }] }
  ] as Users[];

  // Dates au format de l'API (« dd-MM-yyyy », cf. JsonDataSerializer côté backend) :
  // elles doivent s'afficher en JJ/MM/AAAA dans le tableau et les modales.
  const BORROWS = [
    { borrowId: 101, bookId: 1, userId: 51, statut: StatutBorrow.EN_ATTENTE, issueDate: '11-09-2026' },
    { borrowId: 102, bookId: 2, userId: 51, statut: StatutBorrow.VALIDEE, issueDate: '10-09-2026', dueDate: '17-09-2026' },
    { borrowId: 103, bookId: 3, userId: 51, statut: StatutBorrow.RENDU, issueDate: '01-09-2026', returnDate: '05-09-2026' }
  ] as unknown as Borrow[];

  let httpMock: HttpTestingController;

  type SetupOptions = {
    role?: 'Admin' | 'BIBLIOTHECAIRE' | 'ADHERENT';
    userId?: number;
    queryParams?: Record<string, string>;
  };

  /** Monte la page complète avec une identité donnée (localStorage + intercepteur réel). */
  function setup(opts: SetupOptions = {}) {
    const role = opts.role ?? 'Admin';
    const userId = opts.userId ?? 1;
    const params = convertToParamMap(opts.queryParams ?? {});

    localStorage.clear();
    localStorage.setItem('jwtToken', 'jwt-test');
    localStorage.setItem('roles', JSON.stringify([{ roleName: role }]));
    localStorage.setItem('userId', JSON.stringify(userId));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [BorrowBookComponent, ModalComponent, ConfirmModalComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(params),
            snapshot: { queryParamMap: params }
          }
        }
      ]
    });

    const fixture: ComponentFixture<BorrowBookComponent> = TestBed.createComponent(BorrowBookComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate');
    spyOn(toast, 'success');
    spyOn(toast, 'error');
    spyOn(toast, 'info');
    spyOn(toast, 'warning');

    return { fixture, component, toast, router };
  }

  /** Charge initialement le catalogue, les adhérents puis les emprunts (parcours du personnel). */
  function loadStaffPage(ctx: ReturnType<typeof setup>, borrows: Borrow[] = BORROWS) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
    httpMock.expectOne(`${API}/admin/users`).flush(USERS);
    httpMock.expectOne(`${API}/borrow`).flush(borrows);
    ctx.fixture.detectChanges();
  }

  /** Charge initialement le catalogue et le quota (parcours de l'adhérent). */
  function loadMemberPage(ctx: ReturnType<typeof setup>, own: Borrow[] = BORROWS) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
    httpMock.expectOne(`${API}/borrow/my/quota`).flush({ activeCount: 1, maxQuota: 3, remaining: 2 });
    httpMock.expectOne(`${API}/borrow/user/${ctx.component.userId}`).flush(own);
    ctx.fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ==================== Côté personnel ====================

  describe('personnel (Admin)', () => {
    it('charge le catalogue, les adhérents puis TOUS les emprunts, et les affiche dans un tableau unique', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });

      ctx.fixture.detectChanges();
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);

      const usersReq = httpMock.expectOne(`${API}/admin/users`);
      expect(usersReq.request.headers.get('Authorization')).toBe('Bearer jwt-test');
      usersReq.flush(USERS);

      const borrowsReq = httpMock.expectOne(`${API}/borrow`);
      expect(borrowsReq.request.method).toBe('GET');
      borrowsReq.flush(BORROWS);
      ctx.fixture.detectChanges();

      expect(ctx.component.allBorrows.length).toBe(3);
      // Seuls les adhérents sont proposés dans la liste déroulante
      expect(ctx.component.users.map((u: Users) => u.userId)).toEqual([51]);
      // Les noms sont résolus pour l'affichage
      expect(ctx.component.getUserName(51)).toBe('Jehu Binga');
      expect(ctx.component.getBookNameFor(1)).toBe('Dune');

      // Les demandes EN_ATTENTE sont dans le MÊME tableau que les emprunts validés
      const rows = ctx.fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3);
      expect(ctx.fixture.nativeElement.textContent).toContain('Demande');
      expect(ctx.fixture.nativeElement.textContent).toContain('Validée');

      // Les dates "dd-MM-yyyy" de l'API s'affichent en JJ/MM/AAAA
      expect(rows[1].textContent).toContain('17/09/2026');
      expect(rows[2].textContent).toContain('05/09/2026');
    });

    it('le tableau et le filtre par statut sont aussi accessibles à un bibliothécaire', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaffPage(ctx);

      expect(ctx.component.isStaff).toBeTrue();
      expect(ctx.fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
      expect(ctx.fixture.nativeElement.querySelector('select.statut-filter')).toBeTruthy();
    });

    it('dédoublonne les emprunts reçus en double (défense contre les doublons en base)', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      ctx.fixture.detectChanges();
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      httpMock.expectOne(`${API}/admin/users`).flush(USERS);
      httpMock.expectOne(`${API}/borrow`).flush([...BORROWS, BORROWS[0]]);
      ctx.fixture.detectChanges();

      expect(ctx.component.allBorrows.length).toBe(3);
    });

    it('le filtre par statut restreint le tableau et repart de la première page', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);
      ctx.component.borrowPage = 2;

      ctx.component.statutFilter = StatutBorrow.EN_ATTENTE;
      ctx.component.onStatutFilterChange();
      ctx.fixture.detectChanges();

      expect(ctx.component.borrowPage).toBe(1);
      expect(ctx.component.filteredBorrows.map((b: Borrow) => b.borrowId)).toEqual([101]);
      expect(ctx.fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);

      ctx.component.statutFilter = null;
      ctx.component.onStatutFilterChange();
      ctx.fixture.detectChanges();
      expect(ctx.component.filteredBorrows.length).toBe(3);
    });

    it('pagine les emprunts (10 par page)', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      const many = Array.from({ length: 12 }, (_, i) => ({
        borrowId: 200 + i, bookId: 1, userId: 51, statut: StatutBorrow.RENDU
      })) as Borrow[];

      loadStaffPage(ctx, many);

      expect(ctx.component.borrowTotalPages).toBe(2);
      expect(ctx.component.paginatedBorrows.length).toBe(10);
      expect(ctx.component.borrowPageNumbers).toEqual([1, 2]);

      ctx.component.goToBorrowPage(2);
      expect(ctx.component.paginatedBorrows.length).toBe(2);
      // page invalide ignorée
      ctx.component.goToBorrowPage(9);
      expect(ctx.component.borrowPage).toBe(2);
    });

    it('valider une demande envoie PATCH /borrow/{id}/confirmer puis rafraîchit la liste', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);

      const pending = ctx.component.allBorrows.find((b: Borrow) => b.statut === StatutBorrow.EN_ATTENTE)!;
      ctx.component.openValidateConfirm(pending);
      ctx.fixture.detectChanges();

      expect(ctx.component.showConfirmModal).toBeTrue();
      expect(ctx.component.confirmTitle).toBe("Valider l'emprunt");
      expect(ctx.component.confirmMessage).toContain('Dune');
      expect(ctx.component.confirmMessage).toContain('Jehu Binga');

      ctx.component.onConfirmModalConfirm();

      const patch = httpMock.expectOne(`${API}/borrow/101/confirmer`);
      expect(patch.request.method).toBe('PATCH');
      patch.flush({ message: 'Emprunt confirmé', borrow: { borrowId: 101, dueDate: '22-09-2026' } });

      // Après validation : la liste et le catalogue sont rechargés
      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);

      expect(ctx.toast.success).toHaveBeenCalled();
      expect(ctx.component.showConfirmModal).toBeFalse();
    });

    it('refuser un emprunt VALIDEE annonce la remise en rayon et appelle PATCH /refuser', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);

      const validated = ctx.component.allBorrows.find((b: Borrow) => b.statut === StatutBorrow.VALIDEE)!;
      ctx.component.openRefuseConfirm(validated);

      expect(ctx.component.confirmDanger).toBeTrue();
      expect(ctx.component.confirmLabel).toBe('Refuser');
      expect(ctx.component.confirmMessage).toContain('remis en rayon');

      ctx.component.onConfirmModalConfirm();
      const patch = httpMock.expectOne(`${API}/borrow/102/refuser`);
      expect(patch.request.method).toBe('PATCH');
      patch.flush({ message: 'Emprunt refusé' });

      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      expect(ctx.toast.success).toHaveBeenCalled();
    });

    it('retourner un emprunt VALIDEE envoie PUT /borrow avec le seul borrowId', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);

      const validated = ctx.component.allBorrows.find((b: Borrow) => b.statut === StatutBorrow.VALIDEE)!;
      ctx.component.openReturnConfirm(validated);
      ctx.component.onConfirmModalConfirm();

      const put = httpMock.expectOne(`${API}/borrow`);
      expect(put.request.method).toBe('PUT');
      expect({ ...put.request.body }).toEqual({ borrowId: 102 });
      put.flush({ message: 'Retour enregistré' });

      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      expect(ctx.toast.success).toHaveBeenCalled();
    });

    it('supprimer un emprunt rendu : confirmation simple, sans saisie du nom', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);

      const rendered = ctx.component.allBorrows.find((b: Borrow) => b.statut === StatutBorrow.RENDU)!;
      ctx.component.openDeleteConfirmFromTable(rendered);
      ctx.fixture.detectChanges();

      expect(ctx.component.showSimpleDeleteConfirm).toBeTrue();
      expect(ctx.component.showDeleteConfirm).toBeFalse();

      ctx.component.confirmSimpleDeleteBorrow();

      const del = httpMock.expectOne(`${API}/borrow/103`);
      expect(del.request.method).toBe('DELETE');
      del.flush({ message: 'Emprunt supprimé' });

      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);
      expect(ctx.component.showSimpleDeleteConfirm).toBeFalse();
      expect(ctx.component.borrowToDelete).toBeNull();
    });

    it('supprimer un emprunt en cours exige la confirmation renforcée (nom exact du livre)', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);

      const active = ctx.component.allBorrows.find(
        (b: Borrow) => b.statut === StatutBorrow.VALIDEE && !b.returnDate
      )!;

      // 1) confirmation générique
      ctx.component.openDeleteConfirmFromTable(active);
      expect(ctx.component.showConfirmModal).toBeTrue();
      ctx.component.onConfirmModalConfirm();

      // 2) saisie du nom exact
      expect(ctx.component.showDeleteConfirm).toBeTrue();
      expect(ctx.component.isDeleteInputValid).toBeFalse();

      ctx.component.deleteBookName = 'mauvais nom';
      expect(ctx.component.isDeleteInputValid).toBeFalse();

      ctx.component.deleteBookName = '1984';
      expect(ctx.component.isDeleteInputValid).toBeTrue();

      ctx.component.confirmDeleteBorrow();
      const del = httpMock.expectOne(`${API}/borrow/102`);
      expect(del.request.method).toBe('DELETE');
      del.flush({ message: 'ok' });

      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);
    });

    it('un 409 à la validation affiche un toast d\'erreur et laisse la modale fermée', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);

      const pending = ctx.component.allBorrows.find((b: Borrow) => b.statut === StatutBorrow.EN_ATTENTE)!;
      ctx.component.openValidateConfirm(pending);
      ctx.component.onConfirmModalConfirm();

      httpMock.expectOne(`${API}/borrow/101/confirmer`).flush(
        { message: 'Exemplaires épuisés' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(ctx.toast.error).toHaveBeenCalledWith('Exemplaires épuisés');
      expect(ctx.component.confirmLoading).toBeFalse();
    });

    it('le personnel emprunte pour un adhérent : l\'adhérent est obligatoire et l\'userId part dans le corps', () => {
      const ctx = setup({ role: 'Admin', userId: 1 });
      loadStaffPage(ctx);

      ctx.component.openBorrowModal();
      ctx.component.selectAdherentBook(BOOKS[0]);

      // Sans adhérent sélectionné, le formulaire est refusé
      expect(ctx.component.isBorrowFormValid).toBeFalse();

      ctx.component.modalSelectedUserId = 51;
      expect(ctx.component.isBorrowFormValid).toBeTrue();

      ctx.component.submitBorrow();
      const post = httpMock.expectOne(`${API}/borrow`);
      expect(post.request.method).toBe('POST');
      expect({ ...post.request.body }).toEqual({ bookId: 1, userId: 51 });
      post.flush({ message: 'Emprunt effectué' });

      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      expect(ctx.toast.success).toHaveBeenCalled();
      expect(ctx.component.showBorrowModal).toBeFalse();
    });
  });

  // ==================== Côté adhérent ====================

  describe('adhérent', () => {
    it('charge son quota et ses propres emprunts, sans appeler les endpoints du personnel', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMemberPage(ctx);

      expect(ctx.component.isStaff).toBeFalse();
      expect(ctx.component.activeBorrowCount).toBe(1);
      expect(ctx.component.remainingQuota).toBe(2);
      expect(ctx.component.quotaReached).toBeFalse();
      // Les livres déjà demandés/validés bloquent un nouvel emprunt
      expect(ctx.component.isBookAlreadyBorrowed(1)).toBeTrue();
      expect(ctx.component.isBookAlreadyBorrowed(2)).toBeTrue();
      expect(ctx.component.isBookAlreadyBorrowed(3)).toBeFalse();
      // Le bandeau de quota est visible pour l'adhérent
      expect(ctx.fixture.nativeElement.querySelector('.quota-banner')).toBeTruthy();
    });

    it('une demande d\'emprunt part sans userId (RS-04 : identité lue dans le token)', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMemberPage(ctx);

      ctx.component.openBorrowModal();
      ctx.component.selectAdherentBook(BOOKS[2]);      // livre disponible (5 exemplaires)
      ctx.fixture.detectChanges();
      expect(ctx.component.isBorrowFormValid).toBeTrue();

      ctx.component.submitBorrow();

      const post = httpMock.expectOne(`${API}/borrow`);
      expect({ ...post.request.body }).toEqual({ bookId: 3 });
      expect(post.request.body.userId).toBeUndefined();
      expect(post.request.headers.get('Authorization')).toBe('Bearer jwt-test');

      post.flush({ message: 'Votre demande a été enregistrée.' });

      // Après la demande : catalogue + quota rechargés
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      httpMock.expectOne(`${API}/borrow/my/quota`).flush({ activeCount: 2, maxQuota: 3, remaining: 1 });
      httpMock.expectOne(`${API}/borrow/user/51`).flush(BORROWS);

      expect(ctx.toast.info).toHaveBeenCalled();
      expect(ctx.component.showBorrowModal).toBeFalse();
    });

    it('quota atteint : la demande est bloquée et signalée dans le formulaire', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      ctx.fixture.detectChanges();
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      httpMock.expectOne(`${API}/borrow/my/quota`).flush({ activeCount: 3, maxQuota: 3, remaining: 0 });
      httpMock.expectOne(`${API}/borrow/user/51`).flush([]);
      ctx.fixture.detectChanges();

      expect(ctx.component.quotaReached).toBeTrue();

      ctx.component.openBorrowModal();
      ctx.component.selectAdherentBook(BOOKS[2]);
      ctx.fixture.detectChanges();

      expect(ctx.component.isBorrowFormValid).toBeFalse();
      expect(ctx.fixture.nativeElement.textContent).toContain('Quota atteint');
    });

    it('un livre indisponible propose « Le réserver » et redirige vers /reservations', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      // Aucun emprunt en cours : « 1984 » doit apparaître dans les suggestions
      loadMemberPage(ctx, []);

      ctx.component.openBorrowModal();
      ctx.component.onAdherentBookInput({ target: { value: '1984' } } as any);
      expect(ctx.component.adherentSuggestions.length).toBe(1);

      ctx.component.selectAdherentBook(BOOKS[1]);       // 0 exemplaire
      ctx.fixture.detectChanges();

      expect(ctx.component.unavailableBook).toEqual(BOOKS[1]);
      expect(ctx.component.isBorrowFormValid).toBeFalse();

      ctx.component.goReserveBook();
      expect(ctx.router.navigate).toHaveBeenCalledWith(
        ['/reservations'], { queryParams: { reserve: 2 } }
      );
    });

    it('un livre inconnu du catalogue propose « Le réserver quand même »', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMemberPage(ctx);

      ctx.component.openBorrowModal();
      ctx.component.onAdherentBookInput({ target: { value: 'Test C' } } as any);
      ctx.fixture.detectChanges();

      expect(ctx.component.adherentSuggestions.length).toBe(0);
      expect(ctx.component.unknownBookQuery).toBe('Test C');

      ctx.component.goReserveBook();
      expect(ctx.router.navigate).toHaveBeenCalledWith(
        ['/reservations'], { queryParams: { reserveName: 'Test C' } }
      );
    });

    it('la recherche est insensible à la casse et aux accents', () => {
      const ctx = setup({ role: 'ADHERENT', userId: 51 });
      loadMemberPage(ctx);

      ctx.component.openBorrowModal();
      ctx.component.onAdherentBookInput({ target: { value: 'du cote' } } as any);

      expect(ctx.component.adherentSuggestions.map((b: Books) => b.bookId)).toEqual([3]);
    });
  });

  // ==================== Pré-remplissage par la route ====================

  describe('?book=<id>', () => {
    it('ouvre la modale avec le livre pré-sélectionné une fois le catalogue chargé', () => {
      const ctx = setup({ role: 'Admin', userId: 1, queryParams: { book: '2' } });

      ctx.fixture.detectChanges();
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      httpMock.expectOne(`${API}/admin/users`).flush(USERS);
      httpMock.expectOne(`${API}/borrow`).flush(BORROWS);
      ctx.fixture.detectChanges();

      expect(ctx.component.showBorrowModal).toBeTrue();
      expect(ctx.component.modalSelectedBookId).toBe(2);
      expect(ctx.component.adherentBookQuery).toBe('1984');
    });
  });
});
