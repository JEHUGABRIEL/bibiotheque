import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ReservationContainerComponent } from '../reservation-container/reservation-container.component';
import { ReservationListComponent } from '../reservation-list/reservation-list.component';
import { ModalComponent } from '../_shared/modal.component';
import { ConfirmModalComponent } from '../_shared/confirm-modal.component';
import { AuthInterceptor } from '../_auth/auth.interceptor';
import { Reservation, StatutReservation } from '../_model/reservation';
import { Books } from '../_model/books';
import { Users } from '../_model/users';
import { NotificationService } from '../_service/notification.service';
import { ToastService } from '../_service/toast.service';
import { environment } from '../../environments/environment';

/**
 * Test d'INTÉGRATION du parcours de réservation.
 *
 * Toute la chaîne est réelle : conteneur + liste + modales, services HTTP réels,
 * AuthInterceptor réel, HttpClient simulé. Seul le NotificationService est
 * remplacé (il sonde l'API en arrière-plan) — on vérifie justement qu'il est
 * appelé, ou pas, selon que l'annulation vient de l'adhérent ou du personnel.
 *
 * Parcours couverts : DEMANDE adhérent → acceptation par le personnel (DEMANDE
 * → EN_ATTENTE) → annulation, avec les garde-fous de droits (RS-03/RS-05).
 */
describe('Intégration — parcours de réservation', () => {

  const API = environment.apiUrl;
  const RES = `${API}/api/reservations`;

  const BOOKS = [
    { bookId: 1, bookName: 'Dune', bookAuthor: 'F. Herbert', bookGenre: 'SF', noOfCopies: 3, imageUrl: '' },
    { bookId: 2, bookName: '1984', bookAuthor: 'G. Orwell', bookGenre: 'SF', noOfCopies: 0, imageUrl: '' },
    { bookId: 3, bookName: 'Du côté de chez Swann', bookAuthor: 'M. Proust', bookGenre: 'Roman', noOfCopies: 0, imageUrl: '' }
  ] as Books[];

  const USERS = [
    { userId: 51, username: 'jehu', name: 'Jehu Binga', password: '', role: [{ roleName: 'ADHERENT' }] },
    { userId: 1, username: 'staff', name: 'Staff Biblio', password: '', role: [{ roleName: 'BIBLIOTHECAIRE' }] }
  ] as Users[];

  const DEMANDE_OWN = {
    id: 10, bookId: 2, userId: 51, statut: StatutReservation.DEMANDE,
    dateReservation: '11-09-2026', dateExpiration: '18-09-2026'
  } as unknown as Reservation;

  const ATTENTE_OTHER = {
    id: 11, bookId: 3, userId: 99, statut: StatutReservation.EN_ATTENTE,
    dateReservation: '11-09-2026', dateExpiration: '18-09-2026'
  } as unknown as Reservation;

  let httpMock: HttpTestingController;

  type SetupOptions = {
    role?: 'Admin' | 'BIBLIOTHECAIRE' | 'ADHERENT';
    userId?: number;
    queryParams?: Record<string, string>;
  };

  function setup(opts: SetupOptions = {}) {
    const role = opts.role ?? 'ADHERENT';
    const userId = opts.userId ?? 51;
    const params = convertToParamMap(opts.queryParams ?? {});

    localStorage.clear();
    localStorage.setItem('jwtToken', 'jwt-test');
    localStorage.setItem('roles', JSON.stringify([{ roleName: role }]));
    localStorage.setItem('userId', JSON.stringify(userId));

    const notificationsStub = {
      markSelfCancelled: jasmine.createSpy('markSelfCancelled')
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [
        ReservationContainerComponent,
        ReservationListComponent,
        ModalComponent,
        ConfirmModalComponent
      ],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: NotificationService, useValue: notificationsStub },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(params),
            snapshot: { queryParamMap: params }
          }
        }
      ]
    });

    const fixture: ComponentFixture<ReservationContainerComponent> =
      TestBed.createComponent(ReservationContainerComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate');
    spyOn(toast, 'success');
    spyOn(toast, 'error');
    spyOn(toast, 'info');

    return { fixture, component, toast, router, notificationsStub };
  }

  /** Chargement initial côté adhérent : réservations + catalogue. */
  function loadMember(ctx: ReturnType<typeof setup>, reservations: Reservation[] = [DEMANDE_OWN, ATTENTE_OTHER]) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(RES).flush(reservations);
    httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
    ctx.fixture.detectChanges();
  }

  /** Chargement initial côté personnel : réservations + catalogue + adhérents. */
  function loadStaff(ctx: ReturnType<typeof setup>, reservations: Reservation[] = [DEMANDE_OWN, ATTENTE_OTHER]) {
    ctx.fixture.detectChanges();
    httpMock.expectOne(RES).flush(reservations);
    httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
    httpMock.expectOne(`${API}/admin/users`).flush(USERS);
    ctx.fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ==================== Chargement et affichage ====================

  describe('chargement', () => {
    it('affiche les réservations avec les noms de livres résolus', () => {
      const ctx = setup();
      loadMember(ctx);

      expect(ctx.component.reservations.length).toBe(2);
      expect(ctx.component.bookNames.get(2)).toBe('1984');

      const rows = ctx.fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
      // L'adhérent ne charge pas l'annuaire : sa ligne porte son identifiant, pas son nom
      expect(ctx.fixture.nativeElement.textContent).toContain('Adhérent #51');
      expect(ctx.fixture.nativeElement.textContent).toContain('1984');
    });

    it('un adhérent n\'appelle pas /admin/users (réservé au personnel)', () => {
      const ctx = setup();
      loadMember(ctx);

      httpMock.expectNone(`${API}/admin/users`);
      expect(ctx.component.users.length).toBe(0);
    });

    it('le personnel charge aussi la liste des adhérents, filtrée du personnel', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      expect(ctx.component.users.map((u: Users) => u.userId)).toEqual([51]);
      expect(ctx.component.userNames.get(51)).toBe('Jehu Binga');
    });

    it('le filtre par statut recharge la liste depuis le backend avec ?statut=', () => {
      const ctx = setup();
      loadMember(ctx);

      ctx.component.onFilterChange(StatutReservation.DEMANDE);

      const req = httpMock.expectOne(`${RES}?statut=DEMANDE`);
      expect(req.request.method).toBe('GET');
      req.flush([DEMANDE_OWN]);
      ctx.fixture.detectChanges();

      expect(ctx.component.currentFilter).toBe(StatutReservation.DEMANDE);
      expect(ctx.component.reservations.length).toBe(1);
      expect(ctx.fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    });

    it('un 401 reste LOCAL à la page (message d\'erreur, pas de redirection globale)', () => {
      const ctx = setup();
      ctx.fixture.detectChanges();

      httpMock.expectOne(RES).flush(
        { message: 'Session expirée', expired: true },
        { status: 401, statusText: 'Unauthorized' }
      );
      httpMock.expectOne(`${API}/admin/books`).flush(BOOKS);
      ctx.fixture.detectChanges();

      expect(ctx.router.navigate).not.toHaveBeenCalled();
      expect(ctx.component.error).toContain('401');
      expect(ctx.component.loading).toBeFalse();
    });
  });

  // ==================== Création d'une demande ====================

  describe('création', () => {
    it('un adhérent envoie une DEMANDE sans userId (RS-04) et l\'annonce comme telle', () => {
      const ctx = setup();
      loadMember(ctx);

      ctx.component.openCreateModal();
      ctx.component.selectBookSuggestion(BOOKS[1]);          // livre réservable (0 exemplaire)
      ctx.fixture.detectChanges();
      expect(ctx.component.isFormValid).toBeTrue();

      ctx.component.onSubmitReservation();

      const post = httpMock.expectOne(RES);
      expect(post.request.method).toBe('POST');
      // Spread : le corps est une instance de Reservation, comparée à un objet littéral
      expect({ ...post.request.body }).toEqual({ bookId: 2 });
      expect(post.request.body.userId).toBeUndefined();
      expect(post.request.headers.get('Authorization')).toBe('Bearer jwt-test');

      post.flush({ id: 30, bookId: 2, userId: 51, statut: StatutReservation.DEMANDE, dateExpiration: '18-09-2026' });

      // Le formulaire se ferme et la liste est rechargée
      httpMock.expectOne(RES).flush([DEMANDE_OWN, ATTENTE_OTHER]);

      expect(ctx.component.showCreateModal).toBeFalse();
      expect(ctx.toast.info).toHaveBeenCalled();
    });

    it('un livre jamais enregistré est réservé par son nom (newBookName)', () => {
      const ctx = setup();
      loadMember(ctx);

      ctx.component.openCreateModal();
      ctx.component.bookQuery = 'Test C';
      ctx.component.selectNewBook();
      expect(ctx.component.isFormValid).toBeTrue();

      ctx.component.onSubmitReservation();

      const post = httpMock.expectOne(RES);
      expect({ ...post.request.body }).toEqual({ newBookName: 'Test C' });
      post.flush({ id: 31, bookId: 8, userId: 51, statut: StatutReservation.DEMANDE });

      httpMock.expectOne(RES).flush([DEMANDE_OWN, ATTENTE_OTHER]);
    });

    it('le personnel doit choisir un adhérent : aucune requête n\'est envoyée sinon', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      ctx.component.openCreateModal();
      ctx.component.selectBookSuggestion(BOOKS[1]);
      ctx.component.selectedUserId = null;

      ctx.component.onSubmitReservation();

      httpMock.expectNone(RES);
      expect(ctx.component.formError).toContain('adhérent');
    });

    it('le personnel réserve POUR un adhérent (l\'userId part dans le corps)', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      ctx.component.openCreateModal();
      ctx.component.selectBookSuggestion(BOOKS[1]);
      ctx.component.selectedUserId = 51;

      ctx.component.onSubmitReservation();

      const post = httpMock.expectOne(RES);
      expect({ ...post.request.body }).toEqual({ bookId: 2, userId: 51 });
      // Création par le personnel : le backend répond directement EN_ATTENTE
      post.flush({ id: 32, bookId: 2, userId: 51, statut: StatutReservation.EN_ATTENTE });

      httpMock.expectOne(RES).flush([DEMANDE_OWN, ATTENTE_OTHER]);
      expect(ctx.toast.success).toHaveBeenCalled();
    });

    it('RG-01 : seuls les livres à 0 exemplaire sont réservables', () => {
      const ctx = setup();
      loadMember(ctx);

      expect(ctx.component.isBookReservable(BOOKS[0])).toBeFalse();  // 3 exemplaires
      expect(ctx.component.isBookReservable(BOOKS[1])).toBeTrue();   // 0 exemplaire
      expect(ctx.component.reservableBooks.map((b: Books) => b.bookId)).toEqual([2, 3]);
    });

    it('les libellés de création diffèrent selon le rôle (demande côté adhérent)', () => {
      const member = setup({ role: 'ADHERENT', userId: 51 });
      expect(member.component.addLabel).toBe('Nouvelle demande de réservation');
      expect(member.component.addTitleLabel).toBe('Nouvelle demande de réservation');

      const staff = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      expect(staff.component.addLabel).toBe('Nouvelle réservation');
      expect(staff.component.addTitleLabel).toBe('Nouvelle réservation');
    });
  });

  // ==================== Acceptation (personnel) ====================

  describe('acceptation d\'une demande (personnel)', () => {
    it('la liste ne propose « Accepter » que sur les DEMANDE, et seulement au personnel', () => {
      const member = setup();
      loadMember(member);
      // (le sélecteur vise le bouton du tableau : la modale porte aussi ce titre)
      expect(member.fixture.nativeElement.querySelectorAll('button[title="Accepter la demande"]').length).toBe(0);

      const staff = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(staff);
      expect(staff.fixture.nativeElement.querySelectorAll('button[title="Accepter la demande"]').length).toBe(1);
    });

    it('accepter envoie PATCH /api/reservations/{id}/accepter et met la ligne à jour sans recharger', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      // Une seule DEMANDE dans la liste → un seul bouton « Accepter »
      ctx.fixture.detectChanges();
      expect(ctx.fixture.nativeElement.querySelectorAll('button[title="Accepter la demande"]').length).toBe(1);

      ctx.component.openAcceptConfirm(DEMANDE_OWN);
      ctx.fixture.detectChanges();
      expect(ctx.component.showAcceptConfirm).toBeTrue();

      ctx.component.confirmAccept();

      const patch = httpMock.expectOne(`${RES}/10/accepter`);
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body).toEqual({});
      patch.flush({ ...DEMANDE_OWN, statut: StatutReservation.EN_ATTENTE });

      // Mise à jour en place : aucun GET de rafraîchissement
      const index = ctx.component.reservations.findIndex((r: Reservation) => r.id === 10);
      expect(ctx.component.reservations[index].statut).toBe(StatutReservation.EN_ATTENTE);
      expect(ctx.component.showAcceptConfirm).toBeFalse();
      expect(ctx.toast.success).toHaveBeenCalled();
      ctx.fixture.detectChanges();
      // La DEMANDE est devenue EN_ATTENTE : plus aucun bouton « Accepter »
      expect(ctx.fixture.nativeElement.querySelectorAll('button[title="Accepter la demande"]').length).toBe(0);
    });

    it('l\'échec de l\'acceptation (409) affiche l\'erreur et referme la modale', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      ctx.component.openAcceptConfirm(DEMANDE_OWN);
      ctx.component.confirmAccept();

      httpMock.expectOne(`${RES}/10/accepter`).flush(
        { message: 'Cette réservation n\'est plus une demande' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(ctx.toast.error).toHaveBeenCalledWith('Cette réservation n\'est plus une demande');
      expect(ctx.component.showAcceptConfirm).toBeFalse();
      expect(ctx.component.reservationToAccept).toBeNull();
    });
  });

  // ==================== Annulation ====================

  describe('annulation', () => {
    it('l\'adhérent annule sa propre réservation et la cloche ignore ce self-cancel', () => {
      const ctx = setup({ userId: 51 });
      loadMember(ctx);

      expect(ctx.component.canCancelReservation(DEMANDE_OWN)).toBeTrue();
      expect(ctx.component.canCancelReservation(ATTENTE_OTHER)).toBeFalse();

      ctx.component.openCancelConfirm(DEMANDE_OWN);
      ctx.fixture.detectChanges();
      expect(ctx.component.showCancelConfirm).toBeTrue();

      ctx.component.confirmCancel();

      const patch = httpMock.expectOne(`${RES}/10/annuler`);
      expect(patch.request.method).toBe('PATCH');
      patch.flush({ ...DEMANDE_OWN, statut: StatutReservation.ANNULEE });

      expect(ctx.notificationsStub.markSelfCancelled).toHaveBeenCalledWith('res-10');
      const index = ctx.component.reservations.findIndex((r: Reservation) => r.id === 10);
      expect(ctx.component.reservations[index].statut).toBe(StatutReservation.ANNULEE);
      expect(ctx.toast.success).toHaveBeenCalled();
    });

    it('une annulation par le personnel n\'est PAS comptée comme un self-cancel', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      expect(ctx.component.canCancelReservation(ATTENTE_OTHER)).toBeTrue();

      ctx.component.openCancelConfirm(ATTENTE_OTHER);
      ctx.component.confirmCancel();

      httpMock.expectOne(`${RES}/11/annuler`).flush({ ...ATTENTE_OTHER, statut: StatutReservation.ANNULEE });

      expect(ctx.notificationsStub.markSelfCancelled).not.toHaveBeenCalled();
    });

    it('un 403 à l\'annulation affiche le message du backend sans rediriger', () => {
      const ctx = setup({ userId: 51 });
      loadMember(ctx);

      ctx.component.openCancelConfirm(ATTENTE_OTHER);
      ctx.component.confirmCancel();

      httpMock.expectOne(`${RES}/11/annuler`).flush(
        { message: 'Accès refusé : cette réservation ne vous appartient pas' },
        { status: 403, statusText: 'Forbidden' }
      );

      expect(ctx.router.navigate).not.toHaveBeenCalled();
      expect(ctx.toast.error).toHaveBeenCalledWith('Accès refusé : cette réservation ne vous appartient pas');
      expect(ctx.component.showCancelConfirm).toBeFalse();
    });
  });

  // ==================== Modale de détail : libellé d'annulation ====================

  describe('libellé d\'annulation dans la modale de détail', () => {
    /** Le libellé du bouton d'annulation réellement rendu dans la modale ouverte. */
    function detailCancelLabel(ctx: ReturnType<typeof setup>): string {
      const btn = ctx.fixture.nativeElement.querySelector('.btn-action-danger');
      return btn ? btn.textContent.trim() : '';
    }

    function openDetail(ctx: ReturnType<typeof setup>, reservation: Reservation) {
      ctx.component.openDetails(reservation);
      ctx.fixture.detectChanges();
    }

    it('une demande pas encore validée s\'annonce comme une demande', () => {
      const ctx = setup({ userId: 51 });
      loadMember(ctx);

      openDetail(ctx, DEMANDE_OWN);

      expect(ctx.component.canCancelDetail).toBeTrue();
      expect(detailCancelLabel(ctx)).toBe('Annuler la demande');
    });

    it('une demande validée par l\'admin (EN_ATTENTE) s\'annonce comme une réservation', () => {
      const ctx = setup({ userId: 51 });
      const attenteOwn = { ...DEMANDE_OWN, statut: StatutReservation.EN_ATTENTE } as unknown as Reservation;
      loadMember(ctx, [attenteOwn]);

      openDetail(ctx, attenteOwn);

      expect(detailCancelLabel(ctx)).toBe('Annuler la réservation');
    });

    it('un livre devenu disponible reste une réservation à annuler', () => {
      const ctx = setup({ userId: 51 });
      const disponibleOwn = { ...DEMANDE_OWN, statut: StatutReservation.DISPONIBLE } as unknown as Reservation;
      loadMember(ctx, [disponibleOwn]);

      openDetail(ctx, disponibleOwn);

      expect(detailCancelLabel(ctx)).toBe('Annuler la réservation');
    });

    it('l\'acceptation par le personnel fait passer le bouton de « demande » à « réservation »', () => {
      const ctx = setup({ role: 'BIBLIOTHECAIRE', userId: 1 });
      loadStaff(ctx);

      openDetail(ctx, DEMANDE_OWN);
      expect(detailCancelLabel(ctx)).toBe('Annuler la demande');

      // Le personnel accepte la demande depuis cette même modale.
      ctx.component.showDetailModal = false;
      ctx.component.openAcceptConfirm(DEMANDE_OWN);
      ctx.component.confirmAccept();
      httpMock.expectOne(`${RES}/10/accepter`)
        .flush({ ...DEMANDE_OWN, statut: StatutReservation.EN_ATTENTE });

      openDetail(ctx, { ...DEMANDE_OWN, statut: StatutReservation.EN_ATTENTE } as unknown as Reservation);
      expect(detailCancelLabel(ctx)).toBe('Annuler la réservation');
    });

    it('la modale de confirmation reprend le même libellé que la demande annulée', () => {
      const ctx = setup({ userId: 51 });
      const attenteOwn = { ...DEMANDE_OWN, statut: StatutReservation.EN_ATTENTE } as unknown as Reservation;
      loadMember(ctx, [attenteOwn]);

      ctx.component.openCancelConfirm(attenteOwn);
      ctx.fixture.detectChanges();

      const confirm = ctx.fixture.nativeElement.querySelector('app-confirm-modal .confirm-ok');
      expect(confirm.textContent.trim()).toBe('Annuler la réservation');
    });
  });

  // ==================== Pré-remplissage par la route ====================

  describe('arrivée depuis une autre page', () => {
    it('?reserve=<id> ouvre la modale avec le livre pré-sélectionné', () => {
      const ctx = setup({ queryParams: { reserve: '2' } });
      loadMember(ctx);

      expect(ctx.component.showCreateModal).toBeTrue();
      expect(ctx.component.selectedBookId).toBe(2);
      expect(ctx.component.bookQuery).toBe('1984');
      expect(ctx.component.isFormValid).toBeTrue();
    });

    it('?reserveName=<nom> pré-remplit un livre encore inconnu du catalogue', () => {
      const ctx = setup({ queryParams: { reserveName: 'Test C' } });
      loadMember(ctx);

      expect(ctx.component.showCreateModal).toBeTrue();
      expect(ctx.component.selectedBookId).toBeNull();
      expect(ctx.component.newBookName).toBe('Test C');
      expect(ctx.component.isFormValid).toBeTrue();
    });
  });
});
