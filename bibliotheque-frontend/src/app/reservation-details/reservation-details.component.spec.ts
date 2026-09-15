import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

import { ReservationDetailsComponent } from './reservation-details.component';
import { Reservation, StatutReservation } from '../_model/reservation';
import { environment } from '../../environments/environment';

/**
 * Tests de la modale « détail d'une réservation ».
 *
 * Une DEMANDE n'est pas encore une réservation : le personnel doit l'accepter
 * (RG du workflow) avant qu'elle ne devienne EN_ATTENTE. Le libellé du bouton
 * d'annulation doit donc suivre ce passage — « Annuler la demande » tant que
 * l'admin n'a pas validé, « Annuler la réservation » ensuite.
 */
describe('ReservationDetailsComponent', () => {

  const API = environment.apiUrl;

  let httpMock: HttpTestingController;

  function setup(id = 7, roles: any[] = [{ roleName: 'ADHERENT' }], userId = 10) {
    localStorage.setItem('roles', JSON.stringify(roles));
    localStorage.setItem('userId', JSON.stringify(userId));
    localStorage.setItem('jwtToken', 'jeton');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [ReservationDetailsComponent],
      imports: [CommonModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id } } } }
      ]
    });

    const fixture = TestBed.createComponent(ReservationDetailsComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    return { fixture, component };
  }

  /** Charge la réservation, puis les dépendances d'affichage (livre, adhérent). */
  function load(fixture: any, statut: StatutReservation, bookId = 3, userId = 10) {
    fixture.detectChanges();

    const req = httpMock.expectOne(`${API}/api/reservations/7`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 7, bookId, userId, statut,
      dateReservation: '2026-09-15', dateExpiration: '2026-09-22'
    } as unknown as Reservation);

    httpMock.expectOne(`${API}/admin/books/${bookId}`).flush({ bookId, bookName: 'Dune' });
    // Un adhérent n'a pas le droit à l'annuaire : repli lisible attendu.
    httpMock.match(`${API}/admin/users/${userId}`)
      .forEach((r) => r.flush({ message: 'Interdit' }, { status: 403, statusText: 'Forbidden' }));

    fixture.detectChanges();
  }

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  it('une demande pas encore validée par l\'admin s\'annonce comme une demande', () => {
    const ctx = setup();
    load(ctx.fixture, StatutReservation.DEMANDE);

    expect(ctx.component.cancelLabel).toBe('Annuler la demande');
    const btn = ctx.fixture.nativeElement.querySelector('.btn-action-danger');
    expect(btn.textContent.trim()).toBe('Annuler la demande');
  });

  it('une demande validée par l\'admin (EN_ATTENTE) s\'annonce comme une réservation', () => {
    const ctx = setup();
    load(ctx.fixture, StatutReservation.EN_ATTENTE);

    expect(ctx.component.cancelLabel).toBe('Annuler la réservation');
    const btn = ctx.fixture.nativeElement.querySelector('.btn-action-danger');
    expect(btn.textContent.trim()).toBe('Annuler la réservation');
  });

  it('un livre devenu disponible reste une réservation à annuler', () => {
    const ctx = setup();
    load(ctx.fixture, StatutReservation.DISPONIBLE);
    expect(ctx.component.cancelLabel).toBe('Annuler la réservation');
  });

  it('le libellé suit le statut de la réservation, pas le rendu initial', () => {
    const ctx = setup();
    load(ctx.fixture, StatutReservation.DEMANDE);
    expect(ctx.fixture.nativeElement.querySelector('.btn-action-danger').textContent.trim())
      .toBe('Annuler la demande');

    // L'admin accepte la demande pendant que l'adhérent a la page ouverte.
    ctx.component.reservation.statut = StatutReservation.EN_ATTENTE;
    ctx.fixture.detectChanges();

    expect(ctx.component.cancelLabel).toBe('Annuler la réservation');
    expect(ctx.fixture.nativeElement.querySelector('.btn-action-danger').textContent.trim())
      .toBe('Annuler la réservation');
  });

  it('une réservation annulée n\'offre plus de bouton d\'annulation', () => {
    const ctx = setup();
    load(ctx.fixture, StatutReservation.ANNULEE);

    expect(ctx.component.canCancel).toBeFalse();
    expect(ctx.fixture.nativeElement.querySelector('.btn-action-danger')).toBeNull();
  });
});
