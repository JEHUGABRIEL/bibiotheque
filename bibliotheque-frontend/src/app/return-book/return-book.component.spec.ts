import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { ReturnBookComponent } from './return-book.component';

describe('ReturnBookComponent', () => {
  let fixture: ComponentFixture<ReturnBookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientModule, FormsModule],
      declarations: [ReturnBookComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ReturnBookComponent);
  });

  it('devrait être créé', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
