import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
  selector: 'app-return-book',
  templateUrl: './return-book.component.html',
  styleUrls: ['./return-book.component.css']
})
export class ReturnBookComponent implements OnInit {

  @ViewChild('tableAnchor') tableAnchor?: ElementRef<HTMLElement>;

  books: Books[] = [];
  borrow: Borrow[] = [];
  loading = false;
  returningBorrowId: number | null = null;
  userNames = new Map<number, string>();

  // Formulaire « Nouveau retour »
  showReturnModal = false;
  formSubmitting = false;
  formError: string | null = null;
  users: Users[] = [];
  selectedUserId: number | null = null;
  selectedBorrowId: number | null = null;
  modalBorrows: Borrow[] = [];
  loadingBorrows = false;

  constructor(
    private borrowService: BorrowService,
    private booksService: BooksService,
    private userAuthService: UserAuthService,
    private usersService: UsersService,
    public t: TranslationService,
    private toast: ToastService
  ) { }

  userId = this.userAuthService.getUserId();

  get isStaff(): boolean {
    return this.usersService.isStaff();
  }

  ngOnInit(): void {
    this.getBooks();
    this.getBooksByUser();
    if (this.isStaff) {
      // Noms pour la colonne « Adhérent » + le select du formulaire de retour
      this.loadUsers();
    }
  }

  /** « Nouveau retour » : ouvre le formulaire de retour. */
  openReturnModal(): void {
    this.selectedUserId = null;
    this.selectedBorrowId = null;
    this.modalBorrows = [];
    this.formError = null;
    this.showReturnModal = true;
    if (this.isStaff) {
      this.loadUsers();
    } else {
      // Adhérent : ses propres emprunts validés (déjà chargés)
      this.modalBorrows = this.borrow;
    }
  }

  closeReturnModal(): void {
    this.showReturnModal = false;
  }

  get isReturnFormValid(): boolean {
    return this.selectedBorrowId !== null && (this.isStaff ? this.selectedUserId !== null : true);
  }

  /** Staff : au changement d'adhérent, charge SES emprunts validés. */
  onStaffUserChange(): void {
    this.selectedBorrowId = null;
    this.modalBorrows = [];
    this.formError = null;
    if (this.selectedUserId === null) {
      return;
    }
    this.loadingBorrows = true;
    this.borrowService.getBooksBorrowedByUser(this.selectedUserId).subscribe({
      next: (data) => {
        this.modalBorrows = data.filter(b =>
          b.statut === StatutBorrow.VALIDEE && b.returnDate == null);
        this.loadingBorrows = false;
      },
      error: () => {
        this.loadingBorrows = false;
        this.formError = 'Impossible de charger les emprunts de cet adhérent.';
      }
    });
  }

  submitReturn(): void {
    if (!this.isReturnFormValid || this.formSubmitting) {
      return;
    }
    this.formSubmitting = true;
    this.formError = null;

    const brw = new Borrow();
    brw.borrowId = this.selectedBorrowId!;

    // Staff enregistre directement le retour, l'adhérent le déclare pour lui-même
    const request$ = this.isStaff
      ? this.borrowService.returnBook(brw)
      : this.borrowService.requestReturn(brw);

    request$.subscribe({
      next: (data: any) => {
        this.formSubmitting = false;
        this.toast.success(data.message || 'Retour effectué avec succès');
        this.closeReturnModal();
        this.getBooksByUser();
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
    return 'Erreur ' + err.status + ' : impossible d\'effectuer le retour.';
  }

  private getBooks() {
    this.loading = true;
    this.booksService.getBooksList().subscribe({
      next: (data) => {
        this.books = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /**
   * Staff : tous les emprunts (GET /borrow, réservé au personnel).
   * Adhérent : uniquement les siens (GET /borrow/user/{id}, autorisé pour soi-même).
   * Dans les deux cas on filtre sur les emprunts validés, donc pas encore rendus.
   */
  private getBooksByUser() {
    const request$ = this.isStaff
      ? this.borrowService.getBorrowList()
      : this.borrowService.getBooksBorrowedByUser(this.userId);

    request$.subscribe({
      next: (data) => {
        this.borrow = data.filter(b =>
          b.statut === StatutBorrow.VALIDEE && b.returnDate == null);
      },
      error: () => {}
    });
  }

  private loadUsers() {
    this.usersService.getUsersList().subscribe({
      next: (users) => {
        this.users = users.filter(u => !this.usersService.isStaffRole(u.role?.[0]?.roleName ?? ''));
        users.forEach(u => this.userNames.set(u.userId, u.name));
      },
      error: () => {}
    });
  }

  returnBook(borrowId: number) {
    this.returningBorrowId = borrowId;

    const brw = new Borrow();
    brw.borrowId = borrowId;

    // Staff validates directly, members send a request
    const request$ = this.isStaff
      ? this.borrowService.returnBook(brw)
      : this.borrowService.requestReturn(brw);

    request$.subscribe({
      next: (data: any) => {
        this.returningBorrowId = null;
        if (this.isStaff) {
          this.toast.success(data.message || 'Retour effectué avec succès');
        } else {
          this.toast.info(data.message || 'Votre demande de retour a été enregistrée. Le bibliothécaire la traitera dans les plus brefs délais.');
        }
        this.getBooks();
        this.getBooksByUser();
      },
      error: (err: HttpErrorResponse) => {
        this.returningBorrowId = null;
        this.toast.error(this.extractErrorMessage(err));
      }
    });
  }

  getBookName(bookId: number): string {
    const book = this.books.find(b => b.bookId === bookId);
    return book ? book.bookName : 'Livre #' + bookId;
  }

  getUserName(userId: number): string {
    return this.userNames.get(userId) || 'Utilisateur #' + userId;
  }
}
