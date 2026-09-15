import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { LoginComponent } from '../login/login.component';
import { AuthInterceptor } from '../_auth/auth.interceptor';
import { UserAuthService } from '../_service/user-auth.service';
import { TranslationService } from '../_service/translation.service';
import { ToastService } from '../_service/toast.service';
import { environment } from '../../environments/environment';

/**
 * Test d'INTÉGRATION de la connexion.
 *
 * Parcours complet : formulaire → UsersService → AuthInterceptor (en-tête
 * No-Auth, donc pas de Bearer) → réponse → session écrite dans localStorage →
 * redirection vers /dashboard. On couvre aussi les deux échecs distincts :
 * mauvais identifiants (401) et backend éteint (status 0).
 */
describe('Intégration — connexion', () => {

  const API = environment.apiUrl;

  let httpMock: HttpTestingController;
  let fixture: ComponentFixture<LoginComponent>;

  const VALID_FORM = { value: { username: 'jehu', password: 'secret123' } } as any;

  function setup() {
    localStorage.clear();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }]
    });

    fixture = TestBed.createComponent(LoginComponent);
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const toast = TestBed.inject(ToastService);

    spyOn(router, 'navigate');
    spyOn(toast, 'success');

    return { component: fixture.componentInstance, router, toast };
  }

  /** Réponse du backend pour une connexion réussie. */
  const AUTH_RESPONSE = {
    user: { userId: 51, username: 'jehu', name: 'Jehu Binga', role: [{ roleName: 'ADHERENT' }] },
    jwtToken: 'jwt-abc'
  };

  afterEach(() => {
    // La page démarre deux carrousels (setInterval) : ngOnDestroy les arrête.
    if (fixture) {
      fixture.destroy();
    }
    httpMock.verify();
    localStorage.clear();
  });

  describe('connexion réussie', () => {
    it('poste les identifiants sans jeton, ouvre la session et redirige vers /dashboard', () => {
      const ctx = setup();
      ctx.component.login(VALID_FORM);

      expect(ctx.component.loading).toBeTrue();

      const req = httpMock.expectOne(`${API}/authenticate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ username: 'jehu', password: 'secret123' });
      // L'intercepteur n'ajoute pas de Bearer à la connexion (en-tête No-Auth)
      expect(req.request.headers.get('No-Auth')).toBe('True');
      expect(req.request.headers.get('Authorization')).toBeNull();

      req.flush(AUTH_RESPONSE);

      expect(ctx.component.loading).toBeFalse();
      expect(ctx.component.errorMessage).toBeNull();

      // Session complète : rôle, jeton, identifiant et nom
      expect(JSON.parse(localStorage.getItem('roles')!)).toEqual([{ roleName: 'ADHERENT' }]);
      expect(localStorage.getItem('jwtToken')).toBe('jwt-abc');
      expect(localStorage.getItem('userId')).toBe('51');
      expect(JSON.parse(localStorage.getItem('name')!)).toBe('Jehu Binga');

      expect(ctx.toast.success).toHaveBeenCalledWith('Bienvenue Jehu Binga !');
      expect(ctx.router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('les appels suivants portent le jeton reçu (session effectivement utilisable)', () => {
      const ctx = setup();
      ctx.component.login(VALID_FORM);
      httpMock.expectOne(`${API}/authenticate`).flush(AUTH_RESPONSE);

      const auth = TestBed.inject(UserAuthService);
      expect(auth.getToken()).toBe('jwt-abc');
      expect(auth.isLoggedIn()).toBeTruthy();
    });

    it('la page affiche le message d\'erreur dans le DOM en cas d\'échec', () => {
      const ctx = setup();
      fixture.detectChanges();

      ctx.component.login(VALID_FORM);
      httpMock.expectOne(`${API}/authenticate`).flush(
        { message: 'Bad credentials' },
        { status: 401, statusText: 'Unauthorized' }
      );
      fixture.detectChanges();

      expect(ctx.component.errorMessage).toBe('Identifiants incorrects. Veuillez réessayer.');
      expect(fixture.nativeElement.textContent).toContain('Identifiants incorrects');
    });
  });

  describe('échecs', () => {
    it('mauvais identifiants (401) : message générique, aucune session, aucune redirection', () => {
      const ctx = setup();
      ctx.component.login(VALID_FORM);

      httpMock.expectOne(`${API}/authenticate`).flush(
        { message: 'Bad credentials' },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(ctx.component.loading).toBeFalse();
      expect(ctx.component.errorMessage).toBe(
        TestBed.inject(TranslationService).t('login.error')
      );
      expect(localStorage.getItem('jwtToken')).toBeNull();
      expect(localStorage.getItem('roles')).toBeNull();
      expect(ctx.router.navigate).not.toHaveBeenCalled();
      expect(ctx.toast.success).not.toHaveBeenCalled();
    });

    it('backend injoignable (status 0) : message dédié, distinct du mauvais mot de passe', () => {
      const ctx = setup();
      ctx.component.login(VALID_FORM);

      httpMock.expectOne(`${API}/authenticate`).error(
        new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' }
      );

      expect(ctx.component.errorMessage).toBe(
        TestBed.inject(TranslationService).t('login.error.server')
      );
      expect(ctx.component.errorMessage).not.toBe(
        TestBed.inject(TranslationService).t('login.error')
      );
      expect(ctx.component.loading).toBeFalse();
    });

    it('une seconde tentative repart d\'un état propre (l\'erreur précédente est effacée)', () => {
      const ctx = setup();

      ctx.component.login({ value: { username: 'jehu', password: 'faux' } } as any);
      httpMock.expectOne(`${API}/authenticate`).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(ctx.component.errorMessage).toBeTruthy();

      ctx.component.login(VALID_FORM);
      expect(ctx.component.errorMessage).toBeNull();
      httpMock.expectOne(`${API}/authenticate`).flush(AUTH_RESPONSE);
      expect(ctx.router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});
