import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Books } from '../_model/books';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { Users } from '../_model/users';
import { BooksService } from '../_service/books.service';
import { BorrowService } from '../_service/borrow.service';
import { UserAuthService } from '../_service/user-auth.service';
import { UsersService } from '../_service/users.service';
import { TranslationService } from '../_service/translation.service';
import { ToastService } from '../_service/toast.service';

@Component({
  selector: 'app-borrow-book',
  templateUrl: './borrow-book.component.html',
  styleUrls: ['./borrow-book.component.css']
})
export class BorrowBookComponent implements OnInit {

  books: Books[] = [];
  /** Catalogue complet (y compris 0 exemplaire) pour la recherche prédictive. */
  allBooks: Books[] = [];
  loading = false;
  bookNames = new Map<number, string>();
  userNames = new Map<number, string>();

  // Quota info for adherent
  activeBorrowCount = 0;
  maxQuota = 3;
  remainingQuota = 3;
  // IDs des livres déjà empruntés/en attente par l'adhérent
  borrowedBookIds = new Set<number>();

  // Formulaire « Nouvel emprunt »
  showBorrowModal = false;
  formSubmitting = false;
  formError: string | null = null;
  users: Users[] = [];
  modalSelectedUserId: number | null = null;
  modalSelectedBookId: number | null = null;

  // Recherche prédictive du livre (interface adhérent)
  adherentBookQuery = '';
  showBookSuggestions = false;
  highlightedIndex = -1;
  hoveredIndex = -1;

  // Gestion des emprunts existants (Admin)
  allBorrows: Borrow[] = [];
  usersReady = false;
  private bookIdToPrefill: number | null = null;

  // Pagination (emprunts) + filtre par statut
  borrowPage = 1;
  borrowPageSize = 10;
  statutFilter: StatutBorrow | null = null;

  /** Liste filtrée par statut (le filtre remplace l'ancien titre « Tous les emprunts »). */
  get filteredBorrows(): Borrow[] {
    return this.statutFilter
      ? this.allBorrows.filter(b => b.statut === this.statutFilter)
      : this.allBorrows;
  }

  onStatutFilterChange() {
    this.borrowPage = 1;
  }

  get statuts(): StatutBorrow[] {
    return Object.values(StatutBorrow);
  }

  // ==================== Demandes d'emprunt (EN_ATTENTE) ====================
  /** Section repliée par défaut — même logique que les demandes de réservation (filtre DEMANDE). */
  showRequests = false;
  requestsPage = 1;
  requestsPageSize = 5;

  /** Les demandes en attente de décision du personnel. */
  get pendingRequests(): Borrow[] {
    return this.allBorrows.filter(b => b.statut === StatutBorrow.EN_ATTENTE);
  }

  get paginatedRequests(): Borrow[] {
    const page = Math.min(this.requestsPage, this.requestsTotalPages);
    const start = (page - 1) * this.requestsPageSize;
    return this.pendingRequests.slice(start, start + this.requestsPageSize);
  }

  get requestsTotalPages(): number {
    return Math.max(1, Math.ceil(this.pendingRequests.length / this.requestsPageSize));
  }

  get requestsPageNumbers(): number[] {
    return Array.from({ length: this.requestsTotalPages }, (_, i) => i + 1);
  }

  toggleRequests(): void {
    this.showRequests = !this.showRequests;
    this.requestsPage = 1;
  }

  goToRequestsPage(page: number): void {
    if (page >= 1 && page <= this.requestsTotalPages) {
      this.requestsPage = page;
    }
  }

  get paginatedBorrows(): Borrow[] {
    const start = (this.borrowPage - 1) * this.borrowPageSize;
    return this.filteredBorrows.slice(start, start + this.borrowPageSize);
  }

  get borrowTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBorrows.length / this.borrowPageSize));
  }

  get borrowPageNumbers(): number[] {
    return Array.from({ length: this.borrowTotalPages }, (_, i) => i + 1);
  }

  goToBorrowPage(page: number) {
    if (page >= 1 && page <= this.borrowTotalPages) {
      this.borrowPage = page;
    }
  }

  // Refus / suppression
  refuseBorrowId: number | null = null;
  showDeleteConfirm = false;
  /** Confirmation simple (sans saisie) pour les emprunts rendus/refusés. */
  showSimpleDeleteConfirm = false;
  borrowToDelete: Borrow | null = null;
  deleteBookName = '';
  deleteLoading = false;

  // Validation / retour (confirmation avant action)
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = 'Confirmer';
  confirmIconBg = 'linear-gradient(135deg, #2fbf71, #7bd88f)';
  confirmDanger = false;
  private confirmAction: (() => void) | null = null;
  confirmLoading = false;

  // Détails d'un emprunt
  showDetailModal = false;
  detailBorrow: Borrow | null = null;

  get isAdmin(): boolean {
    return this.usersService.roleMatch(['Admin']);
  }

  /** Nom du livre pour la modale de suppression (tapez-le nom exact). */
  getBookNameFor(bookId: number | undefined): string {
    return bookId !== null && bookId !== undefined
      ? (this.bookNames.get(bookId) || 'Livre #' + bookId)
      : '';
  }

  get isDeleteInputValid(): boolean {
    return !!this.borrowToDelete
      && this.deleteBookName.trim() === this.getBookNameFor(this.borrowToDelete.bookId);
  }

  get deleteMessage(): string {
    if (!this.borrowToDelete) return '';
    const bookName = this.getBookNameFor(this.borrowToDelete.bookId);
    return `Voulez-vous vraiment supprimer cet emprunt (livre « ${bookName} ») ? Cette action est irréversible.<br><br><em>Tapez le nom exact du livre pour confirmer :</em>`;
  }

  /** Tous les emprunts pour la table admin (noms résolus). */
  private getAllBorrows() {
    this.borrowService.getBorrowList().subscribe({
      next: (data) => {
        // Dédoublonnage défensif : des doublons réels existent en base
        // (rafraîchissements pendant le développement), ne pas les compter 2x.
        const seen = new Set<number>();
        this.allBorrows = data.filter(b => {
          if (b.borrowId == null || seen.has(b.borrowId)) return false;
          seen.add(b.borrowId);
          return true;
        });
      },
      error: () => {}
    });
  }

  constructor(
    private booksService: BooksService,
    private userAuthService: UserAuthService,
    private usersService: UsersService,
    private borrowService: BorrowService,
    private route: ActivatedRoute,
    private router: Router,
    public t: TranslationService,
    private toast: ToastService
  ) { }

  userId = this.userAuthService.getUserId();

  get isStaff(): boolean {
    return this.usersService.isStaff();
  }

  ngOnInit(): void {
    this.getBooks();
    if (this.isStaff) {
      // Noms + liste des adhérents (déclenche aussi la liste des emprunts)
      this.loadUsers();
    } else {
      this.loadMyQuota();
    }
    // ?book=<id> — pré-sélection du livre (depuis la modale « détail du livre »)
    this.route.queryParamMap.subscribe(params => {
      const b = params.get('book');
      if (b) {
        this.bookIdToPrefill = Number(b);
        this.applyBookPrefill();
      }
    });
  }

  /** Applique le pré-remplissage du livre une fois le catalogue chargé. */
  private applyBookPrefill() {
    if (this.bookIdToPrefill === null) return;
    const book = this.books.find(x => x.bookId === this.bookIdToPrefill);
    if (!book) return; // catalogue pas encore chargé : retenté après getBooks()
    this.openBorrowModal();
    this.modalSelectedBookId = book.bookId;
    this.adherentBookQuery = book.bookName;
    this.bookIdToPrefill = null;
  }

  private loadUsers() {
    this.usersService.getUsersList().subscribe({
      next: (users) => {
        this.users = users.filter(u => !this.usersService.isStaffRole(u.role?.[0]?.roleName ?? ''));
        users.forEach(u => this.userNames.set(u.userId, u.name));
        this.usersReady = true;
        if (this.isStaff) {
          this.getAllBorrows();
        }
      },
      error: () => {}
    });
  }

  /** « Nouvel emprunt » : ouvre le formulaire. */
  openBorrowModal(): void {
    this.modalSelectedUserId = null;
    this.modalSelectedBookId = null;
    this.adherentBookQuery = '';
    this.showBookSuggestions = false;
    this.highlightedIndex = -1;
    this.hoveredIndex = -1;
    this.formError = null;
    this.showBorrowModal = true;
  }

  closeBorrowModal(): void {
    this.showBorrowModal = false;
  }

  get isBorrowFormValid(): boolean {
    if (this.modalSelectedBookId === null) return false;
    if (this.isStaff) return this.modalSelectedUserId !== null;
    if (this.quotaReached) return false;
    // Adhérent : le livre sélectionné doit être réellement empruntable
    return this.selectedBookCopies > 0 && !this.isBookAlreadyBorrowed(this.modalSelectedBookId);
  }

  /** Exemplaires du livre sélectionné (0 si introuvable ou indisponible). */
  get selectedBookCopies(): number {
    const book = this.allBooks.find(b => b.bookId === this.modalSelectedBookId);
    return book ? (book.noOfCopies ?? 0) : 0;
  }

  // ==================== Recherche prédictive du livre (adhérent) ====================

  private normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Suggestions du catalogue pour le texte tapé (hors livres déjà empruntés). */
  get adherentSuggestions(): Books[] {
    const q = this.normalize(this.adherentBookQuery);
    if (!q) return [];
    return this.allBooks
      .filter(b => this.normalize(b.bookName).includes(q))
      .filter(b => !this.isBookAlreadyBorrowed(b.bookId))
      .slice(0, 8);
  }

  /** Livre sélectionné mais sans exemplaire → proposer la réservation. */
  get unavailableBook(): Books | null {
    if (this.isStaff || this.modalSelectedBookId === null) return null;
    const book = this.allBooks.find(b => b.bookId === this.modalSelectedBookId);
    return book && (book.noOfCopies ?? 0) <= 0 ? book : null;
  }

  /** Texte tapé ne correspondant à aucun livre du catalogue. */
  get unknownBookQuery(): string | null {
    if (this.isStaff || this.modalSelectedBookId !== null) return null;
    const q = this.adherentBookQuery.trim();
    return q.length > 0 && this.adherentSuggestions.length === 0 ? q : null;
  }

  onAdherentBookInput(event: Event) {
    this.adherentBookQuery = (event.target as HTMLInputElement).value;
    this.showBookSuggestions = true;
    this.highlightedIndex = -1;
    this.modalSelectedBookId = null;
  }

  selectAdherentBook(book: Books) {
    this.modalSelectedBookId = book.bookId;
    this.adherentBookQuery = book.bookName;
    this.showBookSuggestions = false;
    this.highlightedIndex = -1;
  }

  onAdherentBookKeydown(event: KeyboardEvent) {
    const suggestions = this.adherentSuggestions;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.showBookSuggestions = true;
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, suggestions.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
        break;
      case 'Enter':
        if (this.highlightedIndex >= 0 && suggestions[this.highlightedIndex]) {
          event.preventDefault();
          this.selectAdherentBook(suggestions[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        this.showBookSuggestions = false;
        break;
    }
  }

  onAdherentBookBlur() {
    setTimeout(() => { this.showBookSuggestions = false; }, 150);
  }

  /** Livre indisponible/inconnu : redirige vers la réservation avec pré-remplissage. */
  goReserveBook(): void {
    const unavailable = this.unavailableBook;
    if (unavailable) {
      this.router.navigate(['/reservations'], { queryParams: { reserve: unavailable.bookId } });
    } else if (this.unknownBookQuery) {
      this.router.navigate(['/reservations'], { queryParams: { reserveName: this.unknownBookQuery } });
    }
  }

  submitBorrow(): void {
    if (!this.isBorrowFormValid || this.formSubmitting) {
      return;
    }
    this.formSubmitting = true;
    this.formError = null;

    const borrow = new Borrow();
    borrow.bookId = this.modalSelectedBookId!;
    if (this.isStaff) {
      // Le personnel emprunte pour n'importe quel adhérent (validé immédiat)
      borrow.userId = this.modalSelectedUserId!;
    }
    // Adhérent : pas d'userId dans le corps — le backend le prend du token (RS-04)

    this.borrowService.borrowBook(borrow).subscribe({
      next: (data: any) => {
        this.formSubmitting = false;
        if (this.isStaff) {
          this.toast.success(data.message || 'Emprunt effectué avec succès');
        } else {
          this.toast.info(data.message || 'Votre demande a été enregistrée. Le bibliothécaire la traitera dans les plus brefs délais.');
          this.loadMyQuota();
        }
        this.closeBorrowModal();
        this.getBooks();
      },
      error: (err: HttpErrorResponse) => {
        this.formSubmitting = false;
        this.formError = this.extractErrorMessage(err);
      }
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Le serveur est injoignable. Vérifiez que le backend est démarré.';
    }
    if (err.error?.message) {
      return err.error.message;
    }
    return 'Erreur ' + err.status + ' : impossible d\'effectuer l\'emprunt.';
  }

  private loadMyQuota() {
    this.borrowService.getMyQuota().subscribe({
      next: (quota) => {
        this.activeBorrowCount = quota.activeCount;
        this.maxQuota = quota.maxQuota;
        this.remainingQuota = quota.remaining;
      },
      error: () => {}
    });
    // Also load user's borrows to know which books are already borrowed
    this.borrowService.getBooksBorrowedByUser(this.userId).subscribe({
      next: (borrows) => {
        borrows.filter(b => b.statut === StatutBorrow.EN_ATTENTE || b.statut === StatutBorrow.VALIDEE)
               .forEach(b => this.borrowedBookIds.add(b.bookId));
      },
      error: () => {}
    });
  }

  private getBooks() {
    this.loading = true;
    this.booksService.getBooksList().subscribe({
      next: (data) => {
        this.allBooks = data;
        this.books = data.filter(b => b.noOfCopies > 0);
        data.forEach(b => this.bookNames.set(b.bookId, b.bookName));
        this.loading = false;
        this.applyBookPrefill();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openDeleteConfirm(borrow: Borrow) {
    this.borrowToDelete = borrow;
    this.deleteBookName = '';
    // Emprunt « clos » (rendu ou refusé) : confirmation simple, sans saisie du nom.
    // La saisie du nom du livre reste réservée aux emprunts en cours (VALIDEE non rendu)
    // et aux demandes EN_ATTENTE, où la suppression est réellement risquée.
    if (borrow.statut === StatutBorrow.RENDU || borrow.statut === StatutBorrow.REFUSEE) {
      this.showSimpleDeleteConfirm = true;
    } else {
      this.showDeleteConfirm = true;
    }
  }

  confirmSimpleDeleteBorrow() {
    if (!this.borrowToDelete || this.deleteLoading) return;
    const id = this.borrowToDelete.borrowId;
    this.deleteLoading = true;
    this.borrowService.deleteBorrow(id!).subscribe({
      next: (data: any) => {
        this.deleteLoading = false;
        this.toast.success(data.message || 'Emprunt supprimé avec succès');
        this.cancelDelete();
        this.getAllBorrows();
      },
      error: (err: HttpErrorResponse) => {
        this.deleteLoading = false;
        this.toast.error(err.error?.message || 'Erreur lors de la suppression');
      }
    });
  }

  confirmDeleteBorrow() {
    if (!this.borrowToDelete || !this.isDeleteInputValid || this.deleteLoading) return;
    const id = this.borrowToDelete.borrowId;
    this.deleteLoading = true;
    this.borrowService.deleteBorrow(id!).subscribe({
      next: (data: any) => {
        this.deleteLoading = false;
        this.toast.success(data.message || 'Emprunt supprimé avec succès');
        this.cancelDelete();
        this.getAllBorrows();
      },
      error: (err: HttpErrorResponse) => {
        this.deleteLoading = false;
        this.toast.error(err.error?.message || 'Erreur lors de la suppression');
      }
    });
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
    this.showSimpleDeleteConfirm = false;
    this.borrowToDelete = null;
    this.deleteBookName = '';
  }

  // ==================== Modale de confirmation générique ====================

  /** Ouvre la modale de confirmation et mémorise l'action à exécuter. */
  private openConfirm(title: string, message: string, iconBg: string, action: () => void, danger = false, label = 'Confirmer') {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmIconBg = iconBg;
    this.confirmDanger = danger;
    this.confirmLabel = label;
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  onConfirmModalConfirm() {
    if (this.confirmLoading) return;
    this.confirmLoading = true;
    this.confirmAction?.();
  }

  onConfirmModalClose() {
    this.showConfirmModal = false;
    this.confirmAction = null;
    this.confirmLoading = false;
  }

  /** Valider une demande EN_ATTENTE (confirm = VALIDEE, décrémente les exemplaires). */
  openValidateConfirm(borrow: Borrow) {
    const who = this.getUserName(borrow.userId);
    const book = this.getBookNameFor(borrow.bookId);
    this.openConfirm(
      'Valider l\'emprunt',
      `Confirmer l\'emprunt de « ${book} » par ${who} ? Un exemplaire sera décompté du stock et l\'emprunt passera en statut Validé (à rendre sous 7 jours).`,
      'linear-gradient(135deg, #2fbf71, #7bd88f)',
      () => {
        this.borrowService.confirmBorrow(borrow.borrowId!).subscribe({
          next: (data: any) => {
            const brw: Borrow | undefined = data?.borrow;
            const dateStr = brw?.dueDate ? ' — à rendre le ' + this.formatDate(brw.dueDate) : '';
            this.toast.success((data.message || 'Emprunt confirmé') + dateStr);
            this.onConfirmModalClose();
            this.getAllBorrows();
            this.getBooks();
          },
          error: (err: HttpErrorResponse) => {
            this.confirmLoading = false;
            this.toast.error(err.error?.message || 'Erreur lors de la confirmation');
          }
        });
      }
    );
  }

  /** Refuser un emprunt (demande ou emprunt validé — l'exemplaire est remis en rayon). */
  openRefuseConfirm(borrow: Borrow) {
    const who = this.getUserName(borrow.userId);
    const book = this.getBookNameFor(borrow.bookId);
    this.openConfirm(
      'Refuser l\'emprunt',
      `Refuser l\'emprunt de « ${book} » par ${who} ?` +
        (borrow.statut === StatutBorrow.VALIDEE ? ' L\'exemplaire sera remis en rayon.' : ''),
      'linear-gradient(135deg, #dc3545, #ff6b7a)',
      () => {
        this.borrowService.refuseBorrow(borrow.borrowId!).subscribe({
          next: (data: any) => {
            this.toast.success(data.message || 'Emprunt refusé');
            this.onConfirmModalClose();
            this.getAllBorrows();
            this.getBooks();
          },
          error: (err: HttpErrorResponse) => {
            this.confirmLoading = false;
            this.toast.error(err.error?.message || 'Erreur lors du refus');
          }
        });
      },
      true,
      'Refuser'
    );
  }

  /** Retourner un emprunt VALIDEE (remet l'exemplaire en rayon). */
  openReturnConfirm(borrow: Borrow) {
    const who = this.getUserName(borrow.userId);
    const book = this.getBookNameFor(borrow.bookId);
    this.openConfirm(
      'Retourner le livre',
      `Enregistrer le retour de « ${book} » par ${who} ? L\'exemplaire sera remis en rayon et l\'emprunt marqué comme rendu.`,
      'linear-gradient(135deg, #f5a623, #f7c948)',
      () => {
        const brw = new Borrow();
        brw.borrowId = borrow.borrowId;
        this.borrowService.returnBook(brw).subscribe({
          next: (data: any) => {
            this.toast.success(data.message || 'Retour enregistré avec succès');
            this.onConfirmModalClose();
            this.getAllBorrows();
            this.getBooks();
          },
          error: (err: HttpErrorResponse) => {
            this.confirmLoading = false;
            this.toast.error(err.error?.message || 'Erreur lors du retour');
          }
        });
      }
    );
  }

  /** Supprimer depuis le tableau : une seule confirmation pour les emprunts clos (rendu/refusé),
   *  confirmation renforcée (nom du livre) pour les emprunts en cours ou demandes. */
  openDeleteConfirmFromTable(borrow: Borrow) {
    if (borrow.statut === StatutBorrow.RENDU || borrow.statut === StatutBorrow.REFUSEE) {
      this.openDeleteConfirm(borrow);
      return;
    }
    this.openConfirm(
      'Supprimer l\'emprunt',
      `La suppression définitive requiert une confirmation renforcée. Vous allez devoir taper le nom exact du livre.`,
      'linear-gradient(135deg, #dc3545, #ff6b7a)',
      () => {
        this.onConfirmModalClose();
        this.openDeleteConfirm(borrow);
      },
      true,
      'Continuer'
  );
  }

  // ==================== Modale de détails ====================

  openDetails(borrow: Borrow) {
    this.detailBorrow = borrow;
    this.showDetailModal = true;
  }

  closeDetails() {
    this.showDetailModal = false;
    this.detailBorrow = null;
  }

  /** Date au format JJ/MM/AAAA pour les notifications (sérialisation dd-MM-yyyy côté API). */
  private formatDate(value: any): string {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
  }

  getUserName(userId: number): string {
    return this.userNames.get(userId) || 'Utilisateur #' + userId;
  }

  /** Le livre est-il déjà emprunté/en attente pour l'adhérent ? */
  isBookAlreadyBorrowed(bookId: number): boolean {
    return this.borrowedBookIds.has(bookId);
  }

  /** L'adhérent a-t-il atteint son quota ? */
  get quotaReached(): boolean {
    return !this.isStaff && this.activeBorrowCount >= this.maxQuota;
  }

  getStatutLabel(statut: StatutBorrow): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': 'Demande',
      'VALIDEE': 'Validée',
      'REFUSEE': 'Refusée',
      'EN_COURS': 'En cours',
      'RENDU': 'Rendu'
    };
    return labels[statut] || statut;
  }

  getStatutClass(statut: StatutBorrow): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE': 'status-badge status-en-attente',
      'VALIDEE': 'status-badge status-disponible',
      'REFUSEE': 'status-badge status-expiree',
      'EN_COURS': 'status-badge status-en-attente',
      'RENDU': 'status-badge status-honoree'
    };
    return classes[statut] || 'status-badge';
  }
}
