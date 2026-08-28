import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Books } from '../_model/books';
import { Users } from '../_model/users';

@Component({
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.component.html',
  styleUrls: ['./reservation-form.component.css']
})
export class ReservationFormComponent {

  @Input() books: Books[] = [];
  @Input() users: Users[] = [];
  @Input() submitting = false;
  @Input() errorMessage: string | null = null;
  @Input() successMessage: string | null = null;

  @Output() submitRequest = new EventEmitter<{ bookId: number; userId: number }>();

  selectedBookId: number | null = null;
  selectedUserId: number | null = null;

  get isFormValid(): boolean {
    return this.selectedBookId !== null && this.selectedUserId !== null;
  }

  onSubmit() {
    if (!this.isFormValid || this.submitting) return;
    this.submitRequest.emit({
      bookId: this.selectedBookId!,
      userId: this.selectedUserId!
    });
  }

  reset() {
    this.selectedBookId = null;
    this.selectedUserId = null;
  }
}
