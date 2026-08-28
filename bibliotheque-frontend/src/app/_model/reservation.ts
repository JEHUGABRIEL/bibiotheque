export enum StatutReservation {
  EN_ATTENTE = 'EN_ATTENTE',
  DISPONIBLE = 'DISPONIBLE',
  ANNULEE = 'ANNULEE',
  EXPIREE = 'EXPIREE',
  HONOREE = 'HONOREE'
}

export class Reservation {
  id: number;
  bookId: number;
  userId: number;
  statut: StatutReservation;
  dateReservation: Date;
  dateExpiration: Date;
}
