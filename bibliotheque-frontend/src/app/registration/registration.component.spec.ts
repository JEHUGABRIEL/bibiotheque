import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { RegistrationComponent } from './registration.component';
import { Users } from '../_model/users';
import { environment } from '../../environments/environment';

/**
 * Tests du formulaire d'inscription : champs obligatoires, rôle envoyé au
 * backend, message de succès/erreur et redirection vers la liste.
 */
describe('RegistrationComponent', () => {

  const USERS_URL = `${environment.apiUrl}/admin/users`;

  let httpMock: HttpTestingController;

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [RegistrationComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule]
    });

    const fixture = TestBed.createComponent(RegistrationComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    return { fixture, component, router };
  }

  const fill = (c: any) => {
    c.user = { name: 'Marie Dupont', username: 'marie', password: 'secret' } as Users;
    c.selectedRole = 'ADHERENT';
  };

  afterEach(() => httpMock.verify());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  describe('validation', () => {
    it('exige nom, identifiant, mot de passe et rôle', () => {
      const ctx = setup();
      expect(ctx.component.isFormValid).toBeFalse();

      fill(ctx.component);
      expect(ctx.component.isFormValid).toBeTrue();

      ctx.component.selectedRole = '';
      expect(ctx.component.isFormValid).toBeFalse();

      fill(ctx.component);
      ctx.component.user.password = '   ';
      expect(ctx.component.isFormValid).toBeFalse();
    });

    it('onSubmit n\'envoie rien si le formulaire est invalide', () => {
      const ctx = setup();
      ctx.component.onSubmit();
      httpMock.expectNone(USERS_URL);
    });
  });

  describe('inscription', () => {
    it('crée l\'utilisateur avec le rôle choisi puis redirige vers la liste', fakeAsync(() => {
      const ctx = setup();
      fill(ctx.component);
      ctx.component.onSubmit();

      expect(ctx.component.loading).toBeTrue();

      const post = httpMock.expectOne(USERS_URL);
      expect(post.request.method).toBe('POST');
      expect(post.request.body.name).toBe('Marie Dupont');
      expect(post.request.body.role).toEqual([{ roleName: 'ADHERENT' }]);
      post.flush({ userId: 60 });

      expect(ctx.component.loading).toBeFalse();
      expect(ctx.component.successMessage).toContain('succès');
      expect(ctx.router.navigate).not.toHaveBeenCalled();

      tick(1500);
      expect(ctx.router.navigate).toHaveBeenCalledWith(['/users']);
    }));

    it('affiche le message d\'erreur du backend', () => {
      const ctx = setup();
      fill(ctx.component);
      ctx.component.onSubmit();

      httpMock.expectOne(USERS_URL).flush(
        { message: 'Un compte avec cet identifiant existe déjà' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(ctx.component.errorMessage).toBe('Un compte avec cet identifiant existe déjà');
      expect(ctx.component.loading).toBeFalse();
    });

    it('affiche un message générique si le backend n\'en fournit pas', () => {
      const ctx = setup();
      fill(ctx.component);
      ctx.component.onSubmit();

      httpMock.expectOne(USERS_URL).flush({}, { status: 400, statusText: 'Bad Request' });

      expect(ctx.component.errorMessage).toContain('erreur');
      expect(ctx.router.navigate).not.toHaveBeenCalled();
    });
  });
});
