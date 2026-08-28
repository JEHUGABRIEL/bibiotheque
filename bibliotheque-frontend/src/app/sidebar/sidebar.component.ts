import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { UserAuthService } from '../_service/user-auth.service';
import { UsersService } from '../_service/users.service';
import { TranslationService } from '../_service/translation.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {

  private _sidebarOpen = false;

  @Input()
  set sidebarOpen(value: boolean) {
    this._sidebarOpen = value;
  }

  @HostBinding('class.sidebar-open')
  get isOpen(): boolean {
    return this._sidebarOpen;
  }

  @Output() logoutRequest = new EventEmitter<void>();

  showLogoutConfirm = false;

  constructor(
    public userService: UsersService,
    private userAuthService: UserAuthService,
    private router: Router,
    public t: TranslationService
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

  openLogoutConfirm() {
    this.logoutRequest.emit();
  }
}
