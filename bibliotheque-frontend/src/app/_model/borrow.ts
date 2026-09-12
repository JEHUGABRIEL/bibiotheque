export enum StatutBorrow {
    EN_ATTENTE = 'EN_ATTENTE',
    VALIDEE = 'VALIDEE',
    REFUSEE = 'REFUSEE',
    EN_COURS = 'EN_COURS',
    RENDU = 'RENDU'
}

export class Borrow {
    borrowId: number;
    bookId: number;
    userId: number;
    issueDate: Date;
    returnDate: Date;
    dueDate: Date;
    statut: StatutBorrow;
}
