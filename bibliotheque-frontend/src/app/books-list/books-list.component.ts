import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Books } from '../_model/books'
import { BooksService } from '../_service/books.service';
import { UsersService } from '../_service/users.service';
import { TranslationService } from '../_service/translation.service';
import { ToastService } from '../_service/toast.service';
import { BorrowService } from '../_service/borrow.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Borrow } from '../_model/borrow';

@Component({
  selector: 'app-books-list',
  templateUrl: './books-list.component.html',
  styleUrls: ['./books-list.component.css']
})
export class BooksListComponent implements OnInit {

  books: Books[] = [];
  loading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;

  get paginatedBooks(): Books[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.books.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.books.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get resultsInfo(): string {
    if (this.books.length === 0) return '';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.books.length);
    return `${start}–${end} sur ${this.books.length}`;
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
  showCreateModal = false;
  showEditModal = false;
  editBook: Books = new Books();
  editBookId: number = 0;

  // Create form
  newBook: Books = new Books();
  createLoading = false;

  // Edit form
  editLoading = false;

  // Delete confirmation
  showDeleteConfirm = false;
  bookToDelete: Books | null = null;
  deleteBookBorrows: Borrow[] = [];
  deleteInputValue = '';

  // Details modal
  showDetailModal = false;
  detailLoading = false;
  detailError: string | null = null;
  detailBook: Books | null = null;

  constructor(
    private booksService: BooksService,
    private usersService: UsersService,
    private borrowService: BorrowService,
    private router: Router,
    public t: TranslationService,
    private toast: ToastService
  ) { }

  /** Le personnel peut modifier un livre depuis la modale de détail. */
  get isStaff(): boolean {
    return this.usersService.isStaff();
  }

  ngOnInit(): void {
    this.getBooks();
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

  updateBook(bookId: number) {
    this.router.navigate(['update-book', bookId]);
  }

  openDeleteConfirm(book: Books) {
    this.bookToDelete = book;
    this.deleteInputValue = '';
    this.deleteBookBorrows = [];
    this.showDeleteConfirm = true;

    // Vérifier les emprunts actifs pour ce livre
    this.borrowService.getBookBorrowHistory(book.bookId).subscribe({
      next: (borrows) => {
        this.deleteBookBorrows = borrows.filter(b => !b.returnDate);
      },
      error: () => {}
    });
  }

  get deleteMessage(): string {
    if (!this.bookToDelete) return '';
    const activeBorrows = this.deleteBookBorrows.length;
    const intro = activeBorrows > 0
      ? `<strong>${this.t.t('books.delete.warning.borrows', { n: activeBorrows })}</strong><br><br>`
      : '';
    return `${intro}${this.t.t('books.delete.message', { name: this.bookToDelete.bookName })}<br><br><em>${this.t.t('confirm.type.name')}</em>`;
  }

  get isDeleteInputValid(): boolean {
    return this.deleteInputValue.trim() === this.bookToDelete?.bookName;
  }

  confirmDelete() {
    if (!this.bookToDelete || !this.isDeleteInputValid) return;
    const bookId = this.bookToDelete.bookId;
    const bookName = this.bookToDelete.bookName;
    this.showDeleteConfirm = false;
    this.bookToDelete = null;
    this.deleteBookBorrows = [];
    this.deleteInputValue = '';
    this.booksService.deleteBook(bookId).subscribe({
      next: () => {
        this.toast.success(this.t.t('toast.book.deleted', { name: bookName }));
        this.getBooks();
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(err.error?.message || this.t.t('error.delete.failed'));
        this.getBooks();
      }
    });
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
    this.bookToDelete = null;
    this.deleteBookBorrows = [];
    this.deleteInputValue = '';
  }

  /** Détails en modale — plus de navigation vers une page séparée. */
  bookDetails(bookId: number) {
    this.showDetailModal = true;
    this.detailLoading = true;
    this.detailError = null;
    this.detailBook = null;
    this.booksService.getBookById(bookId).subscribe({
      next: (book) => {
        this.detailBook = book;
        this.detailLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.detailLoading = false;
        this.detailError = err.error?.message || 'Erreur ' + err.status;
      }
    });
  }

  /** Depuis la modale de détail : modifier le livre (ouvre la modale d'édition). */
  editFromDetail() {
    if (!this.detailBook) return;
    this.showDetailModal = false;
    this.openEditModal(this.detailBook);
  }

  /** Depuis la modale de détail : réserver ce livre indisponible (RG-01). */
  reserveFromDetail() {
    if (!this.detailBook) return;
    this.router.navigate(['/reservations'], { queryParams: { reserve: this.detailBook.bookId } });
  }

  /** Depuis la modale de détail : emprunter ce livre disponible. */
  borrowFromDetail() {
    if (!this.detailBook) return;
    this.router.navigate(['/borrow-book'], { queryParams: { book: this.detailBook.bookId } });
  }

  // --- Create modal ---
  openCreateModal() {
    this.newBook = new Books();
    this.showCreateModal = true;
  }

  get isCreateValid(): boolean {
    return !!(this.newBook.bookName?.trim() &&
              this.newBook.bookAuthor?.trim() &&
              this.newBook.bookGenre?.trim() &&
              this.newBook.noOfCopies !== null &&
              this.newBook.noOfCopies !== undefined &&
              this.newBook.noOfCopies >= 0);
  }

  submitCreate() {
    this.createLoading = true;
    this.booksService.createBook(this.newBook).subscribe({
      next: () => {
        this.createLoading = false;
        this.toast.success(this.t.t('toast.book.added'));
        this.getBooks();
        this.showCreateModal = false;
      },
      error: (err: HttpErrorResponse) => {
        this.createLoading = false;
        this.toast.error(err.error?.message || this.t.t('error.add.failed'));
      }
    });
  }

  // --- Edit modal ---
  openEditModal(book: Books) {
    this.editBook = { ...book };
    this.editBookId = book.bookId;
    this.showEditModal = true;
  }

  get isEditValid(): boolean {
    return !!(this.editBook.bookName?.trim() &&
              this.editBook.bookAuthor?.trim() &&
              this.editBook.bookGenre?.trim() &&
              this.editBook.noOfCopies !== null &&
              this.editBook.noOfCopies !== undefined &&
              this.editBook.noOfCopies >= 0);
  }

  submitEdit() {
    this.editLoading = true;
    this.booksService.updateBook(this.editBookId, this.editBook).subscribe({
      next: () => {
        this.editLoading = false;
        this.toast.success(this.t.t('toast.book.updated'));
        this.getBooks();
        this.showEditModal = false;
      },
      error: (err: HttpErrorResponse) => {
        this.editLoading = false;
        this.toast.error(err.error?.message || this.t.t('error.update.failed'));
      }
    });
  }
}
