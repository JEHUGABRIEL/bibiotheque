import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { UserAuthService } from '../_service/user-auth.service';
import { UsersService } from '../_service/users.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private userAuthService: UserAuthService,
    private router: Router,
    private userService: UsersService
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    if(this.userAuthService.getToken() !== null) {
      const roles = route.data["roles"] as Array<string>;

      // Route protégée sans contrainte de rôle : l'utilisateur authentifié passe.
      if(!roles) {
        return true;
      }

      if(this.userService.roleMatch(roles)) {
        return true;
      } else {
        this.router.navigate(['/forbidden']);
        return false;
      }
    }

    this.router.navigate(['/login']);
    return false;
  }
}
