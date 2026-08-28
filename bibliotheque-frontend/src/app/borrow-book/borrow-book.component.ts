import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Books } from '../_model/books';
import { Borrow } from '../_model/borrow';
import { BooksService } from '../_service/books.service';
import { BorrowService } from '../_service/borrow.service';
import { UserAuthService } from '../_service/user-auth.service';

@Component({
  selector: 'app-borrow-book',
  templateUrl: './borrow-book.component.html',
  styleUrls: ['./borrow-book.component.css']
})
export class BorrowBookComponent implements OnInit {

  books: Books[] = [];
  loading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  borrowingBookId: number | null = null;

  constructor(
    private booksService: BooksService,
    private userAuthService: UserAuthService,
    private borrowService: BorrowService,
  ) { }

  userId = this.userAuthService.getUserId();

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

  borrowBook(bookId: number) {
    this.borrowingBookId = bookId;
    this.successMessage = null;
    this.errorMessage = null;

    const borrow = new Borrow();
    borrow.bookId = bookId;
    borrow.userId = this.userId;

    this.borrowService.borrowBook(borrow).subscribe({
      next: (data: any) => {
        this.borrowingBookId = null;
        this.successMessage = data.message || 'Emprunt effectué avec succès';
        this.getBooks();
      },
      error: (err: HttpErrorResponse) => {
        this.borrowingBookId = null;
        if (err.status === 0) {
          this.errorMessage = 'Le serveur est injoignable.';
        } else if (err.error?.message) {
          this.errorMessage = err.error.message;
        } else {
          this.errorMessage = 'Erreur ' + err.status + ' : impossible d\'effectuer l\'emprunt.';
        }
      }
    });
  }
}
