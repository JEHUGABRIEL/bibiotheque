import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div class="modal-overlay" *ngIf="open" (click)="onOverlayClick($event)">
      <div class="modal-container" [style.maxWidth]="maxWidth">
        <div class="modal-header">
          <div class="modal-title-area">
            <div class="modal-icon" *ngIf="iconColor" [style.background]="iconColor">
              <ng-content select="[modal-icon]"></ng-content>
            </div>
            <h3>{{ title }}</h3>
          </div>
          <button class="modal-close" (click)="close.emit()">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
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

    .modal-container {
      background: var(--bg-card, #21242f);
      border: 1px solid var(--border-color, #2d3143);
      border-radius: 16px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.2s ease;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-color, #2d3143);
    }

    .modal-title-area {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .modal-icon {
      width: 40px;
      height: 40px;
      min-width: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }

    .modal-header h3 {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--text-primary, #e8e9ed);
      margin: 0;
    }

    .modal-close {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary, #8b8fa3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .modal-close:hover {
      background: rgba(220, 53, 69, 0.15);
      color: #ff6b7a;
    }

    .modal-body {
      padding: 1.5rem;
    }

    @media (max-width: 768px) {
      .modal-overlay {
        padding: 0.5rem;
        align-items: flex-start;
        padding-top: 10vh;
      }

      .modal-container {
        max-height: 80vh;
        border-radius: 12px;
      }
    }
  `]
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() iconColor = '';
  @Input() maxWidth = '520px';
  @Output() close = new EventEmitter<void>();

  onOverlayClick(event: Event) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }
}
