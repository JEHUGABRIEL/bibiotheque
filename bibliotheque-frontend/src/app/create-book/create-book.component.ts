import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Books } from '../_model/books';
import { BooksService } from '../_service/books.service';

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
    private router: Router) { }

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
        this.successMessage = 'Livre ajouté avec succès !';
        setTimeout(() => this.goToBooksList(), 1500);
      },
      error: (error) => {
        this.loading = false;
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 409) {
          this.errorMessage = 'Ce livre existe déjà.';
        } else {
          this.errorMessage = 'Une erreur est survenue lors de l\'ajout.';
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
