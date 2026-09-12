export enum StatutReservation {
  /** Demande soumise par un adhérent — le personnel doit l'accepter. */
  DEMANDE = 'DEMANDE',
  EN_ATTENTE = 'EN_ATTENTE',
  DISPONIBLE = 'DISPONIBLE',
  ANNULEE = 'ANNULEE',
  EXPIREE = 'EXPIREE',
  HONOREE = 'HONOREE'
}

export class Reservation {
  id: number;
  bookId: number;
  /** Nom d'un livre PAS encore enregistré — le backend le crée à 0 exemplaire puis le réserve. */
  newBookName?: string;
  userId: number;
  statut: StatutReservation;
  dateReservation: Date;
  dateExpiration: Date;
}
