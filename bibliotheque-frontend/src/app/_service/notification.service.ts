import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Borrow, StatutBorrow } from '../_model/borrow';
import { Reservation, StatutReservation } from '../_model/reservation';
import { BorrowService } from './borrow.service';
import { ReservationService } from './reservation.service';
import { BooksService } from './books.service';
import { UserAuthService } from './user-auth.service';
import { UsersService } from './users.service';

export interface AppNotification {
  id: string;
  icon: 'borrow' | 'reservation' | 'due';
  title: string;
  detail: string;
  /** Date clé affichée dans la notification (confirmation, échéance ou expiration). */
  date?: string;
  urgent?: boolean;
  /** Lu = présent dans l'état persisté. Calculé à la publication, pas stocké. */
  read?: boolean;
}

/**
 * État de lecture persisté par utilisateur :
 * `{ "<userId>": { dismissed: ["<notifId>", …], markAllOnOpen: true, savedAt } }`
 * Les identifiants lus survivent au rafraîchissement de la page et sont
 * isolés entre comptes (un navigateur partagé ne mélange pas les lectures).
 */
interface NotifReadEntry {
  dismissed: string[];
  /** Préférence : tout marquer lu dès l'ouverture du panneau. */
  markAllOnOpen?: boolean;
  savedAt: number;
}

/** Nb max d'IDs conservés par utilisateur (bornage du localStorage). */
const MAX_DISMISSED = 200;

/**
 * Notifications « cloche » — calculées côté client à partir des données
 * existantes (emprunts + réservations), sans nouveau endpoint backend.
 *
 * - BIBLIOTHECAIRE/Admin : demandes d'emprunt et de réservation en attente,
 *   emprunts dont l'échéance est proche ou dépassée.
 * - ADHERENT/User : réponses à ses demandes (validée/refusée), rappels
 *   d'échéance et de réservation disponible.
 *
 * Le flux publié contient TOUTES les notifications avec leur état lu
 * (`read: true|false`) ; le badge ne compte que les non lues. L'état lu est
 * persisté par utilisateur et survit au refresh comme à la déconnexion.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {

  private static readonly STORAGE_KEY = 'bibliotheque.notifRead';
  /** Annulations faites PAR l'adhérent lui-même — pour ne pas les afficher comme « refusées ». */
  private static readonly SELF_CANCEL_KEY = 'bibliotheque.notifSelfCancel';

  private notifications$ = new BehaviorSubject<AppNotification[]>([]);
  private refreshTimer: any = null;

  /** IDs lus pour le compte courant. */
  private dismissed = new Set<string>();
  private stateUserId: number | null = null;
  private markAllOnOpen = false;
  /** Clés « res-<id> » annulées par l'adhérent lui-même (persitées par compte). */
  private selfCancelled = new Set<string>();
  /** Noms de livres pour des notifications lisibles (titre au lieu de « Livre #id »). */
  private bookNames = new Map<number, string>();

  readonly notifications = this.notifications$.asObservable();

  constructor(
    private borrowService: BorrowService,
    private reservationService: ReservationService,
    private booksService: BooksService,
    private userAuthService: UserAuthService,
    private usersService: UsersService
  ) {}

  /** À appeler quand l'adhérent annule LUI-MÊME une réservation (pas un refus staff). */
  markSelfCancelled(key: string): void {
    this.selfCancelled.add(key);
    this.persistSelfCancelled();
  }

  private persistSelfCancelled(): void {
    const userId = this.stateUserId;
    if (userId == null) return;
    try {
      const raw = localStorage.getItem(NotificationService.SELF_CANCEL_KEY);
      const all: Record<string, string[]> = raw ? JSON.parse(raw) : {};
      all[String(userId)] = Array.from(this.selfCancelled).slice(-MAX_DISMISSED);
      localStorage.setItem(NotificationService.SELF_CANCEL_KEY, JSON.stringify(all));
    } catch {
      // localStorage indisponible : dégradation silencieuse.
    }
  }

  private loadSelfCancelledFor(userId: number | null): void {
    this.selfCancelled = new Set();
    if (userId == null) return;
    try {
      const raw = localStorage.getItem(NotificationService.SELF_CANCEL_KEY);
      const all: Record<string, string[]> = raw ? JSON.parse(raw) : {};
      const ids = all[String(userId)];
      if (Array.isArray(ids)) {
        this.selfCancelled = new Set(ids);
      }
    } catch {
      // JSON corrompu : on repart de zéro.
    }
  }

  private bookName(bookId: number | undefined): string {
    if (bookId === null || bookId === undefined) return 'un livre';
    return this.bookNames.get(bookId) || 'Livre #' + bookId;
  }

  /** Nombre de notifications NON LUES (badge de la cloche). */
  get unreadCount(): number {
    return this.notifications$.value.filter(n => !n.read).length;
  }

  /** Préférence « tout marquer lu à l'ouverture » du compte courant. */
  get isMarkAllOnOpen(): boolean {
    return this.markAllOnOpen;
  }

  /** Active/désactive la préférence « tout marquer lu à l'ouverture » (persisté). */
  setMarkAllOnOpen(value: boolean): void {
    this.markAllOnOpen = value;
    this.persistState();
  }

  /** Marque TOUTES les notifications comme lues (persisté). */
  clearAll(): void {
    this.notifications$.value.forEach(n => this.dismissed.add(n.id));
    this.persistState();
    this.publishCurrent();
  }

  /** Marque UNE notification comme lue (persisté). */
  markRead(id: string): void {
    if (!this.dismissed.has(id)) {
      this.dismissed.add(id);
      this.persistState();
    }
    this.publishCurrent();
  }

  /** Bascule l'état lu/non lu d'une notification (persisté). */
  toggleRead(id: string): void {
    if (this.dismissed.has(id)) {
      this.dismissed.delete(id);
    } else {
      this.dismissed.add(id);
    }
    this.persistState();
    this.publishCurrent();
  }

  /**
   * Appelé à l'ouverture du panneau : si la préférence est active, tout le
   * contenu courant passe en « lu » immédiatement (badge à 0).
   */
  onPanelOpened(): void {
    if (this.markAllOnOpen) {
      this.clearAll();
    }
  }

  /**
   * Recharge les notifications selon le rôle du compte connecté.
   * Silencieux : toute erreur (réseau, 403) laisse la liste telle quelle.
   */
  refresh(): void {
    this.loadStateFor(this.userAuthService.getUserId());
    this.loadSelfCancelledFor(this.userAuthService.getUserId());
    if (this.usersService.isStaff()) {
      this.refreshForStaff();
    } else {
      this.refreshForMember();
    }
  }

  /** Republie l'état courant en recalculant les flags `read`. */
  private publishCurrent(): void {
    const current = this.notifications$.value.map(n => ({ ...n, read: this.dismissed.has(n.id) }));
    this.notifications$.next(current);
  }

  private set(list: AppNotification[]): void {
    this.notifications$.next(
      list.map(n => ({ ...n, read: this.dismissed.has(n.id) }))
    );
  }

  // ------------------------------------------------------------------
  // État persisté par utilisateur
  // ------------------------------------------------------------------

  private loadStateFor(userId: number | null): void {
    if (this.stateUserId === userId) {
      return; // état déjà chargé pour ce compte
    }
    this.stateUserId = userId;
    this.dismissed = new Set();
    this.markAllOnOpen = false;
    if (userId == null) {
      return;
    }
    try {
      const raw = localStorage.getItem(NotificationService.STORAGE_KEY);
      if (!raw) {
        return;
      }
      const all = JSON.parse(raw) as Record<string, NotifReadEntry>;
      const entry = all[String(userId)];
      if (entry) {
        if (Array.isArray(entry.dismissed)) {
          this.dismissed = new Set(entry.dismissed);
        }
        this.markAllOnOpen = !!entry.markAllOnOpen;
      }
    } catch {
      // JSON corrompu ou localStorage indisponible : on repart de zéro.
    }
  }

  private persistState(): void {
    const userId = this.stateUserId;
    if (userId == null) {
      return;
    }
    try {
      const raw = localStorage.getItem(NotificationService.STORAGE_KEY);
      const all: Record<string, NotifReadEntry> = raw ? JSON.parse(raw) : {};
      all[String(userId)] = {
        dismissed: Array.from(this.dismissed).slice(-MAX_DISMISSED),
        markAllOnOpen: this.markAllOnOpen,
        savedAt: Date.now()
      };
      localStorage.setItem(NotificationService.STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Quota dépassé ou localStorage indisponible : dégradation silencieuse.
    }
  }

  /**
   * Élimine les IDs lus dont la source n'existe plus (demande traitée,
   * emprunt rendu…) pour garder le stockage propre, puis persiste si besoin.
   */
  private pruneDismissed(currentIds: Set<string>): void {
    if (this.dismissed.size === 0) {
      return;
    }
    const before = this.dismissed.size;
    for (const id of Array.from(this.dismissed)) {
      if (!currentIds.has(id)) {
        this.dismissed.delete(id);
      }
    }
    if (this.dismissed.size !== before) {
      this.persistState();
    }
  }

  private fmt(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
  }

  // ------------------------------------------------------------------
  // Personnel : demandes en attente + échéances
  // ------------------------------------------------------------------

  /** Charge les noms de livres une fois (session), puis construit les notifications. */
  private withBookNames(next: (names: Map<number, string>) => void): void {
    if (this.bookNames.size > 0) {
      next(this.bookNames);
      return;
    }
    this.booksService.getBooksList().subscribe({
      next: (books) => {
        books.forEach(b => this.bookNames.set(b.bookId, b.bookName));
        next(this.bookNames);
      },
      error: () => next(this.bookNames) // dégradé : « Livre #id » à la place
    });
  }

  private refreshForStaff(): void {
    this.withBookNames(names => {
      this.loadStaffPending(names);
    });
  }

  private loadStaffPending(names: Map<number, string>): void {
    const list: AppNotification[] = [];

    this.borrowService.getPendingBorrows().subscribe({
      next: (pending) => {
        pending.forEach(b => list.push({
          id: 'borrow-pending-' + b.borrowId,
          icon: 'borrow',
          title: 'Demande d\'emprunt',
          detail: `Emprunt de « ${names.get(b.bookId) || 'Livre #' + b.bookId} » à traiter`,
          date: b.issueDate ? this.fmt(b.issueDate) : undefined
        }));
        this.loadStaffReservations(list, names);
      },
      error: () => this.loadStaffReservations(list, names)
    });
  }

  private loadStaffReservations(list: AppNotification[], names: Map<number, string>): void {
    this.reservationService.getAll().subscribe({
      next: (reservations) => {
        reservations
          .filter(r => r.statut === StatutReservation.DEMANDE)
          .forEach(r => list.push({
            id: 'res-demand-' + r.id,
            icon: 'reservation',
            title: 'Demande de réservation à traiter',
            detail: `« ${names.get(r.bookId) || 'Livre #' + r.bookId} » — adhérent #${r.userId}`,
            date: r.dateReservation ? this.fmt(r.dateReservation) : undefined,
            urgent: true
          }));
        reservations
          .filter(r => r.statut === StatutReservation.EN_ATTENTE)
          .forEach(r => list.push({
            id: 'res-pending-' + r.id,
            icon: 'reservation',
            title: 'Réservation en attente',
            detail: `« ${names.get(r.bookId) || 'Livre #' + r.bookId} » — adhérent #${r.userId}`,
            date: r.dateExpiration ? this.fmt(r.dateExpiration) : undefined
          }));
        this.loadStaffDueSoon(list, names);
      },
      error: () => this.loadStaffDueSoon(list, names)
    });
  }

  private loadStaffDueSoon(list: AppNotification[], names: Map<number, string>): void {
    this.borrowService.getBorrowList().subscribe({
      next: (borrows) => {
        const soon = Date.now() + 48 * 3600 * 1000;
        borrows
          .filter(b => !b.returnDate && b.dueDate)
          .forEach(b => {
            const due = new Date(b.dueDate!).getTime();
            if (due < Date.now()) {
              list.push({
                id: 'borrow-late-' + b.borrowId,
                icon: 'due',
                title: 'Emprunt en retard',
                detail: `« ${names.get(b.bookId) || 'Livre #' + b.bookId} » — utilisateur #${b.userId}`,
                date: this.fmt(b.dueDate),
                urgent: true
              });
            } else if (due <= soon) {
              list.push({
                id: 'borrow-due-' + b.borrowId,
                icon: 'due',
                title: 'Retour attendu sous 48h',
                detail: `« ${names.get(b.bookId) || 'Livre #' + b.bookId} » — utilisateur #${b.userId}`,
                date: this.fmt(b.dueDate)
              });
            }
          });
        this.pruneDismissed(new Set(list.map(n => n.id)));
        this.set(list);
      },
      error: () => this.set(list)
    });
  }

  // ------------------------------------------------------------------
  // Adhérent : réponses, échéances, réservation disponible
  // ------------------------------------------------------------------

  private refreshForMember(): void {
    const userId = this.userAuthService.getUserId();
    if (!userId) {
      this.set([]);
      return;
    }
    this.withBookNames(() => {
      this.loadMemberBorrows(userId);
    });
  }

  private loadMemberBorrows(userId: number): void {
    const list: AppNotification[] = [];

    this.borrowService.getBooksBorrowedByUser(userId).subscribe({
      next: (borrows) => {
        borrows.forEach(b => {
          if (b.statut === StatutBorrow.VALIDEE) {
            list.push({
              id: 'my-borrow-' + b.borrowId,
              icon: 'borrow',
              title: 'Demande d\'emprunt confirmée',
              detail: `« ${this.bookName(b.bookId)} » accepté — à rendre le ${b.dueDate ? this.fmt(b.dueDate) : '—'}`,
              date: b.dueDate ? this.fmt(b.dueDate) : undefined
            });
          } else if (b.statut === StatutBorrow.EN_ATTENTE) {
            list.push({
              id: 'my-borrow-pending-' + b.borrowId,
              icon: 'borrow',
              title: 'Demande d\'emprunt envoyée',
              detail: `« ${this.bookName(b.bookId)} » — en attente de décision du bibliothécaire`,
              date: b.issueDate ? this.fmt(b.issueDate) : undefined
            });
          } else if (b.statut === StatutBorrow.REFUSEE) {
            list.push({
              id: 'my-borrow-refused-' + b.borrowId,
              icon: 'borrow',
              title: 'Demande d\'emprunt refusée',
              detail: `« ${this.bookName(b.bookId)} » a été refusé par le bibliothécaire`,
              date: b.returnDate ? this.fmt(b.returnDate) : undefined
            });
          }
        });
        this.loadMemberReservations(list, userId);
      },
      error: () => this.loadMemberReservations(list, userId)
    });
  }

  private loadMemberReservations(list: AppNotification[], userId: number): void {
    this.reservationService.getAll().subscribe({
      next: (reservations) => {
        reservations
          .filter(r => r.userId === userId && (r.statut === StatutReservation.DEMANDE || r.statut === StatutReservation.EN_ATTENTE || r.statut === StatutReservation.DISPONIBLE))
          .forEach(r => {
            const label = this.bookName(r.bookId);
            if (r.statut === StatutReservation.DEMANDE) {
              list.push({
                id: 'my-res-demand-' + r.id,
                icon: 'reservation',
                title: 'Demande de réservation envoyée',
                detail: `« ${label} » — en attente d'acceptation par le bibliothécaire`,
                date: r.dateReservation ? this.fmt(r.dateReservation) : undefined
              });
            } else if (r.statut === StatutReservation.DISPONIBLE) {
              list.push({
                id: 'my-res-available-' + r.id,
                icon: 'reservation',
                title: 'Livre réservé disponible',
                detail: `« ${label} » vous attend`,
                date: r.dateExpiration ? this.fmt(r.dateExpiration) : undefined,
                urgent: true
              });
            } else {
              list.push({
                id: 'my-res-pending-' + r.id,
                title: 'Réservation acceptée',
                icon: 'reservation',
                detail: `« ${label} » est réservé pour vous`,
                date: r.dateExpiration ? this.fmt(r.dateExpiration) : undefined
              } as AppNotification);
            }
          });
        reservations
          .filter(r => r.userId === userId && r.statut === StatutReservation.ANNULEE)
          .forEach(r => {
            const key = 'res-' + r.id;
            // Annulée PAR l'adhérent lui-même : pas une « réponse », on n'affiche pas.
            if (this.selfCancelled.has(key)) return;
            list.push({
              id: 'my-res-refused-' + r.id,
              icon: 'reservation',
              title: 'Demande de réservation refusée',
              detail: `« ${this.bookName(r.bookId)} » a été refusée par le bibliothécaire`,
              date: r.dateReservation ? this.fmt(r.dateReservation) : undefined
            });
          });
        this.pruneDismissed(new Set(list.map(n => n.id)));
        this.set(list);
      },
      error: () => this.set(list)
    });
  }

  /** Auto-refresh périodique pendant la session. */
  startPolling(): void {
    this.stopPolling();
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), 60_000);
  }

  stopPolling(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
