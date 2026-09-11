import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { BorrowBookComponent } from './borrow-book.component';

describe('BorrowBookComponent', () => {
  let fixture: ComponentFixture<BorrowBookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientModule, FormsModule],
      declarations: [BorrowBookComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BorrowBookComponent);
  });

  it('devrait être créé', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
