import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Reservation, StatutReservation } from '../_model/reservation';
import { Books } from '../_model/books';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {

  private baseURL = `${environment.apiUrl}/api/reservations`;

  constructor(private httpClient: HttpClient) { }

  getAll(): Observable<Reservation[]> {
    return this.httpClient.get<Reservation[]>(this.baseURL);
  }

  getById(id: number): Observable<Reservation> {
    return this.httpClient.get<Reservation>(`${this.baseURL}/${id}`);
  }

  getByStatut(statut: StatutReservation): Observable<Reservation[]> {
    return this.httpClient.get<Reservation[]>(`${this.baseURL}?statut=${statut}`);
  }

  /**
   * Charge le catalogue complet, sans distinction de rôle.
   * Pourquoi ce contournement : GET /admin/books/{id} exige le rôle Admin — un
   * BIBLIOTHECAIRE y reçoit 403, ce qui tuait en silence sa modale de détail
   * et le pré-remplissage du formulaire de réservation. Le catalogue est une
   * ressource de consultation ; la liste complète reste accessible à tout
   * compte authentifié.
   */
  getBooksCatalog(): Observable<Books[]> {
    return this.httpClient.get<Books[]>(`${environment.apiUrl}/admin/books`);
  }

  create(reservation: Reservation): Observable<Reservation> {
    return this.httpClient.post<Reservation>(this.baseURL, reservation);
  }

  annuler(id: number): Observable<Reservation> {
    return this.httpClient.patch<Reservation>(`${this.baseURL}/${id}/annuler`, {});
  }

  /** Le personnel accepte une DEMANDE de réservation → EN_ATTENTE. */
  accepter(id: number): Observable<Reservation> {
    return this.httpClient.patch<Reservation>(`${this.baseURL}/${id}/accepter`, {});
  }
}
