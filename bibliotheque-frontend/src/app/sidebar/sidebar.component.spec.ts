import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { SidebarComponent } from './sidebar.component';

/**
 * Tests de la barre latérale : sections affichées selon le rôle (les deux
 * modèles), identité du compte connecté et demande de déconnexion.
 */
describe('SidebarComponent', () => {

  function setup(opts: { role?: string; name?: string; token?: string } = {}) {
    localStorage.clear();
    if (opts.role) {
      localStorage.setItem('roles', JSON.stringify([{ roleName: opts.role }]));
    }
    if (opts.name) {
      localStorage.setItem('name', JSON.stringify(opts.name));
    }
    if (opts.token) {
      localStorage.setItem('jwtToken', opts.token);
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [SidebarComponent],
      imports: [CommonModule, HttpClientTestingModule, RouterTestingModule]
    });

    const fixture = TestBed.createComponent(SidebarComponent);
    const component: any = fixture.componentInstance;
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    return { fixture, component, router };
  }

  afterEach(() => localStorage.clear());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  describe('sections selon le rôle', () => {
    it('le personnel (Admin ou Bibliothécaire) voit la section Gestion', () => {
      ['Admin', 'BIBLIOTHECAIRE'].forEach(role => {
        const ctx = setup({ role, name: 'Staff', token: 'jwt' });
        expect(ctx.component.isAdmin).toBeTrue();
        expect(ctx.fixture.nativeElement.querySelector('a[href="/users"]')).toBeTruthy();
        expect(ctx.fixture.nativeElement.querySelector('a[href="/books"]')).toBeTruthy();
      });
    });

    it('un adhérent (User ou ADHERENT) ne voit pas la section Gestion', () => {
      ['User', 'ADHERENT'].forEach(role => {
        const ctx = setup({ role, name: 'Jehu', token: 'jwt' });
        expect(ctx.component.isUser).toBeTrue();
        expect(ctx.component.isAdmin).toBeFalse();
        expect(ctx.fixture.nativeElement.querySelector('a[href="/users"]')).toBeNull();
        expect(ctx.fixture.nativeElement.querySelector('a[href="/books"]')).toBeNull();
      });
    });

    it('rien n\'est rendu sans session ouverte', () => {
      const ctx = setup({ role: 'ADHERENT' });      // rôles sans jeton
      expect(ctx.component.isLoggedIn).toBeFalse();
      expect(ctx.fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    });

    it('marque le lien courant comme actif (chemin exact ou préfixe)', () => {
      const ctx = setup({ role: 'Admin', name: 'Staff', token: 'jwt' });
      spyOnProperty(ctx.router, 'url', 'get').and.returnValue('/books/12');

      expect(ctx.component.isActive('/books')).toBeTrue();
      expect(ctx.component.isActive('/users')).toBeFalse();
    });
  });

  describe('identité', () => {
    it('affiche le nom et l\'initiale du compte connecté', () => {
      const ctx = setup({ role: 'ADHERENT', name: 'jehu binga', token: 'jwt' });

      expect(ctx.component.userName).toBe('jehu binga');
      expect(ctx.component.userInitial).toBe('J');
      expect(ctx.fixture.nativeElement.textContent).toContain('jehu binga');
    });

    it('traduit le libellé du premier rôle, quel que soit le modèle', () => {
      // Les libellés sont calculés sur le moment : on les lit avant de remonter
      // un autre compte (le service lit le rôle dans localStorage).
      const staffLabel = setup({ role: 'BIBLIOTHECAIRE', name: 'Staff', token: 'jwt' }).component.roleLabel;
      const adherentLabel = setup({ role: 'ADHERENT', name: 'Jehu', token: 'jwt' }).component.roleLabel;

      expect(staffLabel).toBeTruthy();
      expect(adherentLabel).toBeTruthy();
      expect(staffLabel).not.toBe(adherentLabel);
    });
  });

  describe('fermeture mobile et déconnexion', () => {
    it('expose la classe sidebar-open quand la barre est ouverte', () => {
      const ctx = setup({ role: 'ADHERENT', name: 'Jehu', token: 'jwt' });

      expect(ctx.component.isOpen).toBeFalse();
      expect(ctx.fixture.nativeElement.classList.contains('sidebar-open')).toBeFalse();

      ctx.component.sidebarOpen = true;
      ctx.fixture.detectChanges();       // le HostBinding n'est appliqué qu'au cycle suivant
      expect(ctx.component.isOpen).toBeTrue();
      expect(ctx.fixture.nativeElement.classList.contains('sidebar-open')).toBeTrue();
    });

    it('openLogoutConfirm remonte la demande au parent (le clic ne déconnecte pas directement)', () => {
      const ctx = setup({ role: 'ADHERENT', name: 'Jehu', token: 'jwt' });

      let emitted = 0;
      ctx.component.logoutRequest.subscribe(() => emitted++);

      ctx.component.openLogoutConfirm();

      expect(emitted).toBe(1);
      // La session est intacte tant que la confirmation n'est pas donnée
      expect(localStorage.getItem('jwtToken')).toBe('jwt');
    });
  });
});
