import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Books } from '../_model/books';
import { Users } from '../_model/users';
import { Reservation, StatutReservation } from '../_model/reservation';
import { ReservationService } from '../_service/reservation.service';
import { UsersService } from '../_service/users.service';
import { UserAuthService } from '../_service/user-auth.service';import { TranslationService } from '../_service/translation.service';

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

  // Details modal
  showDetailModal = false;
  detailReservation: Reservation | null = null;

  constructor(
    private reservationService: ReservationService,
    private usersService: UsersService,
    private userAuthService: UserAuthService,
    private route: ActivatedRoute,
    public t: TranslationService
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
    // ouvre directement le formulaire avec le livre pré-sélectionné.
    this.route.queryParamMap.subscribe(params => {
      const reserveId = params.get('reserve');
      if (reserveId) {
        this.pendingReserveId = Number(reserveId);
        this.applyPendingReserve();
      }
    });
  }

  /** Id de livre à pré-sélectionner (venant de la modale détail du livre). */
  private pendingReserveId: number | null = null;

  /** Applique le pré-remplissage — après le chargement du catalogue si besoin. */
  private applyPendingReserve() {
    if (this.pendingReserveId === null) return;
    const book = this.books.find(b => b.bookId === this.pendingReserveId);
    if (!book) return; // catalogue pas encore chargé : réessayé après loadBooks
    this.openCreateModal();
    this.selectBookSuggestion(book);
    this.pendingReserveId = null;
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
    this.reservationService.getBooksCatalog().subscribe({
      next: (books) => {
        // On garde TOUS les livres : les indisponibles (0 exemplaire) sont
        // sélectionnables, les disponibles sont désactivés (RG-01).
        // Un filtre dur ici laissait le modal vide dès que tous les livres
        // avaient des exemplaires — semblait un échec de chargement.
        this.books = books;
        books.forEach(b => this.bookNames.set(b.bookId, b.bookName));
        this.applyPendingReserve();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status !== 0) {
          this.formError = `Erreur lors du chargement des livres : ${err.error?.message || 'Erreur ' + err.status}`;
        }
      }
    });
  }

  /** RG-01 : seul un livre indisponible (0 exemplaire) peut être réservé. */
  isBookReservable(book: Books): boolean {
    return (book.noOfCopies ?? 0) <= 0;
  }

  /**
   * Suggestions de la recherche prédictive — tous les livres du catalogue
   * dont le nom contient la requête (insensible à la casse/accents).
   * Pourquoi tous : n'afficher que les 0 exemplaire donnait une liste vide
   * (et un formulaire sans réaction) tant que tous les livres étaient en rayon.
   * Les suggestions marquent quand même ce qui est réellement réservable.
   */
  get bookSuggestions(): Books[] {
    const q = this.normalize(this.bookQuery);
    if (!q) return [];
    return this.books
      .filter(b => this.normalize(b.bookName).includes(q))
      .slice(0, 8);
  }

  /** Une option « créer ce livre » si la requête ne correspond à aucun titre. */
  get canCreateNewBook(): boolean {
    return !this.selectedBookId && !!this.bookQuery.trim();
  }

  /** Libellé de l'option « créer ce livre » (traduit, requête interpolée). */
  get createNewLabel(): string {
    return this.t.t('reservations.select.book.new').replace('{{ q }}', this.bookQuery.trim());
  }

  /** Aide contextuelle de l'option « créer ce livre ». */
  get createNewHint(): string {
    return this.t.t('reservations.select.book.new.hint');
  }

  /** Minuscules + sans accents, pour une recherche tolérante. */
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

  /** Réserver un livre qui n'existe pas encore dans le catalogue. */
  selectNewBook() {
    this.selectedBookId = null;
    this.newBookName = this.bookQuery.trim();
    this.showBookSuggestions = false;
    this.highlightedIndex = -1;
  }

  /** Pré-remplit le formulaire pour un livre donné (depuis la modale de détail). */
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
    // La dernière position « virtuelle » est l'option « créer ce livre »
    const maxIndex = suggestions.length; // = index de l'option de création
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
    // Délai : laisser le (mousedown) des suggestions s'exécuter avant de fermer.
    setTimeout(() => { this.showBookSuggestions = false; }, 150);
  }

  get reservableBooks(): Books[] {
    return this.books.filter(b => this.isBookReservable(b));
  }

  get nonReservableBooks(): Books[] {
    return this.books.filter(b => !this.isBookReservable(b));
  }

  /** Liste des adhérents — endpoint Admin, réservé au personnel. */
  loadUsers() {
    if (!this.isStaff) {
      return; // un adhérent n'a pas besoin de la liste : le backend force userId de toute façon (RS-04)
    }
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

  /** Détails en modale — plus de navigation vers une page séparée. */
  openDetails(reservation: Reservation) {
    this.detailReservation = reservation;
    this.showDetailModal = true;
  }

  /** Le compte connecté peut-il annuler la réservation affichée en modale ? */
  get canCancelDetail(): boolean {
    const r = this.detailReservation;
    if (!r) return false;
    const statutOk = r.statut === StatutReservation.EN_ATTENTE || r.statut === StatutReservation.DISPONIBLE;
    return statutOk && (this.isStaff || r.userId === this.currentUserId);
  }

  /** Libellé traduit du statut (miroir de la liste, pour la modale de détail). */
  getStatutLabel(statut: StatutReservation): string {
    const labels: Record<string, string> = {
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
      'EN_ATTENTE': 'status-badge status-en-attente',
      'DISPONIBLE': 'status-badge status-disponible',
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
    // Livre existant sélectionné OU nom de nouveau livre saisi
    const bookOk = this.selectedBookId !== null || !!this.newBookName?.trim();
    if (!bookOk) return false;
    // Un adhérent ne choisit pas l'adhérent : le backend impose son identité (RS-04)
    return this.isStaff ? this.selectedUserId !== null : true;
  }

  onSubmitReservation() {
    if (!this.isFormValid) return;
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
    // Pour un ADHERENT, pas de userId dans le corps : le backend écrase/force
    // l'identité depuis le token JWT (RS-04).

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

  /** Peut-on annuler la réservation donnée ? (statut + propriété ou personnel) */
  canCancelReservation(reservation: Reservation): boolean {
    const statutOk = reservation.statut === StatutReservation.EN_ATTENTE
      || reservation.statut === StatutReservation.DISPONIBLE;
    if (!statutOk) return false;
    if (this.isStaff) return true;
    return reservation.userId === this.userAuthService.getUserId();
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
   * Gère tous les cas : 400, 401, 403, 404, 409, 500, réseau.
   */
  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Le serveur est injoignable. Vérifiez que le backend est démarré.';
    }
    if (err.error?.message) {
      // 401 spécifique : proposer la reconnexion (session expirée ou invalide)
      if (err.status === 401) {
        return err.error.expired
          ? err.error.message + ' Cliquez sur Réessayer pour vous reconnecter.'
          : 'Session invalide. Reconnectez-vous pour continuer.';
      }
      return err.error.message;
    }
    switch (err.status) {
      case 400: return 'Les données envoyées sont invalides. Vérifiez les champs du formulaire.';
      case 401: return 'Authentification requise. Veuillez vous reconnecter.';
      case 403: return "Accès refusé : vous n'avez pas les droits nécessaires pour cette action.";
      case 404: return 'La ressource demandée est introuvable.';
      case 409: return 'Conflit : cette opération ne peut pas être effectuée dans l\'état actuel.';
      case 500: return 'Erreur interne du serveur. Veuillez réessayer.';
      default: return 'Erreur ' + err.status + ' : une erreur inattendue est survenue.';
    }
  }

  /** Sur une erreur de CHARGEMENT 401 : proposer la reconnexion plutôt qu'un simple retry. */
  onErrorRetry(): void {
    this.onRetry();
  }
}
