import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { Books } from '../_model/books';
import { BooksService } from '../_service/books.service';
import { TranslationService } from '../_service/translation.service';

@Component({
  selector: 'app-update-book',
  templateUrl: './update-book.component.html',
  styleUrls: ['./update-book.component.css']
})
export class UpdateBookComponent implements OnInit {

  bookId: number;
  book: Books = new Books();
  constructor(private booksService: BooksService,
    private route: ActivatedRoute,
    private router: Router,
    public t: TranslationService) { }

  ngOnInit(): void {
    this.bookId = this.route.snapshot.params['bookId'];
    this.booksService.getBookById(this.bookId).subscribe(data => {
      this.book = data;
    })
  }

  onSubmit() {
    this.booksService.updateBook(this.bookId, this.book).subscribe( data =>{
        this.goToBooksList();
    },
    error => console.log(error));
  }

  goToBooksList() {
    this.router.navigate(['/books']);
  }

}
