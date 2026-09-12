import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { BorrowService } from '../_service/borrow.service';
import { BooksService } from '../_service/books.service';
import { UsersService } from '../_service/users.service';
import { TranslationService } from '../_service/translation.service';
import { ToastService } from '../_service/toast.service';

/**
 * Page « Demandes d'emprunt » (personnel : Admin + BIBLIOTHECAIRE) — accessible
 * depuis le bouton « Voir toutes les demandes d'emprunt » de la page Emprunter
 * ou le lien « Demandes d'emprunt » de la sidebar.
 * Liste uniquement les demandes EN_ATTENTE à traiter (valider / refuser).
 */
@Component({
  selector: 'app-pending-borrows',
  templateUrl: './pending-borrows.component.html',
  styleUrls: ['./pending-borrows.component.css']
})
export class PendingBorrowsComponent implements OnInit {

  allBorrows: Borrow[] = [];
  loading = true;
  userNames = new Map<number, string>();
  bookNames = new Map<number, string>();

  // Pagination
  page = 1;
  pageSize = 5;

  // Modale de confirmation générique (valider / refuser)
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = 'Confirmer';
  confirmIconBg = 'linear-gradient(135deg, #2fbf71, #7bd88f)';
  confirmDanger = false;
  confirmLoading = false;
  private confirmAction: (() => void) | null = null;

  // Modale de détails
  showDetailModal = false;
  detailBorrow: Borrow | null = null;

  constructor(
    private borrowService: BorrowService,
    private booksService: BooksService,
    private usersService: UsersService,
    private location: Location,
    public t: TranslationService,
    private toast: ToastService
  ) { }

  /** Demandes en attente extraites de la liste complète (un seul appel API). */
  get pendingRequests(): Borrow[] {
    return this.allBorrows.filter(b => b.statut === StatutBorrow.EN_ATTENTE);
  }

  get paginatedRequests(): Borrow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.pendingRequests.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.pendingRequests.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(target: number) {
    if (target >= 1 && target <= this.totalPages) {
      this.page = target;
    }
  }

  ngOnInit(): void {
    this.loadBookNames();
    this.loadUsers();
  }

  /** Retour à la page Emprunter. */
  goBack(): void {
    this.location.back();
  }

  private loadBookNames() {
    this.booksService.getBooksList().subscribe({
      next: (books) => books.forEach(b => this.bookNames.set(b.bookId, b.bookName)),
      error: () => {}
    });
  }

  private loadUsers() {
    this.usersService.getUsersList().subscribe({
      next: (users) => {
        users.forEach(u => this.userNames.set(u.userId, u.name));
        this.getAllBorrows();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private getAllBorrows() {
    this.borrowService.getBorrowList().subscribe({
      next: (data) => {
        // Dédoublonnage défensif (doublons historiques en base)
        const seen = new Set<number>();
        this.allBorrows = data.filter(b => {
          if (b.borrowId == null || seen.has(b.borrowId)) return false;
          seen.add(b.borrowId);
          return true;
        });
        this.loading = false;
        if (this.page > this.totalPages) {
          this.page = this.totalPages;
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getUserName(userId: number): string {
    return this.userNames.get(userId) || 'Utilisateur #' + userId;
  }

  getBookNameFor(bookId: number | undefined): string {
    return bookId !== null && bookId !== undefined
      ? (this.bookNames.get(bookId) || 'Livre #' + bookId)
      : '';
  }

  // ==================== Modale de confirmation générique ====================

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
      `Confirmer l'emprunt de « ${book} » par ${who} ? Un exemplaire sera décompté du stock et l'emprunt passera en statut Validé (à rendre sous 7 jours).`,
      'linear-gradient(135deg, #2fbf71, #7bd88f)',
      () => {
        this.borrowService.confirmBorrow(borrow.borrowId!).subscribe({
          next: (data: any) => {
            this.toast.success(data.message || 'Emprunt confirmé');
            this.onConfirmModalClose();
            this.getAllBorrows();
          },
          error: (err: HttpErrorResponse) => {
            this.confirmLoading = false;
            this.toast.error(err.error?.message || 'Erreur lors de la confirmation');
          }
        });
      }
    );
  }

  /** Refuser une demande EN_ATTENTE. */
  openRefuseConfirm(borrow: Borrow) {
    const who = this.getUserName(borrow.userId);
    const book = this.getBookNameFor(borrow.bookId);
    this.openConfirm(
      'Refuser l\'emprunt',
      `Refuser la demande d'emprunt de « ${book} » par ${who} ?`,
      'linear-gradient(135deg, #dc3545, #ff6b7a)',
      () => {
        this.borrowService.refuseBorrow(borrow.borrowId!).subscribe({
          next: (data: any) => {
            this.toast.success(data.message || 'Emprunt refusé');
            this.onConfirmModalClose();
            this.getAllBorrows();
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

  // ==================== Modale de détails ====================

  openDetails(borrow: Borrow) {
    this.detailBorrow = borrow;
    this.showDetailModal = true;
  }

  closeDetails() {
    this.showDetailModal = false;
    this.detailBorrow = null;
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
