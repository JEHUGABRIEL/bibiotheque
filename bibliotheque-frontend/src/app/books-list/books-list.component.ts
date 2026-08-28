import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Books } from '../_model/books'
import { BooksService } from '../_service/books.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-books-list',
  templateUrl: './books-list.component.html',
  styleUrls: ['./books-list.component.css']
})
export class BooksListComponent implements OnInit {

  books: Books[] = [];
  loading = false;
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

  constructor(private booksService: BooksService,
    private router: Router) { }

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

  deleteBook(bookId: number) {
    this.booksService.deleteBook(bookId).subscribe( data=> {
      this.getBooks();
    });
  }

  bookDetails(bookId: number) {
    this.router.navigate(['book-details', bookId ]);
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
