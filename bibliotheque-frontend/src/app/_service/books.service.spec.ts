import { TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { BooksService } from './books.service';

describe('BooksService', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HttpClientModule] }));

  it('devrait être créé', () => {
    expect(TestBed.inject(BooksService)).toBeTruthy();
  });
});
