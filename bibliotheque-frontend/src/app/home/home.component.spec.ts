import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';

import { HomeComponent } from './home.component';

/**
 * Tests de la page d'accueil : barre du haut (logo + connexion), et diaporama
 * plein écran dont les textes changent à chaque slide — que le déplacement soit
 * automatique ou déclenché par l'utilisateur.
 */
describe('HomeComponent', () => {

  /** Titres attendus, dans l'ordre des slides (fr = langue par défaut). */
  const TITRES = [
    'Un livre, trois clics',
    'Réservez ce qui est déjà emprunté',
    'Les retours, sans file d\'attente',
    'Votre bibliothèque en un écran'
  ];
  const ROUTES = ['/borrow-book', '/reservations', '/return-book', '/dashboard'];

  function setup(loggedIn: boolean) {
    localStorage.clear();
    localStorage.removeItem('lang');
    if (loggedIn) {
      localStorage.setItem('roles', JSON.stringify([{ roleName: 'ADHERENT' }]));
      localStorage.setItem('jwtToken', 'jwt-abc');
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [HomeComponent],
      imports: [CommonModule, RouterTestingModule]
    });

    const fixture: ComponentFixture<HomeComponent> = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance as any };
  }

  /** Le titre réellement affiché sur le slide actif. */
  function titreActif(fixture: ComponentFixture<HomeComponent>): string {
    const el = fixture.nativeElement.querySelector('.slide-text.active .slide-title');
    return el ? el.textContent.trim() : '';
  }

  /** L'URL de l'image du slide actif. */
  function imageActive(fixture: ComponentFixture<HomeComponent>): string {
    const el = fixture.nativeElement.querySelector('.slide.active .slide-image');
    return el ? el.getAttribute('src') : '';
  }

  /** Le bouton (CTA) du slide actif. */
  function ctaActif(fixture: ComponentFixture<HomeComponent>): HTMLElement | null {
    return fixture.nativeElement.querySelector('.slide-text.active .slide-cta');
  }

  afterEach(() => localStorage.clear());

  it('devrait être créé', () => {
    const ctx = setup(false);
    expect(ctx.component).toBeTruthy();
    ctx.fixture.destroy();
  });

  // ---------- Barre du haut ----------

  it('affiche le logo (icône + titre) et le bouton de connexion dans la barre du haut', () => {
    const ctx = setup(false);
    const topbar: HTMLElement = ctx.fixture.nativeElement.querySelector('.home-topbar');

    expect(topbar).toBeTruthy();
    // Logo à gauche, connexion à droite : dans cet ordre dans la barre.
    const enfants = Array.from(topbar.children).map((e) => e.className);
    expect(enfants).toEqual(['brand', 'login-btn']);

    const marque = topbar.querySelector('.brand') as HTMLElement;
    expect(marque.querySelector('.brand-icon svg')).toBeTruthy();
    expect(marque.querySelector('.brand-text')!.textContent!.trim()).toBe('Bibliothèque');

    const connexion = topbar.querySelector('a[href="/login"]') as HTMLElement;
    expect(connexion).toBeTruthy();
    expect(connexion.querySelector('span')!.textContent!.trim()).toBe('Se connecter');
    ctx.fixture.destroy();
  });

  it('masque le bouton de connexion pour un utilisateur déjà connecté', () => {
    const ctx = setup(true);

    expect(ctx.component.isLoggedIn()).toBeTrue();
    expect(ctx.fixture.nativeElement.querySelector('a[href="/login"]')).toBeNull();
    // Le logo reste, lui : c'est l'identité de la page.
    expect(ctx.fixture.nativeElement.querySelector('.brand-text').textContent.trim()).toBe('Bibliothèque');
    ctx.fixture.destroy();
  });

  it('n\'affiche plus le sous-titre retiré', () => {
    const ctx = setup(false);

    expect(ctx.fixture.nativeElement.textContent).not.toContain('Gestion de livres');
    expect(ctx.fixture.nativeElement.querySelector('.hero')).toBeNull();
    expect(ctx.fixture.nativeElement.querySelector('.hero-subtitle')).toBeNull();
    ctx.fixture.destroy();
  });

  // ---------- Slides ----------

  it('rend une image par slide et démarre sur la première', () => {
    const ctx = setup(false);

    expect(ctx.component.slides.length).toBe(4);
    expect(ctx.fixture.nativeElement.querySelectorAll('.slide').length).toBe(4);
    expect(ctx.fixture.nativeElement.querySelectorAll('.slide-image').length).toBe(4);
    expect(ctx.component.currentSlide).toBe(0);
    expect(titreActif(ctx.fixture)).toBe(TITRES[0]);
    expect(imageActive(ctx.fixture)).toContain('photo-1507842217343');
    ctx.fixture.destroy();
  });

  it('chaque slide porte ses propres textes et sa propre image', () => {
    const ctx = setup(false);

    for (let i = 0; i < TITRES.length; i++) {
      ctx.component.goToSlide(i);
      ctx.fixture.detectChanges();

      expect(titreActif(ctx.fixture)).toBe(TITRES[i]);
      const paragraphe = ctx.fixture.nativeElement.querySelector('.slide-text.active .slide-paragraph');
      const etiquette = ctx.fixture.nativeElement.querySelector('.slide-text.active .slide-tag');
      expect(paragraphe.textContent.trim().length).toBeGreaterThan(20);
      expect(etiquette.textContent.trim().length).toBeGreaterThan(0);
    }

    // Les quatre images sont distinctes : ce ne sont pas les mêmes visuels.
    const images = ctx.component.slides.map((s: any) => s.image);
    expect(new Set(images).size).toBe(4);
    ctx.fixture.destroy();
  });

  it('un seul slide est actif à la fois, les autres sont masqués aux lecteurs d\'écran', () => {
    const ctx = setup(false);
    ctx.component.goToSlide(2);
    ctx.fixture.detectChanges();

    // Une seule image et un seul texte actifs : les deux couches restent alignées.
    expect(ctx.fixture.nativeElement.querySelectorAll('.slide.active').length).toBe(1);
    expect(ctx.fixture.nativeElement.querySelectorAll('.slide-text.active').length).toBe(1);

    const images = ctx.fixture.nativeElement.querySelectorAll('.slide');
    expect(images[0].getAttribute('aria-hidden')).toBe('true');
    expect(images[2].getAttribute('aria-hidden')).toBe('false');

    const textes = ctx.fixture.nativeElement.querySelectorAll('.slide-text');
    expect(textes[2].getAttribute('aria-hidden')).toBe('false');
    expect(textes[3].getAttribute('aria-hidden')).toBe('true');
    ctx.fixture.destroy();
  });

  it('les textes du slide occupent le centre, la barre du haut reste au-dessus', () => {
    const ctx = setup(false);
    const slider: HTMLElement = ctx.fixture.nativeElement.querySelector('.home-slider');

    // Une seule zone plein écran qui contient la barre du haut, les textes et les commandes.
    expect(slider.contains(ctx.fixture.nativeElement.querySelector('.home-topbar'))).toBeTrue();
    expect(slider.contains(ctx.fixture.nativeElement.querySelector('.slider-inner'))).toBeTrue();
    expect(slider.contains(ctx.fixture.nativeElement.querySelector('.slide-texts'))).toBeTrue();
    expect(slider.contains(ctx.fixture.nativeElement.querySelector('.slide-dots'))).toBeTrue();
    expect(ctx.fixture.nativeElement.querySelectorAll('.slide-image').length).toBe(4);
    ctx.fixture.destroy();
  });

  it('n\'affiche pas de flèches précédent/suivant', () => {
    const ctx = setup(false);

    // Retirées à la demande de l'utilisateur : les pastilles et le clavier suffisent.
    expect(ctx.fixture.nativeElement.querySelector('.slide-arrow')).toBeNull();
    expect(ctx.fixture.nativeElement.querySelectorAll('button.slide-dot').length).toBe(4);
    ctx.fixture.destroy();
  });

  it('la pastille et le bouton d\'une autre slide affichent bien leurs textes', () => {
    const ctx = setup(false);

    const pastilles: NodeListOf<HTMLElement> = ctx.fixture.nativeElement.querySelectorAll('.slide-dot');
    expect(pastilles.length).toBe(4);

    pastilles[2].click();
    ctx.fixture.detectChanges();

    expect(ctx.component.currentSlide).toBe(2);
    expect(titreActif(ctx.fixture)).toBe(TITRES[2]);
    ctx.fixture.destroy();
  });

  // ---------- Navigation ----------

  it('la navigation boucle dans les deux sens', () => {
    const ctx = setup(false);

    ctx.component.previousSlide();
    ctx.fixture.detectChanges();
    expect(ctx.component.currentSlide).toBe(TITRES.length - 1);
    expect(titreActif(ctx.fixture)).toBe(TITRES[TITRES.length - 1]);

    ctx.component.nextSlide();
    ctx.fixture.detectChanges();
    expect(ctx.component.currentSlide).toBe(0);
    expect(titreActif(ctx.fixture)).toBe(TITRES[0]);
    ctx.fixture.destroy();
  });

  it('les flèches du clavier changent de slide quand le slider a le focus', () => {
    const ctx = setup(false);
    const slider: HTMLElement = ctx.fixture.nativeElement.querySelector('.home-slider');

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    ctx.fixture.detectChanges();
    expect(titreActif(ctx.fixture)).toBe(TITRES[1]);

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    ctx.fixture.detectChanges();
    expect(titreActif(ctx.fixture)).toBe(TITRES[0]);
    ctx.fixture.destroy();
  });

  it('le bouton du slide mène à la fonctionnalité décrite quand on est connecté', () => {
    const ctx = setup(true);

    ROUTES.forEach((route, i) => {
      ctx.component.goToSlide(i);
      ctx.fixture.detectChanges();
      expect(ctaActif(ctx.fixture)!.getAttribute('href')).toBe(route);
    });
    ctx.fixture.destroy();
  });

  it('un visiteur sans session est envoyé vers la connexion', () => {
    const ctx = setup(false);

    ctx.component.goToSlide(3);
    ctx.fixture.detectChanges();

    expect(ctaActif(ctx.fixture)!.getAttribute('href')).toBe('/login');
    ctx.fixture.destroy();
  });

  // ---------- Défilement automatique ----------

  it('change de slide tout seul après le délai', fakeAsync(() => {
    const ctx = setup(false);

    tick(ctx.component.slideDelay);
    ctx.fixture.detectChanges();
    expect(titreActif(ctx.fixture)).toBe(TITRES[1]);

    tick(ctx.component.slideDelay);
    ctx.fixture.detectChanges();
    expect(titreActif(ctx.fixture)).toBe(TITRES[2]);

    ctx.fixture.destroy();
    discardPeriodicTasks();
  }));

  it('le survol suspend le défilement, la sortie le relance', fakeAsync(() => {
    const ctx = setup(false);
    const slider: HTMLElement = ctx.fixture.nativeElement.querySelector('.home-slider');

    slider.dispatchEvent(new MouseEvent('mouseenter'));
    tick(ctx.component.slideDelay * 3);
    ctx.fixture.detectChanges();
    expect(ctx.component.paused).toBeTrue();
    expect(ctx.component.currentSlide).toBe(0);

    slider.dispatchEvent(new MouseEvent('mouseleave'));
    tick(ctx.component.slideDelay);
    ctx.fixture.detectChanges();
    expect(ctx.component.paused).toBeFalse();
    expect(ctx.component.currentSlide).toBe(1);

    ctx.fixture.destroy();
    discardPeriodicTasks();
  }));

  it('un choix manuel repart pour un tour complet au lieu d\'enchaîner aussitôt', fakeAsync(() => {
    const ctx = setup(false);

    tick(ctx.component.slideDelay - 1000);
    ctx.component.goToSlide(3);
    ctx.fixture.detectChanges();
    expect(ctx.component.currentSlide).toBe(3);

    // Moins d'une seconde plus tard, l'ancien minuteur aurait déjà tourné.
    tick(2000);
    ctx.fixture.detectChanges();
    expect(ctx.component.currentSlide).toBe(3);

    tick(ctx.component.slideDelay);
    ctx.fixture.detectChanges();
    expect(ctx.component.currentSlide).toBe(0);
    ctx.fixture.destroy();
    discardPeriodicTasks();
  }));

  it('quitte la page sans laisser de minuteur derrière lui', fakeAsync(() => {
    const ctx = setup(false);

    ctx.fixture.destroy();
    tick(ctx.component.slideDelay * 3);
    expect(ctx.component.currentSlide).toBe(0);
    discardPeriodicTasks();
  }));
});
