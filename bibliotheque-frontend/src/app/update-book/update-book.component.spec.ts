import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { UpdateBookComponent } from './update-book.component';

describe('UpdateBookComponent', () => {
  let fixture: ComponentFixture<UpdateBookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientModule, FormsModule],
      declarations: [UpdateBookComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateBookComponent);
  });

  it('devrait être créé', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
