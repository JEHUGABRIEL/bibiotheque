import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Books } from '../_model/books';
import { Users } from '../_model/users';
import { Borrow } from '../_model/borrow';
import { Reservation, StatutReservation } from '../_model/reservation';
import { BooksService } from '../_service/books.service';
import { UsersService } from '../_service/users.service';
import { BorrowService } from '../_service/borrow.service';
import { ReservationService } from '../_service/reservation.service';
import { TranslationService } from '../_service/translation.service';

/** Stat clé du tableau de bord. */
interface Stat {
  key: 'books' | 'users' | 'borrows' | 'reservations';
  icon: string;      // chevron du dégradé (bleu/violet/vert/orange)
  value: number | null;
  detail: string;
}

/** Segment du donut réservations. */
interface Segment {
  key: StatutReservation;
  count: number;
  color: string;
  dash: number;   // longueur d'arc SVG
  offset: number; // départ d'arc SVG
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  loading = true;
  error: string | null = null;

  stats: Stat[] = [];
  segments: Segment[] = [];

  /** Total affiché au centre du donut. */
  get totalReservations(): number {
    return this.segments.reduce((sum, s) => sum + s.count, 0);
  }

  totalCopies = 0;
  activeBorrows = 0;
  overdueBorrows = 0;
  reservationPending = 0;

  /** 7 derniers jours — réservations créées + emprunts (pour la courbe). */
  weekLabels: string[] = [];
  weekReservations: number[] = [];
  weekBorrows: number[] = [];
  weekMax = 4;

  /** Top genres des livres (barres horizontales). */
  genres: { name: string; count: number; pct: number }[] = [];

  /** Activité récente fusionnée, les 6 plus récents. */
  activity: { icon: string; label: string; detail: string; when: string; color: string }[] = [];

  /** Liens des cartes de stats. */
  readonly statLinks: Record<Stat['key'], string> = {
    books: '/books',
    users: '/users',
    borrows: '/reservations',
    reservations: '/reservations',
  };

  constructor(
    private booksService: BooksService,
    private usersService: UsersService,
    private borrowService: BorrowService,
    private reservationService: ReservationService,
    public t: TranslationService
  ) { }

  /** Actions rapides — les deux premières n'ont de sens que pour un Admin. */
  get canManageBooks(): boolean {
    return this.usersService.roleMatch(['Admin']);
  }

  get canManageUsers(): boolean {
    return this.usersService.roleMatch(['Admin']);
  }

  ngOnInit(): void {
    this.loadAll();
  }

  onRetry(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      books: this.booksService.getBooksList(),
      users: this.usersService.getUsersList(),
      borrows: this.borrowService.getBorrowList(),
      reservations: this.reservationService.getAll()
    }).subscribe({
      next: (data) => this.build(data.books, data.users, data.borrows, data.reservations),
      error: (err) => {
        this.loading = false;
        this.error = (err?.status === 0)
          ? 'Le serveur est injoignable. Vérifiez que le backend est démarré.'
          : `Erreur ${err?.status} : ${err?.error?.message || 'Une erreur est survenue'}`;
      }
    });
  }

  private build(books: Books[], users: Users[], borrows: Borrow[], reservations: Reservation[]): void {
    // ---- Cartes de stats ----
    const totalCopies = books.reduce((sum, b) => sum + (b.noOfCopies ?? 0), 0);
    const now = Date.now();
    const activeBorrows = borrows.filter(b => !b.returnDate).length;
    const overdue = borrows.filter(b => !b.returnDate && b.dueDate && new Date(b.dueDate).getTime() < now).length;
    const pending = reservations.filter(r => r.statut === StatutReservation.EN_ATTENTE).length;

    this.totalCopies = totalCopies;
    this.activeBorrows = activeBorrows;
    this.overdueBorrows = overdue;
    this.reservationPending = pending;

    this.stats = [
      { key: 'books',         icon: 'linear-gradient(135deg, #4f6df5, #7c4dff)',  value: books.length,        detail: totalCopies + ' ex. en rayon' },
      { key: 'users',         icon: 'linear-gradient(135deg, #7c4dff, #b44cd4)',  value: users.length,        detail: 'adhérents inscrits' },
      { key: 'borrows',       icon: 'linear-gradient(135deg, #2fbf71, #7bd88f)',  value: borrows.length,      detail: activeBorrows + ' en cours' },
      { key: 'reservations',  icon: 'linear-gradient(135deg, #f5a623, #f7c948)',  value: reservations.length, detail: pending + ' en attente' },
    ];

    // ---- Donut réservations par statut ----
    this.segments = this.buildSegments(reservations);

    // ---- Courbe 7 jours ----
    this.buildWeek(borrows, reservations);

    // ---- Genres ----
    this.genres = this.buildGenres(books);

    // ---- Activité récente ----
    this.buildActivity(books, users, borrows, reservations);

    this.loading = false;
  }

  private buildSegments(reservations: Reservation[]): Segment[] {
    const colors: Record<StatutReservation, string> = {
      [StatutReservation.EN_ATTENTE]: '#f5a623',
      [StatutReservation.DISPONIBLE]: '#4f6df5',
      [StatutReservation.HONOREE]:    '#2fbf71',
      [StatutReservation.ANNULEE]:    '#8b8fa3',
      [StatutReservation.EXPIREE]:    '#dc3545',
    };
    const counts = new Map<StatutReservation, number>();
    for (const r of reservations) {
      counts.set(r.statut, (counts.get(r.statut) ?? 0) + 1);
    }
    const total = reservations.length;
    const CIRC = 2 * Math.PI * 42;
    let offset = 0;
    const segments: Segment[] = [];
    for (const key of [
      StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE, StatutReservation.HONOREE,
      StatutReservation.ANNULEE, StatutReservation.EXPIREE
    ]) {
      const count = counts.get(key) ?? 0;
      if (count === 0) { continue; }
      const dash = total > 0 ? (count / total) * CIRC : 0;
      segments.push({ key, count, color: colors[key], dash, offset });
      offset += dash;
    }
    return segments;
  }

  private buildWeek(borrows: Borrow[], reservations: Reservation[]): void {
    const days = 7;
    const res: number[] = [];
    const bor: number[] = [];
    const labels: string[] = [];
    const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - i);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      labels.push(i === 0 ? 'Auj.' : fmt.format(start));

      res.push(reservations.filter(r => inDay(r.dateReservation, start, end)).length);
      bor.push(borrows.filter(b => inDay(b.issueDate, start, end)).length);
    }
    this.weekLabels = labels;
    this.weekReservations = res;
    this.weekBorrows = bor;
    this.weekMax = Math.max(4, ...res, ...bor);
  }

  private buildGenres(books: Books[]): { name: string; count: number; pct: number }[] {
    const counts = new Map<string, number>();
    for (const b of books) {
      const g = (b.bookGenre || 'Sans genre').trim();
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const list = [...counts.entries()]
      .map(([name, count]) => ({ name, count, pct: 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const max = Math.max(1, ...list.map(g => g.count));
    list.forEach(g => g.pct = Math.round((g.count / max) * 100));
    return list;
  }

  private buildActivity(books: Books[], users: Users[], borrows: Borrow[], reservations: Reservation[]): void {
    const bookName = new Map<number, string>(books.map(b => [b.bookId, b.bookName]));
    const userName = new Map<number, string>(users.map(u => [u.userId, u.name]));

    type Item = { icon: string; label: string; detail: string; when: Date | null; color: string };
    const items: Item[] = [];

    for (const r of reservations) {
      items.push({
        icon: 'r', color: '#f5a623',
        label: 'Réservation — ' + (bookName.get(r.bookId) ?? 'livre #' + r.bookId),
        detail: (userName.get(r.userId) ?? 'adhérent #' + r.userId) + ' · ' + this.t.t(statusKey(r.statut)),
        when: r.dateReservation ? new Date(r.dateReservation) : null,
      });
    }
    for (const b of borrows) {
      items.push({
        icon: 'b', color: '#4f6df5',
        label: 'Emprunt — ' + (bookName.get(b.bookId) ?? 'livre #' + b.bookId),
        detail: (userName.get(b.userId) ?? 'adhérent #' + b.userId) + (b.returnDate ? ' · retourné' : ' · en cours'),
        when: b.issueDate ? new Date(b.issueDate) : null,
      });
    }
    for (const u of users) {
      items.push({
        icon: 'u', color: '#7c4dff',
        label: 'Inscription — ' + (u.name || u.username),
        detail: this.t.t(this.usersService.roleLabelKey(u.role?.[0]?.roleName ?? '')),
        when: null,
      });
    }

    const dated = items.filter(i => i.when !== null)
      .sort((a, b) => (b.when!.getTime() ?? 0) - (a.when!.getTime() ?? 0))
      .slice(0, 6);

    this.activity = dated.map(i => ({ ...i, when: this.relativeTime(i.when!) }));
  }

  private relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1)   return "à l'instant";
    if (min < 60)  return 'il y a ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24)    return 'il y a ' + h + ' h';
    const d = Math.floor(h / 24);
    if (d === 1)   return 'hier';
    if (d < 30)    return 'il y a ' + d + ' jours';
    return date.toLocaleDateString('fr-FR');
  }

  /** Barres de la courbe — hauteur en % pour le style inline. */
  barHeight(values: number[], i: number): number {
    return Math.round((values[i] / this.weekMax) * 100);
  }

  statusLabel(key: StatutReservation): string {
    return this.t.t(statusKey(key));
  }

  statLabel(key: Stat['key']): string {
    return this.t.t('dashboard.stat.' + key);
  }

  trackByStat(i: number, s: Stat) { return s.key; }
  trackBySegment(i: number, s: Segment) { return s.key; }
  trackByGenre(i: number, g: { name: string }) { return g.name; }
  trackByDay(i: number, l: string) { return l; }
  trackByActivity(i: number, a: { label: string }) { return a.label; }
}

function inDay(value: Date | string | undefined | null, start: Date, end: Date): boolean {
  if (!value) { return false; }
  const t = new Date(value).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function statusKey(statut: StatutReservation): string {
  switch (statut) {
    case StatutReservation.EN_ATTENTE: return 'status.pending';
    case StatutReservation.DISPONIBLE: return 'status.available';
    case StatutReservation.ANNULEE:    return 'status.cancelled';
    case StatutReservation.EXPIREE:    return 'status.expired';
    case StatutReservation.HONOREE:    return 'status.fulfilled';
  }
}
