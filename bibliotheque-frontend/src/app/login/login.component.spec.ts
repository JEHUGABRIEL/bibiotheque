import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { LoginComponent } from './login.component';

/**
 * Tests de la page de connexion : le bouton de retour, qui referme la page
 * et ramène à l'accueil (un visiteur n'a aucun autre moyen de quitter l'écran
 * de connexion).
 */
describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientModule, FormsModule],
      declarations: [LoginComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('devrait être créé', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('affiche un bouton de retour à l\'accueil', () => {
    const bouton: HTMLElement = fixture.nativeElement.querySelector('.back-btn');

    expect(bouton).toBeTruthy();
    expect(bouton.querySelector('span')!.textContent!.trim()).toBe('Retour à l\'accueil');
    expect(bouton.querySelector('svg')).toBeTruthy();
  });

  it('le bouton de retour ramène à la page d\'accueil', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    (fixture.nativeElement.querySelector('.back-btn') as HTMLElement).click();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('le retour est un bouton, pas un lien : il ne peut pas être suivi par le navigateur', () => {
    // Un <a href="/"> rechargerait toute l'application ; on veut une navigation Angular.
    expect(fixture.nativeElement.querySelector('a[href="/"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button.back-btn')).toBeTruthy();
  });
});
