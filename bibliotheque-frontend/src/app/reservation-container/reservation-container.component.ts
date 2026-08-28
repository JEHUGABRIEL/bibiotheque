import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Books } from '../_model/books';
import { Users } from '../_model/users';
import { Reservation, StatutReservation } from '../_model/reservation';
import { ReservationService } from '../_service/reservation.service';
import { BooksService } from '../_service/books.service';
import { UsersService } from '../_service/users.service';

@Component({
  selector: 'app-reservation-container',
  templateUrl: './reservation-container.component.html',
  styleUrls: ['./reservation-container.component.css']
})
export class ReservationContainerComponent implements OnInit {

  reservations: Reservation[] = [];
  books: Books[] = [];
  users: Users[] = [];
  bookNames = new Map<number, string>();
  userNames = new Map<number, string>();

  loading = false;
  error: string | null = null;
  currentFilter: StatutReservation | null = null;

  // Create form
  showCreateModal = false;
  formSubmitting = false;
  formError: string | null = null;
  formSuccess: string | null = null;
  selectedBookId: number | null = null;
  selectedUserId: number | null = null;

  // Cancel confirmation
  showCancelConfirm = false;
  reservationToCancel: Reservation | null = null;
  cancelError: string | null = null;
  cancelSuccess: string | null = null;

  constructor(
    private reservationService: ReservationService,
    private booksService: BooksService,
    private usersService: UsersService
  ) { }

  ngOnInit() {
    this.loadReservations();
    this.loadBooks();
    this.loadUsers();
  }

  loadReservations() {
    this.loading = true;
    this.error = null;

    const request = this.currentFilter
      ? this.reservationService.getByStatut(this.currentFilter)
      : this.reservationService.getAll();

    request.subscribe({
      next: (data) => {
        this.reservations = data;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 0) {
          this.error = 'Le serveur est injoignable. Vérifiez que le backend est démarré.';
        } else {
          this.error = `Erreur ${err.status} : ${err.error?.message || 'Une erreur est survenue'}`;
        }
      }
    });
  }

  loadBooks() {
    this.booksService.getBooksList().subscribe({
      next: (books) => {
        // Règle : seuls les livres indisponibles (0 copies) peuvent être réservés
        this.books = books.filter(b => b.noOfCopies <= 0);
        books.forEach(b => this.bookNames.set(b.bookId, b.bookName));
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 0) {
          this.formError = 'Impossible de charger les livres. Le serveur est injoignable.';
        } else {
          this.formError = `Erreur lors du chargement des livres : ${err.error?.message || 'Erreur ' + err.status}`;
        }
      }
    });
  }

  loadUsers() {
    this.usersService.getUsersList().subscribe({
      next: (users) => {
        this.users = users;
        users.forEach(u => this.userNames.set(u.userId, u.name));
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 0) {
          this.formError = 'Impossible de charger les adhérents. Le serveur est injoignable.';
        } else {
          this.formError = `Erreur lors du chargement des adhérents : ${err.error?.message || 'Erreur ' + err.status}`;
        }
      }
    });
  }

  onFilterChange(statut: StatutReservation | null) {
    this.currentFilter = statut;
    this.loadReservations();
  }

  onRetry() {
    this.loadReservations();
  }

  openCreateModal() {
    this.selectedBookId = null;
    this.selectedUserId = null;
    this.formError = null;
    this.formSuccess = null;
    this.showCreateModal = true;
  }

  get isFormValid(): boolean {
    return this.selectedBookId !== null && this.selectedUserId !== null;
  }

  onSubmitReservation() {
    if (!this.isFormValid) return;
    this.formSubmitting = true;
    this.formError = null;
    this.formSuccess = null;

    const reservation = new Reservation();
    reservation.bookId = this.selectedBookId!;
    reservation.userId = this.selectedUserId!;

    this.reservationService.create(reservation).subscribe({
      next: () => {
        this.formSubmitting = false;
        this.formSuccess = 'Réservation créée avec succès';
        this.loadReservations();
        setTimeout(() => {
          this.showCreateModal = false;
          this.formSuccess = null;
        }, 1200);
      },
      error: (err: HttpErrorResponse) => {
        this.formSubmitting = false;
        this.formError = this.extractErrorMessage(err);
      }
    });
  }

  // --- Cancel confirmation ---
  openCancelConfirm(reservation: Reservation) {
    this.reservationToCancel = reservation;
    this.cancelError = null;
    this.cancelSuccess = null;
    this.showCancelConfirm = true;
  }

  confirmCancel() {
    if (!this.reservationToCancel) return;
    const id = this.reservationToCancel.id;
    const bookName = this.bookNames.get(this.reservationToCancel.bookId) || ' ce livre';

    this.reservationService.annuler(id).subscribe({
      next: (updated) => {
        const index = this.reservations.findIndex(r => r.id === updated.id);
        if (index >= 0) {
          this.reservations[index] = updated;
        }
        this.cancelSuccess = 'Réservation pour « ' + bookName + ' » annulée avec succès';
        this.cancelError = null;
        setTimeout(() => {
          this.showCancelConfirm = false;
          this.cancelSuccess = null;
        }, 1200);
      },
      error: (err: HttpErrorResponse) => {
        this.cancelError = this.extractErrorMessage(err);
        this.cancelSuccess = null;
      }
    });
  }

  cancelModalClose() {
    this.showCancelConfirm = false;
    this.reservationToCancel = null;
    this.cancelError = null;
    this.cancelSuccess = null;
  }

  /**
   * Extrait un message lisible depuis une HttpErrorResponse.
   * Gère tous les cas : 400, 404, 409, 500, réseau.
   */
  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Le serveur est injoignable. Vérifiez que le backend est démarré.';
    }
    if (err.error?.message) {
      return err.error.message;
    }
    switch (err.status) {
      case 400: return 'Les données envoyées sont invalides. Vérifiez les champs du formulaire.';
      case 404: return 'La ressource demandée est introuvable.';
      case 409: return 'Conflit : cette opération ne peut pas être effectuée dans l\'état actuel.';
      case 500: return 'Erreur interne du serveur. Veuillez réessayer.';
      default: return 'Erreur ' + err.status + ' : une erreur inattendue est survenue.';
    }
  }
}
