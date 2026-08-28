import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Reservation, StatutReservation } from '../_model/reservation';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {

  private baseURL = 'http://localhost:8080/api/reservations';

  constructor(private httpClient: HttpClient) { }

  getAll(): Observable<Reservation[]> {
    return this.httpClient.get<Reservation[]>(this.baseURL);
  }

  getByStatut(statut: StatutReservation): Observable<Reservation[]> {
    return this.httpClient.get<Reservation[]>(`${this.baseURL}?statut=${statut}`);
  }

  create(reservation: Reservation): Observable<Reservation> {
    return this.httpClient.post<Reservation>(this.baseURL, reservation);
  }

  annuler(id: number): Observable<Reservation> {
    return this.httpClient.patch<Reservation>(`${this.baseURL}/${id}/annuler`, {});
  }
}
