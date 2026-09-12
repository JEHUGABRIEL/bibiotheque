import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Books } from '../_model/books'
import { BooksService } from '../_service/books.service';
import { UsersService } from '../_service/users.service';
import { TranslationService } from '../_service/translation.service';
import { HttpErrorResponse } from '@angular/common/http';

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
  createError: string | null = null;
  createSuccess: string | null = null;

  // Edit form
  editLoading = false;
  editError: string | null = null;
  editSuccess: string | null = null;

  // Delete confirmation
  showDeleteConfirm = false;
  bookToDelete: Books | null = null;

  // Details modal
  showDetailModal = false;
  detailLoading = false;
  detailError: string | null = null;
  detailBook: Books | null = null;

  get deleteMessage(): string {
    if (!this.bookToDelete) return '';
    return 'Voulez-vous vraiment supprimer \u00AB ' + this.bookToDelete.bookName + ' \u00BB ? Cette action est irréversible.';
  }

  constructor(private booksService: BooksService,
    private usersService: UsersService,
    private router: Router,
    public t: TranslationService) { }

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
    this.showDeleteConfirm = true;
  }

  confirmDelete() {
    if (!this.bookToDelete) return;
    const bookId = this.bookToDelete.bookId;
    this.showDeleteConfirm = false;
    this.bookToDelete = null;
    this.booksService.deleteBook(bookId).subscribe({
      next: () => this.getBooks(),
      error: () => this.getBooks()
    });
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
    this.bookToDelete = null;
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
    this.createError = null;
    this.createSuccess = null;
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
    this.createError = null;
    this.createSuccess = null;
    this.booksService.createBook(this.newBook).subscribe({
      next: () => {
        this.createLoading = false;
        this.createSuccess = 'Livre ajouté avec succès';
        this.getBooks();
        setTimeout(() => {
          this.showCreateModal = false;
          this.createSuccess = null;
        }, 1200);
      },
      error: (err: HttpErrorResponse) => {
        this.createLoading = false;
        this.createError = err.error?.message || 'Erreur lors de l\'ajout';
      }
    });
  }

  // --- Edit modal ---
  openEditModal(book: Books) {
    this.editBook = { ...book };
    this.editBookId = book.bookId;
    this.editError = null;
    this.editSuccess = null;
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
    this.editError = null;
    this.editSuccess = null;
    this.booksService.updateBook(this.editBookId, this.editBook).subscribe({
      next: () => {
        this.editLoading = false;
        this.editSuccess = 'Livre modifié avec succès';
        this.getBooks();
        setTimeout(() => {
          this.showEditModal = false;
          this.editSuccess = null;
        }, 1200);
      },
      error: (err: HttpErrorResponse) => {
        this.editLoading = false;
        this.editError = err.error?.message || 'Erreur lors de la modification';
      }
    });
  }
}
