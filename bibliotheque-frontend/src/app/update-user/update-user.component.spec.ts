import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { UpdateUserComponent } from './update-user.component';
import { Users } from '../_model/users';
import { environment } from '../../environments/environment';

/**
 * Tests du formulaire « Modifier un utilisateur » : chargement par l'identifiant
 * de la route, pré-sélection du rôle (deux modèles) et PUT /admin/users/{id}.
 */
describe('UpdateUserComponent', () => {

  const USERS_URL = `${environment.apiUrl}/admin/users`;

  let httpMock: HttpTestingController;

  function setup(userId = 51) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [UpdateUserComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: { userId } } } }
      ]
    });

    const fixture = TestBed.createComponent(UpdateUserComponent);
    const component: any = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    return { fixture, component, router };
  }

  const user = (roleName: string): Users => ({
    userId: 51, username: 'jehu', name: 'Jehu Binga', password: '',
    role: [{ roleName }]
  } as Users);

  afterEach(() => httpMock.verify());

  it('devrait être créé', () => {
    const ctx = setup();
    expect(ctx.component).toBeTruthy();
  });

  it('charge l\'utilisateur et pré-sélectionne son rôle actuel', () => {
    const ctx = setup(51);
    ctx.fixture.detectChanges();

    expect(ctx.component.userId).toBe(51);

    httpMock.expectOne(`${USERS_URL}/51`).flush(user('ADHERENT'));

    expect(ctx.component.user.name).toBe('Jehu Binga');
    expect(ctx.component.selectedRole).toBe('ADHERENT');
  });

  it('supporte le rôle BIBLIOTHECAIRE', () => {
    const ctx = setup(1);
    ctx.fixture.detectChanges();

    httpMock.expectOne(`${USERS_URL}/1`).flush(user('BIBLIOTHECAIRE'));

    expect(ctx.component.selectedRole).toBe('BIBLIOTHECAIRE');
  });

  it('enregistre le nouveau rôle puis revient à la liste', () => {
    const ctx = setup(51);
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${USERS_URL}/51`).flush(user('ADHERENT'));

    ctx.component.selectedRole = 'BIBLIOTHECAIRE';
    ctx.component.onSubmit();

    const put = httpMock.expectOne(`${USERS_URL}/51`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.role).toEqual([{ roleName: 'BIBLIOTHECAIRE' }]);
    put.flush({ message: 'Utilisateur modifié' });

    expect(ctx.router.navigate).toHaveBeenCalledWith(['/users']);
  });

  it('reste sur la page si l\'enregistrement échoue', () => {
    const ctx = setup(51);
    ctx.fixture.detectChanges();
    httpMock.expectOne(`${USERS_URL}/51`).flush(user('ADHERENT'));

    ctx.component.onSubmit();
    httpMock.expectOne(`${USERS_URL}/51`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(ctx.router.navigate).not.toHaveBeenCalled();
  });

  it('un utilisateur sans rôle connu laisse la sélection vide', () => {
    const ctx = setup(52);
    ctx.fixture.detectChanges();

    httpMock.expectOne(`${USERS_URL}/52`).flush({ userId: 52, name: 'Marie', role: [] } as Users);

    expect(ctx.component.selectedRole).toBe('');
  });
});
