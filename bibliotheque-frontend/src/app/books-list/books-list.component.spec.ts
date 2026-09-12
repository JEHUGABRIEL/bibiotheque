import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { BooksListComponent } from './books-list.component';
import { Books } from '../_model/books';

describe('BooksListComponent', () => {
  let fixture: ComponentFixture<BooksListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientModule, FormsModule],
      declarations: [BooksListComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BooksListComponent);
  });

  it('devrait être créé', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('actions de la modale de détail', () => {
    const makeBook = (id: number, name: string, copies: number): Books =>
      ({ bookId: id, bookName: name, bookAuthor: 'A. Auteur', bookGenre: 'Roman', noOfCopies: copies, imageUrl: '' } as Books);

    it('editFromDetail ferme la modale de détail et ouvre celle d\'édition', () => {
      const c = fixture.componentInstance;
      c.detailBook = makeBook(1, 'Dune', 0);
      c.showDetailModal = true;
      c.editFromDetail();
      expect(c.showDetailModal).toBeFalse();
      expect(c.showEditModal).toBeTrue();
      expect(c.editBookId).toBe(1);
      expect(c.editBook.bookName).toBe('Dune');
    });

    it('ne fait rien si aucun livre en détail', () => {
      const c = fixture.componentInstance;
      c.showDetailModal = true;
      expect(() => c.editFromDetail()).not.toThrow();
      expect(c.showEditModal).toBeFalse();
    });
  });
});
