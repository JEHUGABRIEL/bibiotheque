import { TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { BorrowService } from './borrow.service';

describe('BorrowService', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HttpClientModule] }));

  it('devrait être créé', () => {
    expect(TestBed.inject(BorrowService)).toBeTruthy();
  });
});
