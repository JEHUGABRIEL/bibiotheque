import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Books } from '../_model/books';
import { Users } from '../_model/users';
import { Reservation, StatutReservation } from '../_model/reservation';
import { ReservationService } from '../_service/reservation.service';
import { UsersService } from '../_service/users.service';
import { UserAuthService } from '../_service/user-auth.service';
import { TranslationService } from '../_service/translation.service';
import { ToastService } from '../_service/toast.service';
import { NotificationService } from '../_service/notification.service';

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
  /** Nom d'un livre NON enregistré à réserver (backend : création à 0 exemplaire). */
  newBookName: string | null = null;
  selectedUserId: number | null = null;

  // Recherche prédictive du livre (remplace le select)
  bookQuery = '';
  showBookSuggestions = false;
  highlightedIndex = -1;
  hoveredIndex = -1;

  // Cancel confirmation
  showCancelConfirm = false;
  reservationToCancel: Reservation | null = null;
  cancelError: string | null = null;
  cancelSuccess: string | null = null;

  // Accept confirmation (staff : DEMANDE → EN_ATTENTE)
  showAcceptConfirm = false;
  reservationToAccept: Reservation | null = null;

  // Details modal
  showDetailModal = false;
  detailReservation: Reservation | null = null;

  constructor(
    private reservationService: ReservationService,
    private usersService: UsersService,
    private userAuthService: UserAuthService,
    private route: ActivatedRoute,
    public t: TranslationService,
    private toast: ToastService,
    private notifications: NotificationService
  ) { }

  /** Le personnel (BIBLIOTHECAIRE / Admin) peut réserver pour n'importe quel adhérent. */
  get isStaff(): boolean {
    return this.usersService.isStaff();
  }

  /** Identifiant de l'utilisateur connecté (pour le droit d'annulation côté liste). */
  get currentUserId(): number | null {
    return this.userAuthService.getUserId() ?? null;
  }

  ngOnInit() {
    this.loadReservations();
    this.loadBooks();
    this.loadUsers();

    // Arrivée depuis la modale « Détail du livre » : ?reserve=<bookId>
    // ou depuis l'emprunt adhérent : ?reserveName=<nom> (livre inconnu).
    // Les deux ouvrent directement le formulaire avec le livre pré-rempli.
    this.route.queryParamMap.subscribe(params => {
      const reserveId = params.get('reserve');
      if (reserveId) {
        this.pendingReserveId = Number(reserveId);
      }
      const reserveName = params.get('reserveName');
      if (reserveName) {
        this.pendingReserveName = reserveName;
      }
      this.applyPendingReserve();
    });
  }

  /** Id de livre à pré-sélectionner (venant de la modale détail du livre). */
  private pendingReserveId: number | null = null;
  /** Nom d'un livre à pré-remplir (venant de l'emprunt adhérent, livre inconnu). */
  private pendingReserveName: string | null = null;

  /** Applique le pré-remplissage — après le chargement du catalogue si besoin. */
  private applyPendingReserve() {
    if (this.pendingReserveId !== null) {
      const book = this.books.find(b => b.bookId === this.pendingReserveId);
      if (!book) return; // catalogue pas encore chargé : réessayé après loadBooks
      this.openCreateModal();
      this.selectBookSuggestion(book);
      this.pendingReserveId = null;
    } else if (this.pendingReserveName !== null) {
      this.openCreateModal();
      this.selectedBookId = null;
      this.newBookName = this.pendingReserveName;
      this.bookQuery = this.pendingReserveName;
      this.showBookSuggestions = false;
      this.highlightedIndex = -1;
      this.pendingReserveName = null;
    }
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
          this.error = this.t.t('common.serverDown');
        } else {
          this.error = `${this.t.t('error.status', { status: err.status })} : ${err.error?.message || this.t.t('error.generic')}`;
        }
      }
    });
  }

  loadBooks() {
    this.reservationService.getBooksCatalog().subscribe({
      next: (books) => {
        this.books = books;
        books.forEach(b => this.bookNames.set(b.bookId, b.bookName));
        this.applyPendingReserve();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status !== 0) {
          this.toast.error(this.t.t('error.load.books', {
            detail: err.error?.message || this.t.t('error.status', { status: err.status })
          }));
        }
      }
    });
  }

  /** RG-01 : seul un livre indisponible (0 exemplaire) peut être réservé. */
  isBookReservable(book: Books): boolean {
    return (book.noOfCopies ?? 0) <= 0;
  }

  get bookSuggestions(): Books[] {
    const q = this.normalize(this.bookQuery);
    if (!q) return [];
    return this.books
      .filter(b => this.normalize(b.bookName).includes(q))
      .slice(0, 8);
  }

  get canCreateNewBook(): boolean {
    return !this.selectedBookId && !!this.bookQuery.trim();
  }

  /** Bouton + titre de modale : « Nouvelle réservation » (staff) vs « demande » (adhérent). */
  get addLabel(): string {
    return this.t.t(this.isStaff ? 'reservations.add' : 'reservations.add.self');
  }

  get addTitleLabel(): string {
    return this.t.t(this.isStaff ? 'reservations.add.title' : 'reservations.add.title.self');
  }

  get createNewLabel(): string {
    return this.t.t('reservations.select.book.new').replace('{{ q }}', this.bookQuery.trim());
  }

  get createNewHint(): string {
    return this.t.t('reservations.select.book.new.hint');
  }

  private normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  onBookQueryInput(event: Event) {
    this.bookQuery = (event.target as HTMLInputElement).value;
    this.showBookSuggestions = true;
    this.highlightedIndex = -1;
    this.selectedBookId = null;
    this.newBookName = null;
  }

  selectBookSuggestion(book: Books) {
    this.selectedBookId = book.bookId;
    this.newBookName = null;
    this.bookQuery = book.bookName;
    this.showBookSuggestions = false;
    this.highlightedIndex = -1;
  }

  selectNewBook() {
    this.selectedBookId = null;
    this.newBookName = this.bookQuery.trim();
    this.showBookSuggestions = false;
    this.highlightedIndex = -1;
  }

  onUserSelect() {
    // La seule erreur de formulaire posée ici concerne le choix de l'adhérent :
    // dès qu'un adhérent est sélectionné, on l'efface. On ne teste pas le texte
    // du message (il serait traduit et donc instable).
    if (this.selectedUserId !== null) {
      this.formError = null;
    }
  }

  prefillForBook(book: Books) {
    this.showDetailModal = false;
    this.openCreateModal();
    if (this.isBookReservable(book)) {
      this.selectBookSuggestion(book);
    } else {
      this.bookQuery = book.bookName;
      this.showBookSuggestions = true;
    }
  }

  onBookSearchKeydown(event: KeyboardEvent) {
    const suggestions = this.bookSuggestions;
    const maxIndex = suggestions.length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.showBookSuggestions = true;
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, maxIndex);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
        break;
      case 'Enter':
        if (this.highlightedIndex === suggestions.length) {
          event.preventDefault();
          this.selectNewBook();
        } else if (this.highlightedIndex >= 0 && suggestions[this.highlightedIndex]) {
          event.preventDefault();
          this.selectBookSuggestion(suggestions[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        this.showBookSuggestions = false;
        break;
    }
  }

  onBookSearchBlur() {
    setTimeout(() => { this.showBookSuggestions = false; }, 150);
  }

  get reservableBooks(): Books[] {
    return this.books.filter(b => this.isBookReservable(b));
  }

  get nonReservableBooks(): Books[] {
    return this.books.filter(b => !this.isBookReservable(b));
  }

  loadUsers() {
    if (!this.isStaff) {
      return;
    }
    this.usersService.getUsersList().subscribe({
      next: (users) => {
        // Filter out Admin/Bibliothécaire — only show adhérents in the selection list
        this.users = users.filter(u => !this.usersService.isStaffRole(u.role?.[0]?.roleName ?? ''));
        users.forEach(u => this.userNames.set(u.userId, u.name));
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 0) {
          this.toast.error(this.t.t('error.load.members'));
        } else {
          this.toast.error(this.t.t('error.load.members.detail', {
            detail: err.error?.message || this.t.t('error.status', { status: err.status })
          }));
        }
      }
    });
  }

  onFilterChange(statut: StatutReservation | null) {
    this.currentFilter = statut;
    this.loadReservations();
  }

  openDetails(reservation: Reservation) {
    this.detailReservation = reservation;
    this.showDetailModal = true;
  }

  get canCancelDetail(): boolean {
    const r = this.detailReservation;
    if (!r) return false;
    const statutOk = r.statut === StatutReservation.DEMANDE
      || r.statut === StatutReservation.EN_ATTENTE
      || r.statut === StatutReservation.DISPONIBLE;
    return statutOk && (this.isStaff || r.userId === this.currentUserId);
  }

  /**
   * Libellé d'annulation, piloté par le STATUT et non par le rôle :
   * DEMANDE = la demande n'est pas encore validée par le personnel ;
   * EN_ATTENTE (validée par l'admin) ou DISPONIBLE = c'est la réservation
   * elle-même qui est annulée.
   */
  cancelLabelFor(reservation: Reservation | null): string {
    return reservation?.statut === StatutReservation.DEMANDE
      ? this.t.t('reservations.cancel')
      : this.t.t('reservations.cancel.reservation');
  }

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

  onRetry() {
    this.loadReservations();
  }

  openCreateModal() {
    this.selectedBookId = null;
    this.newBookName = null;
    this.selectedUserId = null;
    this.bookQuery = '';
    this.showBookSuggestions = false;
    this.highlightedIndex = -1;
    this.hoveredIndex = -1;
    this.formError = null;
    this.formSuccess = null;
    this.showCreateModal = true;
  }

  get isFormValid(): boolean {
    const bookOk = this.selectedBookId !== null || !!this.newBookName?.trim();
    if (!bookOk) return false;
    return this.isStaff ? this.selectedUserId !== null : true;
  }

  onSubmitReservation() {
    if (!this.isFormValid) {
      if (this.isStaff && this.selectedUserId === null) {
        this.formError = this.t.t('error.select.member');
      }
      return;
    }
    this.formSubmitting = true;
    this.formError = null;
    this.formSuccess = null;

    const reservation = new Reservation();
    if (this.selectedBookId !== null) {
      reservation.bookId = this.selectedBookId;
    } else {
      reservation.newBookName = this.newBookName!.trim();
    }
    if (this.isStaff) {
      reservation.userId = this.selectedUserId!;
    }

    this.reservationService.create(reservation).subscribe({
      next: (created) => {
        this.formSubmitting = false;
        const expiry = created?.dateExpiration
          ? ' ' + this.t.t('toast.reservation.expires', { date: this.formatDate(created.dateExpiration) })
          : '';
        if (created?.statut === 'DEMANDE') {
          this.toast.info(this.t.t('toast.reservation.requested') + expiry);
        } else {
          this.toast.success(this.t.t('toast.reservation.created') + expiry);
        }
        this.loadReservations();
        this.showCreateModal = false;
      },
      error: (err: HttpErrorResponse) => {
        this.formSubmitting = false;
        this.toast.error(this.extractErrorMessage(err));
      }
    });
  }

  canCancelReservation(reservation: Reservation): boolean {
    const statutOk = reservation.statut === StatutReservation.DEMANDE
      || reservation.statut === StatutReservation.EN_ATTENTE
      || reservation.statut === StatutReservation.DISPONIBLE;
    if (!statutOk) return false;
    if (this.isStaff) return true;
    return reservation.userId === this.userAuthService.getUserId();
  }

  // --- Acceptation d'une demande (staff) ---
  openAcceptConfirm(reservation: Reservation) {
    this.reservationToAccept = reservation;
    this.showAcceptConfirm = true;
  }

  confirmAccept() {
    if (!this.reservationToAccept) return;
    const id = this.reservationToAccept.id;
    const bookName = this.bookNames.get(this.reservationToAccept.bookId) || this.t.t('common.this.book');

    this.reservationService.accepter(id).subscribe({
      next: (updated) => {
        const index = this.reservations.findIndex(r => r.id === updated.id);
        if (index >= 0) {
          this.reservations[index] = updated;
        }
        this.toast.success(this.t.t('toast.reservation.accepted', { name: bookName }));
        this.showAcceptConfirm = false;
        this.reservationToAccept = null;
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.extractErrorMessage(err));
        this.showAcceptConfirm = false;
        this.reservationToAccept = null;
      }
    });
  }

  /** Message de la modale d'acceptation (staff) — construit avec les noms résolus. */
  get acceptMessage(): string {
    if (!this.reservationToAccept) return '';
    const book = this.bookNames.get(this.reservationToAccept.bookId) || this.t.t('common.this.book');
    const who = this.userNames.get(this.reservationToAccept.userId) || this.t.t('common.this.member');
    return this.t.t('reservations.accept.message', { book, who });
  }

  acceptModalClose() {
    this.showAcceptConfirm = false;
    this.reservationToAccept = null;
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
    const bookName = this.bookNames.get(this.reservationToCancel.bookId) || this.t.t('common.this.book');

    this.reservationService.annuler(id).subscribe({
      next: (updated) => {
        // Annulation faite PAR l'adhérent : la cloche ne doit pas la compter comme un refus.
        if (!this.isStaff) {
          this.notifications.markSelfCancelled('res-' + id);
        }
        const index = this.reservations.findIndex(r => r.id === updated.id);
        if (index >= 0) {
          this.reservations[index] = updated;
        }
        this.toast.success(this.t.t('toast.reservation.cancelled', { name: bookName }));
        this.showCancelConfirm = false;
        this.reservationToCancel = null;
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.extractErrorMessage(err));
        this.showCancelConfirm = false;
        this.reservationToCancel = null;
      }
    });
  }

  cancelModalClose() {
    this.showCancelConfirm = false;
    this.reservationToCancel = null;
    this.cancelError = null;
    this.cancelSuccess = null;
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return this.t.t('common.serverDown');
    }
    if (err.error?.message) {
      if (err.status === 401) {
        return err.error.expired
          ? err.error.message + ' ' + this.t.t('error.session.retry')
          : this.t.t('error.session.invalid');
      }
      return err.error.message;
    }
    switch (err.status) {
      case 400: return this.t.t('error.status.badRequest');
      case 401: return this.t.t('error.auth.required');
      case 403: return this.t.t('error.forbidden.action');
      case 404: return this.t.t('error.notFound');
      case 409: return this.t.t('error.conflict');
      case 500: return this.t.t('error.server');
      default: return this.t.t('error.unexpected', { status: err.status });
    }
  }

  onErrorRetry(): void {
    this.onRetry();
  }
}
