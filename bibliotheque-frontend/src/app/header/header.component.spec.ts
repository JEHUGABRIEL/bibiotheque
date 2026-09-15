import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { HeaderComponent } from './header.component';
import { UserAuthService } from '../_service/user-auth.service';

/**
 * Tests de l'en-tête : affichage conditionnel du bouton Connexion et
 * déconnexion (purge de la session, sans toucher aux préférences).
 */
describe('HeaderComponent', () => {

  function setup(opts: { loggedIn?: boolean; name?: string } = {}) {
    localStorage.clear();
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('lang', 'fr');
    if (opts.loggedIn !== false) {
      localStorage.setItem('roles', JSON.stringify([{ roleName: 'ADHERENT' }]));
      localStorage.setItem('jwtToken', 'jwt-abc');
    }
    if (opts.name) {
      localStorage.setItem('name', JSON.stringify(opts.name));
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      imports: [CommonModule, HttpClientTestingModule, RouterTestingModule]
    });

    const fixture = TestBed.createComponent(HeaderComponent);
    const component: any = fixture.componentInstance;
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');        // isLoggedIn() journalise le nom (console.log volontairement non espionné)

    return { fixture, component, router };
  }

  afterEach(() => localStorage.clear());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  it('lit le nom du compte connecté à la construction', () => {
    const ctx = setup({ loggedIn: false, name: 'Jehu Binga' });
    expect(ctx.component.name).toBe('Jehu Binga');
  });

  it('isLoggedIn suit l\'état de la session', () => {
    expect(setup({ loggedIn: true }).component.isLoggedIn()).toBeTruthy();
    expect(setup({ loggedIn: false }).component.isLoggedIn()).toBeFalsy();
  });

  it('n\'affiche le bouton Connexion que hors session', () => {
    const loggedOut = setup({ loggedIn: false });
    loggedOut.fixture.detectChanges();
    expect(loggedOut.fixture.nativeElement.querySelector('.btn-login')).toBeTruthy();

    const loggedIn = setup({ loggedIn: true });
    loggedIn.fixture.detectChanges();
    expect(loggedIn.fixture.nativeElement.querySelector('.btn-login')).toBeNull();
  });

  it('logout purge la session sans effacer les préférences et renvoie à l\'accueil', () => {
    const ctx = setup({ loggedIn: true, name: 'Jehu Binga' });
    ctx.fixture.detectChanges();

    ctx.component.logout();

    const auth = TestBed.inject(UserAuthService);
    expect(auth.getToken()).toBeNull();
    expect(localStorage.getItem('roles')).toBeNull();
    // Préférences préservées (cf. UserAuthService.clear)
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('lang')).toBe('fr');

    expect(ctx.router.navigate).toHaveBeenCalledWith(['/']);
  });
});
