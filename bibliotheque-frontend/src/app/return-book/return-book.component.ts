import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Books } from '../_model/books';
import { Borrow } from '../_model/borrow';
import { BooksService } from '../_service/books.service';
import { BorrowService } from '../_service/borrow.service';
import { UserAuthService } from '../_service/user-auth.service';
import { TranslationService } from '../_service/translation.service';

@Component({
  selector: 'app-return-book',
  templateUrl: './return-book.component.html',
  styleUrls: ['./return-book.component.css']
})
export class ReturnBookComponent implements OnInit {

  books: Books[] = [];
  borrow: Borrow[] = [];
  loading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  returningBorrowId: number | null = null;

  constructor(
    private borrowService: BorrowService,
    private booksService: BooksService,
    private userAuthService: UserAuthService,
    public t: TranslationService
  ) { }

  userId = this.userAuthService.getUserId();

  ngOnInit(): void {
    this.getBooks();
    this.getBooksByUser();
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

  private getBooksByUser() {
    this.borrowService.getBooksBorrowedByUser(this.userId).subscribe({
      next: (data) => {
        this.borrow = data;
      },
      error: () => {}
    });
  }

  returnBook(borrowId: number) {
    this.returningBorrowId = borrowId;
    this.successMessage = null;
    this.errorMessage = null;

    const brw = new Borrow();
    brw.borrowId = borrowId;

    this.borrowService.returnBook(brw).subscribe({
      next: (data: any) => {
        this.returningBorrowId = null;
        this.successMessage = data.message || 'Retour effectué avec succès';
        this.getBooks();
        this.getBooksByUser();
      },
      error: (err: HttpErrorResponse) => {
        this.returningBorrowId = null;
        if (err.status === 0) {
          this.errorMessage = 'Le serveur est injoignable.';
        } else if (err.error?.message) {
          this.errorMessage = err.error.message;
        } else {
          this.errorMessage = 'Erreur ' + err.status + ' : impossible d\'effectuer le retour.';
        }
      }
    });
  }

  getBookName(bookId: number): string {
    const book = this.books.find(b => b.bookId === bookId);
    return book ? book.bookName : 'Livre #' + bookId;
  }
}
