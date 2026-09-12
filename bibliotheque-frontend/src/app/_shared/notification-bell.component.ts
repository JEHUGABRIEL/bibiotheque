import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, NotificationService } from '../_service/notification.service';

/**
 * Cloche de notifications (admin + adhérent).
 * Affiche la liste des notifications dérivées des emprunts/réservations
 * et un badge avec le nombre courant. Clic sur une entrée → écran concerné.
 */
@Component({
  selector: 'app-notification-bell',
  template: `
    <div class="bell-wrap">
      <button class="bell-btn" (click)="toggle($event)" title="Notifications">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2m.995-14.901a1 1 0 1 0-1.99 0A2 2 0 0 0 8 2v6h-6a.5.5 0 0 0 0 1h12a.5.5 0 0 0 0-1H10V2a2 2 0 0 0-.995-1.901"/>
          <path d="M10.5 12.5H3a.5.5 0 0 1 0-1h.438C4.037 10.667 4.5 9.898 4.5 7v-.5a3.5 3.5 0 1 1 7 0V7c0 2.898.463 3.667 1.062 4.5H13.5a.5.5 0 0 1 0 1z"/>
        </svg>
        <span class="bell-badge" *ngIf="unread > 0">{{ unread > 9 ? '9+' : unread }}</span>
      </button>

      <div class="bell-panel" *ngIf="open">
        <div class="bell-header">
          <span>Notifications</span>
          <button class="bell-clear" *ngIf="unread > 0" (click)="markAllSeen()">Tout marquer lu</button>
        </div>

        <div class="bell-list">
          <div *ngIf="notifications.length === 0" class="bell-empty">Aucune notification</div>

          <button *ngFor="let n of notifications" class="bell-item"
                  [class.urgent]="n.urgent && !n.read" [class.read]="n.read"
                  (click)="go(n)">
            <span class="bell-item-dismiss" (click)="dismiss($event, n.id)"
                  [title]="n.read ? 'Marquer comme non lu' : 'Marquer comme lu'">
              <svg *ngIf="!n.read" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
              </svg>
              <svg *ngIf="n.read" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 3a.5.5 0 0 1 .5.5v3.793l2.854-2.853a.5.5 0 0 1 .707.707l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.707L7.5 7.293V3.5A.5.5 0 0 1 8 3m-4.5 8.5A.5.5 0 0 1 4 11h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5" fill-rule="evenodd"/>
              </svg>
            </span>
            <span class="bell-item-icon">
              <!-- Emprunt -->
              <svg *ngIf="n.icon === 'borrow'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492z"/>
              </svg>
              <!-- Réservation -->
              <svg *ngIf="n.icon === 'reservation'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm3.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 2.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1z"/>
              </svg>
              <!-- Échéance -->
              <svg *ngIf="n.icon === 'due'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z"/>
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"/>
              </svg>
            </span>
            <span class="bell-item-body">
              <span class="bell-item-title">
                {{ n.title }}
                <em class="bell-item-date" *ngIf="n.date">— {{ n.date }}</em>
              </span>
              <span class="bell-item-detail">{{ n.detail }}</span>
            </span>
          </button>
        </div>

        <div class="bell-footer">
          <label class="bell-toggle">
            <input type="checkbox" [checked]="markAllOnOpen" (change)="toggleMarkAllOnOpen($event)">
            <span class="bell-toggle-track"><span class="bell-toggle-thumb"></span></span>
            <span class="bell-toggle-label">Tout marquer lu à l'ouverture</span>
          </label>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bell-wrap { position: relative; }

    .bell-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .bell-btn:hover {
      background: rgba(124, 77, 255, 0.1);
      color: #7c4dff;
    }

    .bell-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: #ef4444;
      color: #fff;
      font-size: 0.62rem;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
    }

    .bell-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 320px;
      max-height: 420px;
      display: flex;
      flex-direction: column;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
      z-index: 1200;
      overflow: hidden;
      animation: bellIn 0.18s ease;
    }

    @keyframes bellIn {
      from { transform: translateY(-6px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    .bell-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      font-weight: 700;
      font-size: 0.85rem;
      border-bottom: 1px solid var(--border-color);
    }

    .bell-clear {
      background: none;
      border: none;
      color: #7c4dff;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;
    }

    .bell-clear:hover { background: rgba(124, 77, 255, 0.1); }

    .bell-list { overflow-y: auto; }

    .bell-empty {
      padding: 1.5rem 1rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    .bell-item {
      display: flex;
      gap: 0.65rem;
      width: 100%;
      padding: 0.7rem 1rem;
      background: none;
      border: none;
      border-bottom: 1px solid var(--border-color);
      text-align: left;
      cursor: pointer;
      transition: background 0.12s;
    }

    .bell-item:last-child { border-bottom: none; }
    .bell-item:hover { background: rgba(124, 77, 255, 0.06); }
    .bell-item.urgent { background: rgba(239, 68, 68, 0.06); }
    .bell-item.urgent:hover { background: rgba(239, 68, 68, 0.12); }

    .bell-item-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(124, 77, 255, 0.1);
      color: #7c4dff;
    }

    .bell-item.urgent .bell-item-icon {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
    }

    .bell-item-dismiss {
      flex-shrink: 0;
      align-self: flex-start;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-top: 2px;
      border-radius: 6px;
      background: none;
      color: var(--text-muted);
      opacity: 0;
      transition: opacity 0.12s, background 0.12s;
    }

    .bell-item:hover .bell-item-dismiss { opacity: 1; }
    .bell-item-dismiss:hover { background: rgba(124, 77, 255, 0.15); color: #7c4dff; }

    @media (hover: none) {
      .bell-item-dismiss { opacity: 1; } /* tactile : toujours visible */
    }

    .bell-item.read { opacity: 0.55; }
    .bell-item.read:hover { opacity: 0.85; }
    .bell-item.read .bell-item-title { font-weight: 500; color: var(--text-secondary); }

    .bell-item-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    .bell-item-title {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .bell-item-date {
      font-style: normal;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .bell-item-detail {
      font-size: 0.72rem;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bell-footer {
      border-top: 1px solid var(--border-color);
      padding: 0.55rem 1rem;
    }

    .bell-toggle {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      cursor: pointer;
      user-select: none;
    }

    .bell-toggle input { display: none; }

    .bell-toggle-track {
      position: relative;
      flex-shrink: 0;
      width: 30px;
      height: 17px;
      border-radius: 9px;
      background: var(--border-color);
      transition: background 0.15s;
    }

    .bell-toggle-track::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.15s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    }

    input:checked + .bell-toggle-track { background: #7c4dff; }
    input:checked + .bell-toggle-track::after { transform: translateX(13px); }

    .bell-toggle-label {
      font-size: 0.74rem;
      color: var(--text-secondary);
    }

    @media (max-width: 480px) {
      .bell-panel { width: 280px; right: -40px; }
    }
  `]
})
export class NotificationBellComponent implements OnInit, OnDestroy {

  notifications: AppNotification[] = [];
  unread = 0;
  open = false;

  /** Préférence « tout marquer lu à l'ouverture » (persistée par compte). */
  get markAllOnOpen(): boolean {
    return this.notificationService.isMarkAllOnOpen;
  }

  private outsideHandler = (e: Event) => {
    if (this.open && !(e.target as HTMLElement).closest('.bell-wrap')) {
      this.open = false;
    }
  };

  constructor(private notificationService: NotificationService, private router: Router) {}

  ngOnInit(): void {
    this.notificationService.notifications.subscribe(list => {
      this.notifications = list;
      this.unread = list.filter(n => !n.read).length;
    });
    this.notificationService.startPolling();
    document.addEventListener('click', this.outsideHandler);
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
    document.removeEventListener('click', this.outsideHandler);
  }

  toggle(e: Event): void {
    e.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      // La préférence « tout marquer lu » s'applique dès l'ouverture (badge → 0).
      this.notificationService.onPanelOpened();
    }
  }

  markAllSeen(): void {
    this.notificationService.clearAll();
  }

  /** Active/désactive la préférence persistée « tout marquer lu à l'ouverture ». */
  toggleMarkAllOnOpen(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.notificationService.setMarkAllOnOpen(checked);
    if (checked && this.open) {
      this.notificationService.onPanelOpened();
    }
  }

  /** Bascule lu/non lu (persisté) sans naviguer. */
  dismiss(e: Event, id: string): void {
    e.stopPropagation();
    this.notificationService.toggleRead(id);
  }

  go(n: AppNotification): void {
    // Lu = basculé durablement, y compris après refresh.
    this.notificationService.markRead(n.id);
    this.open = false;
    switch (n.icon) {
      case 'reservation': this.router.navigate(['/reservations']); break;
      case 'due': this.router.navigate(['/return-book']); break;
      default: this.router.navigate(['/borrow-book']);
    }
  }
}
