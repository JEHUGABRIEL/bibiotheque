import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeSubject = new BehaviorSubject<Theme>(
    (localStorage.getItem('theme') as Theme) || 'light'
  );

  theme$ = this.themeSubject.asObservable();

  get theme(): Theme {
    return this.themeSubject.value;
  }

  set theme(t: Theme) {
    this.themeSubject.next(t);
    localStorage.setItem('theme', t);
    this.applyTheme(t);
  }

  constructor() {
    this.applyTheme(this.theme);
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
  }

  private applyTheme(t: Theme): void {
    const body = document.body;
    if (t === 'light') {
      body.classList.add('light-theme');
    } else {
      body.classList.remove('light-theme');
    }
  }
}
