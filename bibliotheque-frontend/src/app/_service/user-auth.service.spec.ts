import { TestBed } from '@angular/core/testing';
import { UserAuthService } from './user-auth.service';

/**
 * Tests unitaires de UserAuthService.
 *
 * Le point sensible est la déconnexion : clear() doit purger UNIQUEMENT les clés
 * de session (roles, jwtToken, userId, name). Un localStorage.clear() effacerait
 * aussi le thème, la langue et l'état de lecture des notifications.
 */
describe('UserAuthService — session et déconnexion', () => {
  let service: UserAuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserAuthService);
  });

  afterEach(() => localStorage.clear());

  it('devrait être créé', () => {
    expect(service).toBeTruthy();
  });

  describe('session', () => {
    it('stocke puis relit le jeton', () => {
      service.setToken('jwt-abc');
      expect(service.getToken()).toBe('jwt-abc');
    });

    it('stocke puis relit les rôles', () => {
      service.setRoles([{ roleName: 'ADHERENT' }] as any);
      expect(service.getRoles()).toEqual([{ roleName: 'ADHERENT' }] as any);
    });

    it('stocke puis relit l\'identifiant utilisateur', () => {
      service.setUserId(51);
      expect(service.getUserId()).toBe(51);
    });

    it('stocke puis relit le nom', () => {
      service.setName('Jehu Binga' as any);
      expect(service.getName()).toBe('Jehu Binga');
    });

    it('isLoggedIn exige le jeton ET les rôles', () => {
      expect(service.isLoggedIn()).toBeFalsy();

      service.setToken('jwt-abc');
      expect(service.isLoggedIn()).toBeFalsy();

      service.setRoles([{ roleName: 'Admin' }] as any);
      expect(service.isLoggedIn()).toBeTruthy();
    });
  });

  describe('clear()', () => {
    beforeEach(() => {
      service.setToken('jwt-abc');
      service.setRoles([{ roleName: 'ADHERENT' }] as any);
      service.setUserId(51);
      service.setName('Jehu Binga' as any);
    });

    it('supprime les quatre clés de session', () => {
      service.clear();

      expect(localStorage.getItem('jwtToken')).toBeNull();
      expect(localStorage.getItem('roles')).toBeNull();
      expect(localStorage.getItem('userId')).toBeNull();
      expect(localStorage.getItem('name')).toBeNull();
      expect(service.isLoggedIn()).toBeFalsy();
    });

    it('préserve les préférences et l\'état des notifications (pas de localStorage.clear)', () => {
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('lang', 'fr');
      localStorage.setItem('bibliotheque.notifRead', JSON.stringify({ dismissed: ['borrow-1'] }));
      localStorage.setItem('bibliotheque.notifSelfCancel', JSON.stringify(['res-3']));

      service.clear();

      expect(localStorage.getItem('theme')).toBe('dark');
      expect(localStorage.getItem('lang')).toBe('fr');
      expect(localStorage.getItem('bibliotheque.notifRead')).toContain('borrow-1');
      expect(localStorage.getItem('bibliotheque.notifSelfCancel')).toContain('res-3');
    });

    it('est idempotent (aucune exception si la session est déjà vide)', () => {
      service.clear();
      expect(() => service.clear()).not.toThrow();
    });
  });
});
