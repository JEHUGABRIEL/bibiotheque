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

  showCreateModal = false;
  formSubmitting = false;
  formError: string | null = null;
  formSuccess: string | null = null;
  selectedBookId: number | null = null;
  selectedUserId: number | null = null;

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
        this.books = books;
        books.forEach(b => this.bookNames.set(b.bookId, b.bookName));
      },
      error: () => {}
    });
  }

  loadUsers() {
    this.usersService.getUsersList().subscribe({
      next: (users) => {
        this.users = users;
        users.forEach(u => this.userNames.set(u.userId, u.name));
      },
      error: () => {}
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
        if (err.status === 0) {
          this.formError = 'Le serveur est injoignable.';
        } else if (err.error?.message) {
          this.formError = err.error.message;
        } else {
          this.formError = `Erreur ${err.status} : une erreur est survenue`;
        }
      }
    });
  }

  onCancelReservation(reservation: Reservation) {
    const confirmed = confirm('Voulez-vous vraiment annuler cette réservation ?');
    if (!confirmed) return;

    this.reservationService.annuler(reservation.id).subscribe({
      next: (updated) => {
        const index = this.reservations.findIndex(r => r.id === updated.id);
        if (index >= 0) {
          this.reservations[index] = updated;
        }
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message || `Erreur ${err.status}`;
        alert(msg);
      }
    });
  }
}
