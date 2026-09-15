import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Books } from '../_model/books';
import { BooksService } from '../_service/books.service';
import { TranslationService } from '../_service/translation.service';

@Component({
  selector: 'app-create-book',
  templateUrl: './create-book.component.html',
  styleUrls: ['./create-book.component.css']
})
export class CreateBookComponent implements OnInit {

  book: Books = new Books();
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private booksService: BooksService,
    private router: Router,
    public t: TranslationService) { }

  ngOnInit(): void {
  }

  get isFormValid(): boolean {
    return !!(this.book.bookName?.trim() &&
              this.book.bookAuthor?.trim() &&
              this.book.bookGenre?.trim() &&
              this.book.noOfCopies !== null &&
              this.book.noOfCopies !== undefined &&
              this.book.noOfCopies >= 0);
  }

  saveBook() {
    this.loading = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.booksService.createBook(this.book).subscribe({
      next: (data) => {
        this.loading = false;
        this.successMessage = this.t.t('toast.book.added');
        setTimeout(() => this.goToBooksList(), 1500);
      },
      error: (error) => {
        this.loading = false;
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 409) {
          this.errorMessage = this.t.t('error.book.exists');
        } else {
          this.errorMessage = this.t.t('error.book.add');
        }
      }
    });
  }

  goToBooksList() {
    this.router.navigate(['/books']);
  }

  onSubmit() {
    if (this.isFormValid && !this.loading) {
      this.saveBook();
    }
  }

}
