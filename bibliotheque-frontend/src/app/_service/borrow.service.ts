import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Borrow } from '../_model/borrow';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BorrowService {

  private baseURL = `${environment.apiUrl}/borrow`;

  constructor(private httpClient: HttpClient) { }

  getBorrowList(): Observable<Borrow[]> {
    return this.httpClient.get<Borrow[]>(`${this.baseURL}`);
  }

  getPendingBorrows(): Observable<Borrow[]> {
    return this.httpClient.get<Borrow[]>(`${this.baseURL}/pending`);
  }

  borrowBook(borrow: Borrow): Observable<Object> {
    return this.httpClient.post(`${this.baseURL}`, borrow);
  }

  confirmBorrow(borrowId: number): Observable<Object> {
    return this.httpClient.patch(`${this.baseURL}/${borrowId}/confirmer`, {});
  }

  refuseBorrow(borrowId: number): Observable<Object> {
    return this.httpClient.patch(`${this.baseURL}/${borrowId}/refuser`, {});
  }

  deleteBorrow(borrowId: number): Observable<Object> {
    return this.httpClient.delete(`${this.baseURL}/${borrowId}`);
  }

  returnBook(borrow: Borrow): Observable<Object> {
    return this.httpClient.put(`${this.baseURL}`, borrow);
  }

  requestReturn(borrow: Borrow): Observable<Object> {
    return this.httpClient.put(`${this.baseURL}/request`, borrow);
  }

  getBooksBorrowedByUser(userId: number): Observable<Borrow[]> {
    return this.httpClient.get<Borrow[]>(`${this.baseURL}/user/${userId}`);
  }

  getPendingBorrowsByUser(userId: number): Observable<Borrow[]> {
    return this.httpClient.get<Borrow[]>(`${this.baseURL}/user/${userId}/pending`);
  }

  getMyQuota(): Observable<{ activeCount: number; maxQuota: number; remaining: number }> {
    return this.httpClient.get<{ activeCount: number; maxQuota: number; remaining: number }>(`${this.baseURL}/my/quota`);
  }

  getBookBorrowHistory(bookId: number): Observable<Borrow[]> {
    return this.httpClient.get<Borrow[]>(`${this.baseURL}/book/${bookId}`);
  }
}
