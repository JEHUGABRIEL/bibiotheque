import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  template: `
    <div class="modal-overlay" *ngIf="open" (click)="onOverlayClick($event)">
      <div class="confirm-container">
        <div class="confirm-icon" [style.background]="iconBg">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
          </svg>
        </div>
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-cancel" (click)="cancel.emit()">
            {{ cancelLabel }}
          </button>
          <button class="confirm-btn confirm-ok" [class.confirm-danger]="danger" (click)="confirm.emit()">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      padding: 1rem;
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .confirm-container {
      background: var(--bg-card, #21242f);
      border: 1px solid var(--border-color, #2d3143);
      border-radius: 16px;
      width: 100%;
      max-width: 400px;
      padding: 2rem;
      text-align: center;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.2s ease;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .confirm-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      margin: 0 auto 1rem;
    }

    h3 {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--text-primary, #e8e9ed);
      margin: 0 0 0.5rem;
    }

    p {
      font-size: 0.88rem;
      color: var(--text-secondary, #8b8fa3);
      margin: 0 0 1.5rem;
      line-height: 1.5;
    }

    .confirm-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }

    .confirm-btn {
      flex: 1;
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .confirm-cancel {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color, #2d3143);
      color: var(--text-secondary, #8b8fa3);
    }

    .confirm-cancel:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary, #e8e9ed);
    }

    .confirm-ok {
      background: #7c4dff;
      color: #fff;
    }

    .confirm-ok:hover {
      opacity: 0.9;
    }

    .confirm-danger {
      background: #dc3545;
    }

    .confirm-danger:hover {
      background: #c82333;
    }

    @media (max-width: 768px) {
      .modal-overlay {
        padding: 0.5rem;
        align-items: flex-start;
        padding-top: 15vh;
      }

      .confirm-container {
        max-width: 100%;
        border-radius: 12px;
        padding: 1.5rem;
      }
    }
  `]
})
export class ConfirmModalComponent {
  @Input() open = false;
  @Input() title = 'Confirmation';
  @Input() message = 'Êtes-vous sûr ?';
  @Input() confirmLabel = 'Confirmer';
  @Input() cancelLabel = 'Annuler';
  @Input() danger = false;
  @Input() iconBg = 'linear-gradient(135deg, #7c4dff, #5b4cd4)';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onOverlayClick(event: Event) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancel.emit();
    }
  }
}
