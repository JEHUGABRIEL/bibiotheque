import { Component } from '@angular/core';
import { UserAuthService } from './_service/user-auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'bibliotheque-frontend';
  sidebarOpen = false;

  constructor(private userAuthService: UserAuthService) {}

  get isLoggedIn(): boolean {
    return !!this.userAuthService.isLoggedIn();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }
}
