import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Reservation, StatutReservation } from '../_model/reservation';
import { ReservationService } from '../_service/reservation.service';
import { BooksService } from '../_service/books.service';
import { UsersService } from '../_service/users.service';
import { UserAuthService } from '../_service/user-auth.service';
import { TranslationService } from '../_service/translation.service';

/**
 * Détail d'une réservation.
 * ADHERENT : uniquement la sienne (le backend renvoie 403 sinon, affiché inline).
 * BIBLIOTHECAIRE / Admin : toutes.
 */
@Component({
  selector: 'app-reservation-details',
  templateUrl: './reservation-details.component.html',
  styleUrls: ['./reservation-details.component.css']
})
export class ReservationDetailsComponent implements OnInit {

  id!: number;
  reservation: Reservation | null = null;
  bookName = '';
  userName = '';

  loading = false;
  error: string | null = null;
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reservationService: ReservationService,
    private booksService: BooksService,
    private usersService: UsersService,
    private userAuthService: UserAuthService,
    public t: TranslationService
  ) { }

  get isStaff(): boolean {
    return this.usersService.isStaff();
  }

  /**
   * Même règle que la modale de détail de la liste (`reservation-container.canCancelDetail`)
   * et que le backend : DEMANDE, EN_ATTENTE et DISPONIBLE sont annulables par leur
   * propriétaire (ou par le personnel).
   */
  get canCancel(): boolean {
    if (!this.reservation) return false;
    const statutOk = this.reservation.statut === StatutReservation.DEMANDE
      || this.reservation.statut === StatutReservation.EN_ATTENTE
      || this.reservation.statut === StatutReservation.DISPONIBLE;
    return statutOk && (this.isStaff || this.reservation.userId === this.userAuthService.getUserId());
  }

  /**
   * Libellé du bouton d'annulation.
   * Le statut DEMANDE désigne une demande pas encore validée par le personnel ;
   * dès que l'admin l'a validée (EN_ATTENTE, puis DISPONIBLE), c'est la
   * réservation elle-même qui est annulée.
   */
  get cancelLabel(): string {
    return this.reservation?.statut === StatutReservation.DEMANDE
      ? this.t.t('reservations.cancel')
      : this.t.t('reservations.cancel.reservation');
  }

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.params['id']);
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.notFound = false;

    this.reservationService.getById(this.id).subscribe({
      next: (data) => {
        this.reservation = data;
        this.loading = false;
        this.loadBookName();
        this.loadUserName();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 404) {
          this.notFound = true;
        } else if (err.status === 403) {
          this.error = err.error?.message || this.t.t('error.reservation.forbidden');
        } else if (err.status === 401) {
          this.error = this.t.t('error.session.expired.detail');
        } else {
          this.error = `${this.t.t('error.status', { status: err.status })} : ${err.error?.message || this.t.t('error.generic.lower')}`;
        }
      }
    });
  }

  private loadBookName(): void {
    if (!this.reservation) return;
    this.booksService.getBookById(this.reservation.bookId).subscribe({
      next: (book) => { this.bookName = book.bookName; },
      error: () => { this.bookName = `Livre #${this.reservation!.bookId}`; }
    });
  }

  private loadUserName(): void {
    if (!this.reservation) return;
    this.usersService.getUserById(this.reservation.userId).subscribe({
      next: (user) => { this.userName = user.name; },
      // La liste des adhérents est Admin-only : repli lisible si non autorisé
      error: () => { this.userName = `Adhérent #${this.reservation!.userId}`; }
    });
  }

  /** Statut badge */
  getStatutLabel(statut: StatutReservation): string {
    const labels: Record<string, string> = {
      'DEMANDE': 'Demande',
      'EN_ATTENTE': this.t.t('status.pending'),
      'DISPONIBLE': this.t.t('status.available'),
      'ANNULEE': this.t.t('status.cancelled'),
      'EXPIREE': this.t.t('status.expired'),
      'HONOREE': this.t.t('status.fulfilled')
    };
    return labels[statut] || statut;
  }

  getStatutClass(statut: StatutReservation): string {
    const classes: Record<string, string> = {
      'DEMANDE': 'status-badge status-en-attente',
      'EN_ATTENTE': 'status-badge status-disponible',
      'DISPONIBLE': 'status-badge status-honoree',
      'ANNULEE': 'status-badge status-annulee',
      'EXPIREE': 'status-badge status-expiree',
      'HONOREE': 'status-badge status-honoree'
    };
    return classes[statut] || 'status-badge status-annulee';
  }

  formatDate(date: any): string {
    if (!date) return '-';
    if (typeof date === 'string' && date.includes('-')) {
      const parts = date.split('-');
      if (parts.length === 3 && parts[0].length === 2) {
        const [day, month, year] = parts;
        return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('fr-FR');
      }
    }
    return new Date(date).toLocaleDateString('fr-FR');
  }

  goBack(): void {
    this.router.navigate(['/reservations']);
  }

  /** Annulation avec confirmation */
  confirmCancel(): void {
    if (!this.reservation || !this.canCancel) return;
    this.reservationService.annuler(this.reservation.id).subscribe({
      next: (updated) => {
        this.reservation = updated;
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.error?.message || "Impossible d'annuler cette réservation.";
      }
    });
  }
}
