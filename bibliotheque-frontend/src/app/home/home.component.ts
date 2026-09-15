import { Component, OnDestroy, OnInit } from '@angular/core';
import { UserAuthService } from '../_service/user-auth.service';
import { TranslationService } from '../_service/translation.service';

/** Une image du slider et TOUS les textes qui lui sont propres. */
interface HomeSlide {
  /** URL de l'image de fond (format 16/9). */
  image: string;
  /** Clé de traduction de la description de l'image (accessibilité). */
  alt: string;
  /** Clé de traduction de l'étiquette (le verbe de l'action). */
  tag: string;
  /** Clé de traduction du titre. */
  title: string;
  /** Clé de traduction du paragraphe. */
  text: string;
  /** Clé de traduction du bouton. */
  cta: string;
  /** Route ouverte par le bouton (l'invité est redirigé vers /login). */
  link: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {

  /** Délai entre deux slides automatiques (ms). */
  readonly slideDelay = 6000;

  currentSlide = 0;
  /** Le défilement automatique est suspendu tant que le pointeur survole le slider. */
  paused = false;

  private slideInterval: any;

  readonly slides: HomeSlide[] = [
    {
      image: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&h=1080&fit=crop',
      alt: 'home.slide1.alt',
      tag: 'home.slide1.tag',
      title: 'home.slide1.title',
      text: 'home.slide1.text',
      cta: 'home.slide1.cta',
      link: '/borrow-book'
    },
    {
      image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1920&h=1080&fit=crop',
      alt: 'home.slide2.alt',
      tag: 'home.slide2.tag',
      title: 'home.slide2.title',
      text: 'home.slide2.text',
      cta: 'home.slide2.cta',
      link: '/reservations'
    },
    {
      image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1920&h=1080&fit=crop',
      alt: 'home.slide3.alt',
      tag: 'home.slide3.tag',
      title: 'home.slide3.title',
      text: 'home.slide3.text',
      cta: 'home.slide3.cta',
      link: '/return-book'
    },
    {
      image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1920&h=1080&fit=crop',
      alt: 'home.slide4.alt',
      tag: 'home.slide4.tag',
      title: 'home.slide4.title',
      text: 'home.slide4.text',
      cta: 'home.slide4.cta',
      link: '/dashboard'
    }
  ];

  constructor(private userAuthService: UserAuthService, public t: TranslationService) { }

  ngOnInit(): void {
    this.startSlider();
  }

  ngOnDestroy(): void {
    this.stopSlider();
  }

  isLoggedIn(): boolean {
    return !!this.userAuthService.isLoggedIn();
  }

  /** Le slide actif — c'est lui dont les textes sont affichés. */
  get activeSlide(): HomeSlide {
    return this.slides[this.currentSlide];
  }

  /**
   * Destination du bouton : un visiteur sans session n'a rien à faire sur
   * /borrow-book (le garde le renverrait de toute façon) — on l'envoie
   * directement à la connexion.
   */
  linkFor(slide: HomeSlide): string {
    return this.isLoggedIn() ? slide.link : '/login';
  }

  goToSlide(index: number): void {
    const count = this.slides.length;
    this.currentSlide = ((index % count) + count) % count;
    this.restartSlider();
  }

  nextSlide(): void {
    this.goToSlide(this.currentSlide + 1);
  }

  previousSlide(): void {
    this.goToSlide(this.currentSlide - 1);
  }

  /** Navigation au clavier (flèches gauche/droite) quand le slider a le focus. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      this.nextSlide();
    } else if (event.key === 'ArrowLeft') {
      this.previousSlide();
    }
  }

  pauseSlider(): void {
    this.paused = true;
    this.stopSlider();
  }

  resumeSlider(): void {
    this.paused = false;
    this.startSlider();
  }

  private startSlider(): void {
    this.stopSlider();
    this.slideInterval = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    }, this.slideDelay);
  }

  private restartSlider(): void {
    if (!this.paused) {
      this.startSlider();
    }
  }

  private stopSlider(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
      this.slideInterval = null;
    }
  }
}
