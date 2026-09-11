import { UsersService, STAFF_ROLES, MEMBER_ROLES } from './users.service';
import { UserAuthService } from './user-auth.service';

/**
 * Les helpers de rôles doivent accepter les deux modèles (Admin/User hérités
 * et ADHERENT/BIBLIOTHECAIRE de la Séance 4) — c'était la cause initiale des
 * pages interdites aux bibliothécaires.
 */
describe('UsersService — helpers de rôles', () => {
  let service: UsersService;
  let authStub: { getRoles: jasmine.Spy };

  beforeEach(() => {
    authStub = { getRoles: jasmine.createSpy('getRoles') };
    service = new UsersService({} as any, authStub as unknown as UserAuthService);
  });

  it('roleMatch accepte le premier rôle de la liste (régression early-return)', () => {
    authStub.getRoles.and.returnValue([{ roleName: 'Admin' }]);
    expect(service.roleMatch(['Admin', 'BIBLIOTHECAIRE'])).toBeTrue();
  });

  it('roleMatch accepte un rôle en seconde position', () => {
    authStub.getRoles.and.returnValue([{ roleName: 'BIBLIOTHECAIRE' }]);
    expect(service.roleMatch(['Admin', 'BIBLIOTHECAIRE'])).toBeTrue();
  });

  it('roleMatch refuse un rôle absent de la liste', () => {
    authStub.getRoles.and.returnValue([{ roleName: 'ADHERENT' }]);
    expect(service.roleMatch(['Admin', 'BIBLIOTHECAIRE'])).toBeFalse();
  });

  it('roleMatch gère des rôles stockés absents ou malformés', () => {
    authStub.getRoles.and.returnValue(null);
    expect(service.roleMatch(['Admin'])).toBeFalse();
    authStub.getRoles.and.returnValue([{}]);
    expect(service.roleMatch(['Admin'])).toBeFalse();
  });

  it('isStaff couvre les deux modèles de rôles', () => {
    authStub.getRoles.and.returnValue([{ roleName: 'Admin' }]);
    expect(service.isStaff()).toBeTrue();
    authStub.getRoles.and.returnValue([{ roleName: 'BIBLIOTHECAIRE' }]);
    expect(service.isStaff()).toBeTrue();
    authStub.getRoles.and.returnValue([{ roleName: 'ADHERENT' }]);
    expect(service.isStaff()).toBeFalse();
  });

  it('les constantes couvrent les deux modèles', () => {
    expect(STAFF_ROLES).toContain('Admin');
    expect(STAFF_ROLES).toContain('BIBLIOTHECAIRE');
    expect(MEMBER_ROLES).toContain('User');
    expect(MEMBER_ROLES).toContain('ADHERENT');
  });

  it('roleLabelKey mappe chaque rôle vers sa clé de traduction', () => {
    expect(service.roleLabelKey('Admin')).toBe('users.role.admin');
    expect(service.roleLabelKey('BIBLIOTHECAIRE')).toBe('users.role.bibliothecaire');
    expect(service.roleLabelKey('ADHERENT')).toBe('users.role.user');
    expect(service.roleLabelKey('User')).toBe('users.role.user');
  });
});
