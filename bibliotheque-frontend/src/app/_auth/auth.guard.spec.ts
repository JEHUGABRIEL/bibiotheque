import { AuthGuard } from './auth.guard';
import { UserAuthService } from '../_service/user-auth.service';
import { UsersService } from '../_service/users.service';
import { Router } from '@angular/router';

/**
 * Le garde doit : laisser entrer sans rôle exigé si un token existe,
 * filtrer par rôle (les deux modèles) et renvoyer vers /login sans token.
 */
describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authSpy: jasmine.SpyObj<any>;
  let usersSpy: jasmine.SpyObj<any>;
  let routerSpy: jasmine.SpyObj<any>;

  const routeData = (roles?: string[]) => ({ data: roles ? { roles } : {} }) as any;
  const state = { url: '/test' } as any;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('UserAuthService', ['getToken']);
    usersSpy = jasmine.createSpyObj('UsersService', ['roleMatch']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    guard = new AuthGuard(authSpy, routerSpy, usersSpy);
  });

  it('renvoie vers /login sans token', () => {
    authSpy.getToken.and.returnValue(null);
    expect(guard.canActivate(routeData(), state)).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('laisse entrer un utilisateur authentifié sans contrainte de rôle', () => {
    authSpy.getToken.and.returnValue('token');
    expect(guard.canActivate(routeData(), state)).toBeTrue();
  });

  it('laisse entrer quand le rôle correspond (régression early-return)', () => {
    authSpy.getToken.and.returnValue('token');
    usersSpy.roleMatch.and.returnValue(true);
    expect(guard.canActivate(routeData(['Admin', 'BIBLIOTHECAIRE']), state)).toBeTrue();
  });

  it('renvoie vers /forbidden quand le rôle ne correspond pas', () => {
    authSpy.getToken.and.returnValue('token');
    usersSpy.roleMatch.and.returnValue(false);
    expect(guard.canActivate(routeData(['Admin']), state)).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/forbidden']);
  });
});
