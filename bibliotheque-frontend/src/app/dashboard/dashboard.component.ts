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
import { UserAuthService } from '../_service/user-auth.service';
import { TranslationService } from '../_service/translation.service';

/** Stat clé du tableau de bord. */
interface Stat {
  key: 'books' | 'users' | 'borrows' | 'reservations';
  icon: string;
  value: number | null;
  detail: string;
}

/** Segment du donut réservations. */
interface Segment {
  key: StatutReservation;
  count: number;
  color: string;
  dash: number;
  offset: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  loading = true;
  error: string | null = null;

  // Staff-only data
  stats: Stat[] = [];
  segments: Segment[] = [];
  totalCopies = 0;
  activeBorrows = 0;
  overdueBorrows = 0;
  reservationPending = 0;
  weekLabels: string[] = [];
  weekReservations: number[] = [];
  weekBorrows: number[] = [];
  weekMax = 4;
  genres: { name: string; count: number; pct: number }[] = [];
  activity: { icon: string; label: string; detail: string; when: string; color: string }[] = [];

  // Member data
  myBorrows: Borrow[] = [];
  myReservations: Reservation[] = [];
  bookNames = new Map<number, string>();
  borrowQuota = { activeCount: 0, maxQuota: 3, remaining: 3 };

  get totalReservations(): number {
    return this.segments.reduce((sum, s) => sum + s.count, 0);
  }

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
    private userAuthService: UserAuthService,
    public t: TranslationService
  ) { }

  get isStaff(): boolean {
    return this.usersService.isStaff();
  }

  get userName(): string {
    return this.userAuthService.getName() || '';
  }

  get canManageBooks(): boolean {
    return this.usersService.roleMatch(['Admin']);
  }

  get canManageUsers(): boolean {
    return this.usersService.roleMatch(['Admin']);
  }

  ngOnInit(): void {
    if (this.isStaff) {
      this.loadStaffDashboard();
    } else {
      this.loadMemberDashboard();
    }
  }

  onRetry(): void {
    this.ngOnInit();
  }

  // ==================== STAFF DASHBOARD ====================

  private loadStaffDashboard(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      books: this.booksService.getBooksList(),
      users: this.usersService.getUsersList(),
      borrows: this.borrowService.getBorrowList(),
      reservations: this.reservationService.getAll()
    }).subscribe({
      next: (data) => this.buildStaffDashboard(data.books, data.users, data.borrows, data.reservations),
      error: (err) => {
        this.loading = false;
        this.error = (err?.status === 0)
          ? this.t.t('common.serverDown')
          : `${this.t.t('error.status', { status: err?.status })} : ${err?.error?.message || this.t.t('error.generic')}`;
      }
    });
  }

  private buildStaffDashboard(books: Books[], users: Users[], borrows: Borrow[], reservations: Reservation[]): void {
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
      { key: 'books',         icon: 'linear-gradient(135deg, #4f6df5, #7c4dff)',  value: books.length,        detail: this.t.t('dashboard.stats.copies', { n: totalCopies }) },
      { key: 'users',         icon: 'linear-gradient(135deg, #7c4dff, #b44cd4)',  value: users.length,        detail: this.t.t('dashboard.members.registered') },
      { key: 'borrows',       icon: 'linear-gradient(135deg, #2fbf71, #7bd88f)',  value: borrows.length,      detail: this.t.t('dashboard.stats.borrows.detail', { n: activeBorrows }) },
      { key: 'reservations',  icon: 'linear-gradient(135deg, #f5a623, #f7c948)',  value: reservations.length, detail: this.t.t('dashboard.stats.reservations.detail', { n: pending }) },
    ];

    this.segments = this.buildSegments(reservations);
    this.buildWeek(borrows, reservations);
    this.genres = this.buildGenres(books);
    this.buildActivity(books, users, borrows, reservations);

    this.loading = false;
  }

  // ==================== MEMBER DASHBOARD ====================

  private loadMemberDashboard(): void {
    this.loading = true;
    this.error = null;

    const userId = this.userAuthService.getUserId();
    if (!userId) {
      this.loading = false;
      this.error = this.t.t('dashboard.user.unknown');
      return;
    }

    // Load books and borrows independently — reservations may fail for User role
    let booksLoaded = false;
    let borrowsLoaded = false;

    const checkDone = () => {
      if (booksLoaded && borrowsLoaded) {
        this.loading = false;
      }
    };

    this.booksService.getBooksList().subscribe({
      next: (books) => {
        books.forEach(b => this.bookNames.set(b.bookId, b.bookName));
        booksLoaded = true;
        checkDone();
      },
      error: () => { booksLoaded = true; checkDone(); }
    });

    this.borrowService.getBooksBorrowedByUser(userId).subscribe({
      next: (borrows) => {
        this.myBorrows = borrows;
        borrowsLoaded = true;
        checkDone();
      },
      error: () => { borrowsLoaded = true; checkDone(); }
    });

    // Load borrow quota
    this.borrowService.getMyQuota().subscribe({
      next: (quota) => { this.borrowQuota = quota; },
      error: () => {}
    });

    // Reservations: load if user has ADHERENT or User role
    if (this.usersService.roleMatch(['ADHERENT', 'User'])) {
      this.reservationService.getAll().subscribe({
        next: (reservations) => {
          this.myReservations = reservations.filter(r => r.userId === userId);
        },
        error: () => { /* ignore — show empty reservations */ }
      });
    }
  }

  getBookName(bookId: number): string {
    return this.bookNames.get(bookId) || 'Livre #' + bookId;
  }

  getStatutClassBorrow(statut: string): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE': 'status-badge status-en-attente',
      'VALIDEE': 'status-badge status-disponible',
      'REFUSEE': 'status-badge status-expiree',
      'EN_COURS': 'status-badge status-en-attente',
      'RENDU': 'status-badge status-honoree'
    };
    return classes[statut] || 'status-badge';
  }

  getStatutLabelBorrow(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': this.t.t('borrow.status.demande'),
      'VALIDEE': this.t.t('dashboard.status.validated'),
      'REFUSEE': this.t.t('dashboard.status.refused'),
      'EN_COURS': this.t.t('borrow.status.en_cours'),
      'RENDU': this.t.t('borrow.status.rendu')
    };
    return labels[statut] || statut;
  }

  getStatutClass(statut: StatutReservation): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE': 'status-badge status-en-attente',
      'DISPONIBLE': 'status-badge status-disponible',
      'ANNULEE': 'status-badge status-annulee',
      'EXPIREE': 'status-badge status-expiree',
      'HONOREE': 'status-badge status-honoree'
    };
    return classes[statut] || 'status-badge status-annulee';
  }

  get activeBorrowCount(): number {
    return this.myBorrows.filter(b => !b.returnDate).length;
  }

  get activeReservationCount(): number {
    return this.myReservations.filter(r =>
      r.statut === StatutReservation.EN_ATTENTE || r.statut === StatutReservation.DISPONIBLE
    ).length;
  }

  // ==================== SHARED HELPERS ====================

  private buildSegments(reservations: Reservation[]): Segment[] {
    const colors: Record<StatutReservation, string> = {
      [StatutReservation.DEMANDE]:      '#e67e22',
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
      StatutReservation.DEMANDE, StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE,
      StatutReservation.HONOREE, StatutReservation.ANNULEE, StatutReservation.EXPIREE
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
        label: this.t.t('dashboard.reservation.entry', { name: bookName.get(r.bookId) ?? this.t.t('dashboard.book.hash', { id: r.bookId }) }),
        detail: (userName.get(r.userId) ?? this.t.t('dashboard.member.hash', { id: r.userId })) + ' · ' + this.t.t(statusKey(r.statut)),
        when: r.dateReservation ? new Date(r.dateReservation) : null,
      });
    }
    for (const b of borrows) {
      items.push({
        icon: 'b', color: '#4f6df5',
        label: this.t.t('dashboard.activity.borrow', { name: bookName.get(b.bookId) ?? this.t.t('dashboard.book.hash', { id: b.bookId }) }),
        detail: (userName.get(b.userId) ?? this.t.t('dashboard.member.hash', { id: b.userId })) + (b.returnDate ? ' ' + this.t.t('dashboard.returned.suffix') : ' ' + this.t.t('dashboard.activity.ongoing')),
        when: b.issueDate ? new Date(b.issueDate) : null,
      });
    }
    for (const u of users) {
      items.push({
        icon: 'u', color: '#7c4dff',
        label: this.t.t('dashboard.activity.registration', { name: u.name || u.username }),
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
    case StatutReservation.DEMANDE:     return 'status.demand';
    case StatutReservation.EN_ATTENTE: return 'status.pending';
    case StatutReservation.DISPONIBLE: return 'status.available';
    case StatutReservation.ANNULEE:    return 'status.cancelled';
    case StatutReservation.EXPIREE:    return 'status.expired';
    case StatutReservation.HONOREE:    return 'status.fulfilled';
  }
}
