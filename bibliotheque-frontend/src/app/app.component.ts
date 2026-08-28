import { Component, OnInit } from '@angular/core';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { UserAuthService } from './_service/user-auth.service';
import { ThemeService } from './_service/theme.service';
import { TranslationService } from './_service/translation.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'bibliotheque-frontend';
  sidebarOpen = false;
  loading = true;

  constructor(
    private userAuthService: UserAuthService,
    private router: Router,
    public themeService: ThemeService,
    public translationService: TranslationService
  ) {}

  ngOnInit() {
    // Loading initial (splash screen)
    setTimeout(() => {
      this.loading = false;
    }, 1200);

    // Loading pendant les navigations
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart || event instanceof NavigationEnd)
    ).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loading = true;
      } else if (event instanceof NavigationEnd) {
        setTimeout(() => {
          this.loading = false;
        }, 400);
      }
    });
  }

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
