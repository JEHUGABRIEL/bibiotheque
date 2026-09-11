import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { UserDetailsComponent } from './user-details.component';

describe('UserDetailsComponent', () => {
  let fixture: ComponentFixture<UserDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientModule, FormsModule],
      declarations: [UserDetailsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UserDetailsComponent);
  });

  it('devrait être créé', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
