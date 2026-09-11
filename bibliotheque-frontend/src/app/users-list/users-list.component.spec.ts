import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { UsersListComponent } from './users-list.component';
import { ModalComponent } from '../_shared/modal.component';
import { ConfirmModalComponent } from '../_shared/confirm-modal.component';

describe('UsersListComponent', () => {
  let fixture: ComponentFixture<UsersListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientModule, FormsModule],
      declarations: [UsersListComponent, ModalComponent, ConfirmModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UsersListComponent);
  });

  it('devrait être créé', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
