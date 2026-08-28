import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Reservation, StatutReservation } from '../_model/reservation';

@Component({
  selector: 'app-reservation-list',
  templateUrl: './reservation-list.component.html',
  styleUrls: ['./reservation-list.component.css']
})
export class ReservationListComponent {

  @Input() reservations: Reservation[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() bookNames: Map<number, string> = new Map();
  @Input() userNames: Map<number, string> = new Map();

  @Output() filterChange = new EventEmitter<StatutReservation | null>();
  @Output() cancelRequest = new EventEmitter<Reservation>();
  @Output() retryRequest = new EventEmitter<void>();

  selectedFilter: StatutReservation | null = null;
  statuts = Object.values(StatutReservation);

  onFilterChange(statut: string) {
    this.selectedFilter = statut ? statut as StatutReservation : null;
    this.filterChange.emit(this.selectedFilter);
  }

  onCancel(reservation: Reservation) {
    this.cancelRequest.emit(reservation);
  }

  onRetry() {
    this.retryRequest.emit();
  }

  getStatutLabel(statut: StatutReservation): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': 'En attente',
      'DISPONIBLE': 'Disponible',
      'ANNULEE': 'Annulée',
      'EXPIREE': 'Expirée',
      'HONOREE': 'Honorée'
    };
    return labels[statut] || statut;
  }

  getStatutClass(statut: StatutReservation): string {
    const classes: Record<string, string> = {
      'EN_ATTENTE': 'badge bg-warning text-dark',
      'DISPONIBLE': 'badge bg-success',
      'ANNULEE': 'badge bg-secondary',
      'EXPIREE': 'badge bg-danger',
      'HONOREE': 'badge bg-info'
    };
    return classes[statut] || 'badge bg-secondary';
  }

  canCancel(statut: StatutReservation): boolean {
    return statut === StatutReservation.EN_ATTENTE || statut === StatutReservation.DISPONIBLE;
  }

  formatDate(date: any): string {
    if (!date) return '-';
    // Le backend envoie "dd-MM-yyyy", on parse manuellement
    if (typeof date === 'string' && date.includes('-')) {
      const parts = date.split('-');
      if (parts.length === 3 && parts[0].length === 2) {
        const [day, month, year] = parts;
        return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('fr-FR');
      }
    }
    return new Date(date).toLocaleDateString('fr-FR');
  }
}
