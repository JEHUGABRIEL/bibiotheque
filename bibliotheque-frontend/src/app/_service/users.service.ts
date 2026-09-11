import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Observable } from 'rxjs';
import { Users } from '../_model/users';
import { UserAuthService } from './user-auth.service';

/** Rôles « personnel » — accès complet à la gestion (biblio + rôle hérité Admin). */
export const STAFF_ROLES = ['Admin', 'BIBLIOTHECAIRE'];
/** Rôles « adhérent » — emprunt / retour / ses réservations. */
export const MEMBER_ROLES = ['User', 'ADHERENT'];

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private baseURL = "http://localhost:8080/admin/users";
  requestHeader = new HttpHeaders(
    { 'No-Auth': 'True' }
  );

  constructor(
    private httpClient: HttpClient,
    private userAuthService: UserAuthService
  ) { }

  public login(loginData: NgForm) {
    return this.httpClient.post("http://localhost:8080/authenticate", loginData, {
      headers: this.requestHeader,
    });
  }

  public roleMatch(allowedRoles: any): boolean {
    const userRoles: any = this.userAuthService.getRoles();
    if (!userRoles || !Array.isArray(userRoles)) {
      return false;
    }
    // Comparer TOUTES les paires avant de conclure — un early-return
    // ici faisait échouer tout rôle qui n'est pas le premier de la liste.
    return userRoles.some((r: any) =>
      allowedRoles.some((allowed: any) => r?.roleName === allowed)
    );
  }

  /** Le compte connecté est-il du personnel (Admin ou BIBLIOTHECAIRE) ? */
  isStaff(): boolean {
    return this.roleMatch(STAFF_ROLES);
  }

  /** Un nom de rôle désigne-t-il du personnel ? (badges, selects, droits UI) */
  isStaffRole(roleName: string): boolean {
    return STAFF_ROLES.includes(roleName);
  }

  /** Clé de traduction du libellé d'un rôle, quel que soit le modèle (legacy ou Séance 4). */
  roleLabelKey(roleName: string): string {
    if (roleName === 'Admin') return 'users.role.admin';
    if (roleName === 'BIBLIOTHECAIRE') return 'users.role.bibliothecaire';
    return 'users.role.user';
  }

  getUsersList(): Observable<Users[]> {
    return this.httpClient.get<Users[]>(`${this.baseURL}`);
  }

  createUser(user: Users): Observable<Object> {
    return this.httpClient.post(`${this.baseURL}`, user);
  }

  getUserById(userId: number): Observable<Users> {
    return this.httpClient.get<Users>(`${this.baseURL}/${userId}`);
  }

  updateUser(userId: number, user: Users): Observable<Object> {
    return this.httpClient.put(`${this.baseURL}/${userId}`, user);
  }

}
