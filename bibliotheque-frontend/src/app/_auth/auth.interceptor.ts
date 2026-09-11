import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { UserAuthService } from '../_service/user-auth.service';
import { Injectable } from '@angular/core';

/**
 * Endpoints pour lesquels une erreur HTTP doit rester LOCALE au composant
 * (message inline, retry…), sans redirection globale.
 */
const SKIP_GLOBAL_REDIRECT_URLS = [
  '/api/reservations'
];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private userAuthService: UserAuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.headers.get('No-Auth') === 'True') {
      return next.handle(req.clone());
    }

    const token = this.userAuthService.getToken();
    req = this.addToken(req, token);

    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        const localHandling = SKIP_GLOBAL_REDIRECT_URLS.some(url => req.url.includes(url));

        if (err.status === 401) {
          // Session invalide (token absent, expiré ou invalide) : on nettoie.
          // Le backend distingue désormais via err.error.expired === true.
          const expired = !!err.error?.expired;
          this.userAuthService.clear();

          if (localHandling) {
            // Laisse le composant afficher son état d'erreur avec un lien de reconnexion.
            if (expired) {
              console.warn('Session expirée — veuillez vous reconnecter.');
            }
          } else {
            this.router.navigate(['/login']);
          }
        } else if (err.status === 403 && !localHandling) {
          // 403 global (navigation/rôle) → page forbidden.
          // Pour /api/reservations, le composant gère le 403 localement
          // (ex. annulation de la réservation d'un autre → message inline).
          this.router.navigate(['/forbidden']);
        }
        // TOUJOURS re-transmettre l'erreur originale
        // pour que les composants puissent lire err.status + err.error.message
        return throwError(() => err);
      })
    );
  }

  private addToken(request: HttpRequest<any>, token: string) {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
}
