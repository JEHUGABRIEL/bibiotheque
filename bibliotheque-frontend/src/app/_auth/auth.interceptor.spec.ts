import { AuthInterceptor } from './auth.interceptor';
import { UserAuthService } from '../_service/user-auth.service';
import { HttpRequest } from '@angular/common/http';
import { throwError, of, Observable } from 'rxjs';

/**
 * L'intercepteur doit distinguer les erreurs locales (réservations) des
 * redirections globales (401 → login, 403 → forbidden), purger la session
 * dès qu'un 401 survient et propager l'erreur originale aux composants.
 */
describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let routerSpy: jasmine.SpyObj<any>;
  let authSpy: jasmine.SpyObj<any>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    authSpy = jasmine.createSpyObj('UserAuthService', ['getToken', 'clear']);
    authSpy.getToken.and.returnValue('token-abc');
    interceptor = new AuthInterceptor(authSpy, routerSpy);
  });

  /** Exécute l'intercepteur et capture l'erreur retransmise au composant. */
  function runAndCapture(req: HttpRequest<any>, error: any): Promise<any> {
    return new Promise((resolve) => {
      const next: any = { handle: () => throwError(() => error) };
      interceptor.intercept(req, next).subscribe({
        next: () => resolve(null),
        error: (e: any) => resolve(e)
      });
    });
  }

  const get = (url: string) => new HttpRequest('GET', url);

  it('purge la session et redirige vers /login sur 401 hors réservations', async () => {
    const err = await runAndCapture(get('http://localhost:8080/admin/books'), { status: 401 });
    expect(authSpy.clear).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    expect(err.status).toBe(401);
  });

  it('laisse le composant gérer un 401 sur /api/reservations (pas de redirection)', async () => {
    await runAndCapture(get('http://localhost:8080/api/reservations'), { status: 401 });
    expect(authSpy.clear).toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('ne redirige pas vers /forbidden pour un 403 sur /api/reservations', async () => {
    await runAndCapture(get('http://localhost:8080/api/reservations/3/annuler'), { status: 403 });
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('redirige vers /forbidden pour un 403 global', async () => {
    await runAndCapture(get('http://localhost:8080/admin/users'), { status: 403 });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/forbidden']);
  });

  it('laisse passer les autres erreurs (409, 500) sans redirection', async () => {
    const err = await runAndCapture(get('http://localhost:8080/api/reservations'), { status: 409 });
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(err.status).toBe(409);
  });

  it('ajoute le header Authorization aux requêtes authentifiées', () => {
    let captured: HttpRequest<any> | null = null;
    const next: any = {
      handle: (req: HttpRequest<any>) => {
        captured = req;
        return new Observable((subscriber) => { subscriber.complete(); });
      }
    };
    interceptor.intercept(new HttpRequest('GET', 'http://localhost:8080/borrow'), next).subscribe();
    expect(captured!.headers.get('Authorization')).toBe('Bearer token-abc');
  });

  it('ne touche pas aux requêtes marquées No-Auth', () => {
    let captured: HttpRequest<any> | null = null;
    const noAuthReq = new HttpRequest('POST', 'http://localhost:8080/authenticate', {});
    // Simule le header No-Auth (l'intercepteur lit req.headers.get('No-Auth')).
    const reqWithHeader = noAuthReq.clone({ setHeaders: { 'No-Auth': 'True' } });
    const next: any = {
      handle: (req: HttpRequest<any>) => {
        captured = req;
        return new Observable((subscriber) => { subscriber.complete(); });
      }
    };
    interceptor.intercept(reqWithHeader, next).subscribe();
    expect(captured!.headers.get('Authorization')).toBeNull();
  });
});
