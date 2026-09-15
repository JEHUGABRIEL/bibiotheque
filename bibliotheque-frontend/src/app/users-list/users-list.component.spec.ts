import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { UsersListComponent } from './users-list.component';
import { ModalComponent } from '../_shared/modal.component';
import { ConfirmModalComponent } from '../_shared/confirm-modal.component';
import { Users } from '../_model/users';
import { Books } from '../_model/books';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { ToastService } from '../_service/toast.service';
import { environment } from '../../environments/environment';

/**
 * Tests de la page Utilisateurs : annuaire, pagination, badges/libellés des deux
 * modèles de rôles (Admin/User et BIBLIOTHECAIRE/ADHERENT), inscription,
 * modification de rôle et modale de détail (identité + historique d'emprunts).
 */
describe('UsersListComponent', () => {

  const API = environment.apiUrl;
  const USERS_URL = `${API}/admin/users`;

  const makeUser = (id: number, name: string, roleName = 'ADHERENT'): Users =>
    ({ userId: id, username: name.toLowerCase(), name, password: '', role: [{ roleName }] } as Users);

  let httpMock: HttpTestingController;

  function setup() {
    localStorage.clear();
    localStorage.setItem('jwtToken', 'jwt-test');
    localStorage.setItem('roles', JSON.stringify([{ roleName: 'Admin' }]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [UsersListComponent, ModalComponent, ConfirmModalComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule]
    });

    const fixture = TestBed.createComponent(UsersListComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'success');
    spyOn(toast, 'error');

    return { fixture, component, toast };
  }

  function load(ctx: ReturnType<typeof setup>,
                users: Users[] = [makeUser(51, 'Jehu Binga'), makeUser(1, 'Staff Biblio', 'BIBLIOTHECAIRE')],
                books: Books[] = [{ bookId: 1, bookName: 'Dune' } as Books]) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(USERS_URL).flush(users);
    httpMock.expectOne(`${API}/admin/books`).flush(books);
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

  // ---------- Annuaire ----------

  describe('annuaire', () => {
    it('charge les utilisateurs et le catalogue (pour les titres des emprunts)', () => {
      const ctx = setup();
      load(ctx);

      expect(ctx.component.users.length).toBe(2);
      expect(ctx.component.loading).toBeFalse();
      expect(ctx.component.booksCache.length).toBe(1);
      expect(ctx.component.getBookName(1)).toBe('Dune');
      expect(ctx.component.getBookName(99)).toBe('Livre #99');
      expect(ctx.fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    });

    it('pagine par 10', () => {
      const ctx = setup();
      load(ctx, Array.from({ length: 12 }, (_, i) => makeUser(i + 1, 'Adhérent ' + (i + 1))));

      expect(ctx.component.totalPages).toBe(2);
      expect(ctx.component.resultsInfo).toBe('1–10 sur 12');
      ctx.component.goToPage(2);
      expect(ctx.component.paginatedUsers.length).toBe(2);
      ctx.component.goToPage(0);
      expect(ctx.component.currentPage).toBe(2);
    });
  });

  // ---------- Rôles ----------

  describe('rôles', () => {
    it('badgeClassForRole traite les deux modèles de rôles', () => {
      const ctx = setup();
      load(ctx);

      expect(ctx.component.badgeClassForRole('Admin')).toBe('status-badge status-honoree');
      expect(ctx.component.badgeClassForRole('BIBLIOTHECAIRE')).toBe('status-badge status-honoree');
      expect(ctx.component.badgeClassForRole('ADHERENT')).toBe('status-badge status-disponible');
      expect(ctx.component.badgeClassForRole(undefined)).toBe('status-badge status-disponible');
    });

    it('roleLabelForRole traduit chaque rôle, ancien comme nouveau modèle', () => {
      const ctx = setup();
      load(ctx);

      expect(ctx.component.roleLabelForRole('Admin')).toBeTruthy();
      expect(ctx.component.roleLabelForRole('BIBLIOTHECAIRE')).toBeTruthy();
      expect(ctx.component.roleLabelForRole('ADHERENT')).toBeTruthy();
      expect(ctx.component.roleLabelForRole('Admin')).not.toBe(ctx.component.roleLabelForRole('ADHERENT'));
    });
  });

  // ---------- Inscription ----------

  describe('inscription', () => {
    it('exige nom, identifiant, mot de passe et rôle', () => {
      const ctx = setup();
      load(ctx);

      ctx.component.openCreateModal();
      expect(ctx.component.newSelectedRole).toBe('User');
      expect(ctx.component.isCreateValid).toBeFalse();

      ctx.component.newUser = { name: 'Marie', username: 'marie', password: '' } as Users;
      expect(ctx.component.isCreateValid).toBeFalse();

      ctx.component.newUser.password = 'secret';
      expect(ctx.component.isCreateValid).toBeTrue();
    });

    it('submitCreate envoie le rôle choisi puis recharge l\'annuaire', () => {
      const ctx = setup();
      load(ctx);

      ctx.component.openCreateModal();
      ctx.component.newUser = { name: 'Marie', username: 'marie', password: 'secret' } as Users;
      ctx.component.newSelectedRole = 'BIBLIOTHECAIRE';

      ctx.component.submitCreate();

      const post = httpMock.expectOne(USERS_URL);
      expect(post.request.method).toBe('POST');
      expect(post.request.body.role).toEqual([{ roleName: 'BIBLIOTHECAIRE' }]);
      post.flush({ userId: 60 });

      httpMock.expectOne(USERS_URL).flush([makeUser(51, 'Jehu Binga')]);
      expect(ctx.toast.success).toHaveBeenCalled();
      expect(ctx.component.showCreateModal).toBeFalse();
    });
  });

  // ---------- Modification ----------

  describe('modification', () => {
    it('openEditModal pré-remplit le rôle courant', () => {
      const ctx = setup();
      const user = makeUser(51, 'Jehu Binga', 'ADHERENT');
      load(ctx, [user]);

      ctx.component.openEditModal(user);

      expect(ctx.component.showEditModal).toBeTrue();
      expect(ctx.component.editUserId).toBe(51);
      expect(ctx.component.editSelectedRole).toBe('ADHERENT');
      expect(ctx.component.editUser.name).toBe('Jehu Binga');
    });

    it('submitEdit envoie le nouveau rôle sur PUT /admin/users/{id}', () => {
      const ctx = setup();
      const user = makeUser(51, 'Jehu Binga', 'ADHERENT');
      load(ctx, [user]);

      ctx.component.openEditModal(user);
      ctx.component.editSelectedRole = 'BIBLIOTHECAIRE';
      expect(ctx.component.isEditValid).toBeTrue();

      ctx.component.submitEdit();

      const put = httpMock.expectOne(`${USERS_URL}/51`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.role).toEqual([{ roleName: 'BIBLIOTHECAIRE' }]);
      put.flush({ message: 'Utilisateur modifié' });

      httpMock.expectOne(USERS_URL).flush([user]);
      expect(ctx.toast.success).toHaveBeenCalledWith('Utilisateur modifié avec succès');
      expect(ctx.component.showEditModal).toBeFalse();
    });
  });

  // ---------- Modale de détail ----------

  describe('modale de détail', () => {
    const borrows = [
      { borrowId: 1, bookId: 1, userId: 51, statut: StatutBorrow.VALIDEE },
      { borrowId: 2, bookId: 1, userId: 51, statut: StatutBorrow.RENDU, returnDate: '05-09-2026' }
    ] as unknown as Borrow[];

    it('userDetails charge l\'identité puis l\'historique d\'emprunts', () => {
      const ctx = setup();
      load(ctx);

      ctx.component.userDetails(51);
      expect(ctx.component.showDetailModal).toBeTrue();
      expect(ctx.component.detailLoading).toBeTrue();

      httpMock.expectOne(`${USERS_URL}/51`).flush(makeUser(51, 'Jehu Binga'));

      const hist = httpMock.expectOne(`${API}/borrow/user/51`);
      expect(hist.request.method).toBe('GET');
      hist.flush(borrows);

      expect(ctx.component.detailUser.name).toBe('Jehu Binga');
      expect(ctx.component.detailBorrows.length).toBe(2);
      expect(ctx.component.detailLoading).toBeFalse();
    });

    it('l\'historique indisponible (403 sur l\'emprunt d\'autrui) ne bloque pas la modale', () => {
      const ctx = setup();
      load(ctx);

      ctx.component.userDetails(51);
      httpMock.expectOne(`${USERS_URL}/51`).flush(makeUser(51, 'Jehu Binga'));
      httpMock.expectOne(`${API}/borrow/user/51`).flush(
        { message: 'Accès refusé' },
        { status: 403, statusText: 'Forbidden' }
      );

      expect(ctx.component.detailLoading).toBeFalse();
      expect(ctx.component.detailUser.name).toBe('Jehu Binga');
    });

    it('un utilisateur introuvable (404) affiche l\'erreur dans la modale', () => {
      const ctx = setup();
      load(ctx);

      ctx.component.userDetails(404);
      httpMock.expectOne(`${USERS_URL}/404`).flush(
        { message: 'Utilisateur introuvable' },
        { status: 404, statusText: 'Not Found' }
      );

      expect(ctx.component.detailError).toBe('Utilisateur introuvable');
      expect(ctx.component.detailLoading).toBeFalse();
      expect(ctx.component.showDetailModal).toBeTrue();
    });

    it('un 403 ferme la modale (consultation réservée au personnel)', () => {
      const ctx = setup();
      load(ctx);

      ctx.component.userDetails(51);
      httpMock.expectOne(`${USERS_URL}/51`).flush(
        { message: 'Accès refusé' },
        { status: 403, statusText: 'Forbidden' }
      );

      expect(ctx.component.showDetailModal).toBeFalse();
      expect(ctx.component.detailError).toBe('Accès refusé');
    });
  });
});
