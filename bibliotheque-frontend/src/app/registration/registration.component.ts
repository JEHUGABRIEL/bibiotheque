import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Users } from '../_model/users';
import { UsersService } from '../_service/users.service';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css']
})
export class RegistrationComponent implements OnInit {

  user: Users = new Users();
  selectedRole = '';
  loading = false;
  showPassword = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private usersService: UsersService,
    private router: Router) { }

  ngOnInit(): void {
  }

  get isFormValid(): boolean {
    return !!(this.user.name?.trim() &&
              this.user.username?.trim() &&
              this.user.password?.trim() &&
              this.selectedRole);
  }

  saveUser() {
    this.loading = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.user.role = [{ roleName: this.selectedRole }];

    this.usersService.createUser(this.user).subscribe({
      next: (data) => {
        this.loading = false;
        this.successMessage = 'Adhérent inscrit avec succès !';
        setTimeout(() => this.goToUsersList(), 1500);
      },
      error: (error) => {
        this.loading = false;
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Une erreur est survenue lors de l\'inscription.';
        }
      }
    });
  }

  goToUsersList() {
    this.router.navigate(['/users']);
  }

  onSubmit() {
    if (this.isFormValid && !this.loading) {
      this.saveUser();
    }
  }

}
