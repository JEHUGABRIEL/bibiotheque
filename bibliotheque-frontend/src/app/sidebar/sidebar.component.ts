import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { UserAuthService } from '../_service/user-auth.service';
import { UsersService } from '../_service/users.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {

  @Input() sidebarOpen = false;

  constructor(
    public userService: UsersService,
    private userAuthService: UserAuthService,
    private router: Router
  ) {}

  get isAdmin(): boolean {
    return this.userService.roleMatch(['Admin']);
  }

  get isUser(): boolean {
    return this.userService.roleMatch(['User']);
  }

  get isLoggedIn(): boolean {
    return !!this.userAuthService.isLoggedIn();
  }

  get userName(): string {
    return this.userAuthService.getName() || '';
  }

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase();
  }

  isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(path + '/');
  }

  logout() {
    this.userAuthService.clear();
    this.router.navigate(['/']);
  }
}
