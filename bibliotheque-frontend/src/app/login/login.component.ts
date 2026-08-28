import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { UserAuthService } from '../_service/user-auth.service';
import { UsersService } from '../_service/users.service';
import { TranslationService } from '../_service/translation.service';
import { ThemeService } from '../_service/theme.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {

  errorMessage: string | null = null;
  loading = false;
  showPassword = false;
  currentSlide = 0;
  currentBgSlide = 0;
  private slideInterval: any;
  private bgSlideInterval: any;

  bgSlides = [
    { url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&h=1080&fit=crop', alt: 'Bibliothèque' },
    { url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1920&h=1080&fit=crop', alt: 'Bibliothèque ancienne' },
    { url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1920&h=1080&fit=crop', alt: 'Livre ouvert' },
    { url: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1920&h=1080&fit=crop', alt: 'Livres en pile' },
    { url: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=1920&h=1080&fit=crop', alt: 'Lecture' },
  ];

  slides = [
    { quote: 'slider.quote1', author: 'slider.author1', tags: ['slider.tag1', 'slider.tag2'] },
    { quote: 'slider.quote2', author: 'slider.author2', tags: ['slider.tag3', 'slider.tag4'] },
    { quote: 'slider.quote3', author: 'slider.author3', tags: ['slider.tag2', 'slider.tag3'] },
  ];

  bookImages = [
    { url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&h=260&fit=crop', alt: 'Livre ouvert' },
    { url: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=200&h=260&fit=crop', alt: 'Livres en pile' },
    { url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=200&h=260&fit=crop', alt: 'Bibliothèque' },
    { url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=260&fit=crop', alt: 'Bibliothèque ancienne' },
    { url: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=200&h=260&fit=crop', alt: 'Lecture' },
    { url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=200&h=260&fit=crop', alt: 'Étude' },
    { url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=200&h=260&fit=crop', alt: 'Livres ouverts' },
  ];

  constructor(
    public translationService: TranslationService,
    public themeService: ThemeService,
    private userService: UsersService,
    private userAuthService: UserAuthService,
    private router: Router
  ) { }

  ngOnInit() {
    this.startSlider();
    this.startBgSlider();
  }

  ngOnDestroy() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
    if (this.bgSlideInterval) {
      clearInterval(this.bgSlideInterval);
    }
  }

  t(key: string): string {
    return this.translationService.t(key);
  }

  login(loginForm: NgForm) {
    this.errorMessage = null;
    this.loading = true;

    this.userService.login(loginForm.value).subscribe(
      (response: any) => {
        this.loading = false;
        this.userAuthService.setRoles(response.user.role);
        this.userAuthService.setToken(response.jwtToken);
        this.userAuthService.setUserId(response.user.userId);
        this.userAuthService.setName(response.user.name);

        const role = response.user.role[0].roleName;
        if (role === 'Admin') {
          this.router.navigate(['/books']);
        } else {
          this.router.navigate(['/borrow-book']);
        }
      },
      (error) => {
        this.loading = false;
        this.errorMessage = this.translationService.t('login.error');
      }
    );
  }

  goToSlide(index: number) {
    this.currentSlide = index;
    this.restartSlider();
  }

  goToBgSlide(index: number) {
    this.currentBgSlide = index;
    this.restartBgSlider();
  }

  private startSlider() {
    this.slideInterval = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    }, 4000);
  }

  private restartSlider() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
    this.startSlider();
  }

  private startBgSlider() {
    this.bgSlideInterval = setInterval(() => {
      this.currentBgSlide = (this.currentBgSlide + 1) % this.bgSlides.length;
    }, 5000);
  }

  private restartBgSlider() {
    if (this.bgSlideInterval) {
      clearInterval(this.bgSlideInterval);
    }
    this.startBgSlider();
  }
}
