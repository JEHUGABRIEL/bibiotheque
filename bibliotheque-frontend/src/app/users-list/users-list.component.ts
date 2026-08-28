import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Users } from '../_model/users';
import { UsersService } from '../_service/users.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-users-list',
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {

  users: Users[] = [];
  loading = false;
  showCreateModal = false;
  showEditModal = false;
  editUser: Users = new Users();
  editUserId: number = 0;

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

  constructor(private usersService: UsersService,
    private router: Router) { }

  ngOnInit(): void {
    this.getUsers();
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

  userDetails(userId: number) {
    this.router.navigate(['user-details', userId]);
  }

  updateUser(userId: number) {
    this.router.navigate(['update-user', userId]);
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
