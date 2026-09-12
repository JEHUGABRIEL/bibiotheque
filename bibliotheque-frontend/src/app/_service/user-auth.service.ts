import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserAuthService {

  constructor() { }

  public setRoles(roles: []) {
    localStorage.setItem('roles', JSON.stringify(roles));
  }

  public getRoles(): [] {
    return JSON.parse(localStorage.getItem('roles')!);
  }

  public setToken(jwtToken: string) {
    localStorage.setItem('jwtToken', jwtToken);
  }

  public getToken(): string {
    return localStorage.getItem('jwtToken')!;
  }

  public setUserId(userId: number) {
    localStorage.setItem('userId', JSON.stringify(userId));
  }

  public getUserId() {
    return JSON.parse(localStorage.getItem('userId')!);
  }

  public setName(userId: number) {
    localStorage.setItem('name', JSON.stringify(userId));
  }

  public getName() {
    return JSON.parse(localStorage.getItem('name')!);
  }

  /**
   * Nettoie UNIQUEMENT les clés de session — et pas tout le localStorage.
   * localStorage.clear() effacerait aussi les préférences (theme, lang) et
   * l'état de lecture des notifications, qui doivent survivre à la déconnexion.
   */
  public clear() {
    localStorage.removeItem('roles');
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('name');
  }

  public isLoggedIn() {
    return this.getRoles() && this.getToken();
  }

}