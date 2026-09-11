import { Component, OnInit } from '@angular/core';
import { Users } from '../_model/users';
import { Borrow } from '../_model/borrow';
import { Books } from '../_model/books';
import { UsersService } from '../_service/users.service';
import { BooksService } from '../_service/books.service';
import { BorrowService } from '../_service/borrow.service';
import { TranslationService } from '../_service/translation.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-users-list',
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {

  users: Users[] = [];
  loading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;

  get paginatedUsers(): Users[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.users.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.users.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get resultsInfo(): string {
    if (this.users.length === 0) return '';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.users.length);
    return `${start}–${end} sur ${this.users.length}`;
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
  showCreateModal = false;
  showEditModal = false;
  editUser: Users = new Users();
  editUserId: number = 0;

  showCreatePassword = false;

  // Create form
  newUser: Users = new Users();
  newSelectedRole = 'User';
  createLoading = false;
  createError: string | null = null;
  createSuccess: string | null = null;

  // Edit form
  editSelectedRole = '';
  editLoading = false;
  editError: string | null = null;
  editSuccess: string | null = null;

  // Details modal
  showDetailModal = false;
  detailLoading = false;
  detailError: string | null = null;
  detailUser: Users | null = null;
  detailBorrows: Borrow[] = [];

  /** Cache des livres pour afficher les titres dans l'historique d'emprunts. */
  booksCache: Books[] = [];

  constructor(private usersService: UsersService,
    private booksService: BooksService,
    private borrowService: BorrowService,
    public t: TranslationService) { }

  ngOnInit(): void {
    this.getUsers();
    this.booksService.getBooksList().subscribe(books => this.booksCache = books);
  }

  getBookName(bookId: number): string {
    const book = this.booksCache.find(b => b.bookId === bookId);
    return book ? book.bookName : 'Livre #' + bookId;
  }

  private getUsers() {
    this.loading = true;
    this.usersService.getUsersList().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /** Détails en modale — identité + historique d'emprunts de l'adhérent. */
  userDetails(userId: number) {
    this.showDetailModal = true;
    this.detailLoading = true;
    this.detailError = null;
    this.detailUser = null;
    this.detailBorrows = [];
    this.usersService.getUserById(userId).subscribe({
      next: (user) => {
        this.detailUser = user;
        this.borrowService.getBooksBorrowedByUser(userId).subscribe({
          next: (borrows) => {
            this.detailBorrows = borrows;
            this.detailLoading = false;
          },
          error: () => { this.detailLoading = false; }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.detailLoading = false;
        this.detailError = err.error?.message || 'Erreur ' + err.status;
        if (err.status === 403) { this.showDetailModal = false; }
      }
    });
  }

  /** Badge par rôle — les deux modèles de rôles sont supportés. */
  badgeClassForRole(roleName?: string): string {
    switch (roleName) {
      case 'Admin': return 'status-badge status-honoree';
      case 'BIBLIOTHECAIRE': return 'status-badge status-honoree';
      case 'ADHERENT': return 'status-badge status-disponible';
      default: return 'status-badge status-disponible';
    }
  }

  /** Libellé traduit par rôle — quel que soit le modèle. */
  roleLabelForRole(roleName?: string): string {
    return this.t.t(this.usersService.roleLabelKey(roleName || ''));
  }

  // --- Create modal ---
  openCreateModal() {
    this.newUser = new Users();
    this.newSelectedRole = 'User';
    this.createError = null;
    this.createSuccess = null;
    this.showCreateModal = true;
  }

  get isCreateValid(): boolean {
    return !!(this.newUser.name?.trim() &&
              this.newUser.username?.trim() &&
              this.newUser.password?.trim() &&
              this.newSelectedRole);
  }

  submitCreate() {
    this.createLoading = true;
    this.createError = null;
    this.createSuccess = null;
    this.newUser.role = [{ roleName: this.newSelectedRole }];
    this.usersService.createUser(this.newUser).subscribe({
      next: () => {
        this.createLoading = false;
        this.createSuccess = 'Adhérent inscrit avec succès';
        this.getUsers();
        setTimeout(() => {
          this.showCreateModal = false;
          this.createSuccess = null;
        }, 1200);
      },
      error: (err: HttpErrorResponse) => {
        this.createLoading = false;
        this.createError = err.error?.message || 'Erreur lors de l\'inscription';
      }
    });
  }

  // --- Edit modal ---
  openEditModal(user: Users) {
    this.editUser = { ...user };
    this.editUserId = user.userId;
    this.editSelectedRole = user.role?.[0]?.roleName || '';
    this.editError = null;
    this.editSuccess = null;
    this.showEditModal = true;
  }

  get isEditValid(): boolean {
    return !!(this.editUser.name?.trim() &&
              this.editUser.username?.trim() &&
              this.editSelectedRole);
  }

  submitEdit() {
    this.editLoading = true;
    this.editError = null;
    this.editSuccess = null;
    this.editUser.role = [{ roleName: this.editSelectedRole }];
    this.usersService.updateUser(this.editUserId, this.editUser).subscribe({
      next: () => {
        this.editLoading = false;
        this.editSuccess = 'Utilisateur modifié avec succès';
        this.getUsers();
        setTimeout(() => {
          this.showEditModal = false;
          this.editSuccess = null;
        }, 1200);
      },
      error: (err: HttpErrorResponse) => {
        this.editLoading = false;
        this.editError = err.error?.message || 'Erreur lors de la modification';
      }
    });
  }
}
