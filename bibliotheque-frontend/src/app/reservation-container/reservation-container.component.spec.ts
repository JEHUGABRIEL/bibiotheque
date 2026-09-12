import { ReservationContainerComponent } from './reservation-container.component';
import { TranslationService } from '../_service/translation.service';
import { Books } from '../_model/books';
import { Reservation, StatutReservation } from '../_model/reservation';

/**
 * Tests unitaires du conteneur de réservations — logique pure, aucun HTTP,
 * aucune base : les services sont des doublures minimales.
 */
describe('ReservationContainerComponent', () => {

  const makeBook = (id: number, name: string, copies: number, author = 'A. Auteur'): Books => ({
    bookId: id, bookName: name, bookAuthor: author, bookGenre: 'Roman', noOfCopies: copies, imageUrl: ''
  } as Books);

  const makeReservation = (id: number, bookId: number, userId: number,
                           statut: StatutReservation = StatutReservation.EN_ATTENTE): Reservation =>
    ({ id, bookId, userId, statut, dateReservation: new Date(), dateExpiration: new Date() } as Reservation);

  const makeComponent = (opts: { staff?: boolean; userId?: number | null } = {}) => {
    const usersServiceStub = { isStaff: () => !!opts.staff, roleMatch: () => !!opts.staff } as any;
    const userAuthStub = { getUserId: () => (opts.userId === undefined ? 51 : opts.userId) } as any;
    return new ReservationContainerComponent(
      {} as any,                                    // ReservationService — non utilisé ici
      usersServiceStub as any,
      userAuthStub as any,
      { snapshot: {}, queryParams: {} } as any,     // ActivatedRoute — non utilisé ici
      new TranslationService()
    );
  };

  // ---------- RG-01 : réservabilité ----------

  describe('isBookReservable (RG-01)', () => {
    it('un livre indisponible (0 exemplaire) est réservable', () => {
      const c = makeComponent();
      expect(c.isBookReservable(makeBook(1, 'Dune', 0))).toBeTrue();
    });

    it('un livre disponible (> 0 exemplaire) n\'est pas réservable', () => {
      const c = makeComponent();
      expect(c.isBookReservable(makeBook(2, '1984', 3))).toBeFalse();
    });

    it('un livre sans compte d\'exemplaires est traité comme réservable', () => {
      const c = makeComponent();
      expect(c.isBookReservable(makeBook(3, 'Test', undefined as any))).toBeTrue();
    });
  });

  // ---------- Recherche prédictive ----------

  describe('recherche prédictive du livre', () => {
    it('suggère TOUS les livres correspondant à la requête (disponibles inclus, marqués non réservables)', () => {
      const c = makeComponent();
      c.books = [makeBook(1, 'Dune', 0), makeBook(2, '1984', 3), makeBook(3, 'Du côté de chez Swann', 0)];
      c.bookQuery = 'du';
      expect(c.bookSuggestions.map(b => b.bookId)).toEqual([1, 3]);
      // 1984 ne contient pas "du" ; mais un livre disponible qui matche serait inclus :
      c.books = [makeBook(1, 'Dune', 0), makeBook(4, 'Duel', 5)];
      expect(c.bookSuggestions.map(b => b.bookId)).toEqual([1, 4]);
    });

    it('l\'option « créer ce livre » apparaît dès qu\'un texte libre est saisi', () => {
      const c = makeComponent();
      c.books = [];
      c.onBookQueryInput({ target: { value: 'Dune' } } as any);
      expect(c.canCreateNewBook).toBeTrue();
      expect(c.createNewLabel).toContain('Dune');
    });

    it('selectNewBook verrouille le nom du nouveau livre sans bookId', () => {
      const c = makeComponent();
      c.bookQuery = '  Dune  ';
      c.selectNewBook();
      expect(c.selectedBookId).toBeNull();
      expect(c.newBookName).toBe('Dune');
      expect(c.showBookSuggestions).toBeFalse();
      expect(c.isFormValid).toBeTrue();
    });

    it('la recherche est insensible à la casse et aux accents', () => {
      const c = makeComponent();
      c.books = [makeBook(1, 'Échéance', 0)];
      c.bookQuery = 'eche';
      expect(c.bookSuggestions.length).toBe(1);
    });

    it('aucune suggestion quand la requête est vide', () => {
      const c = makeComponent();
      c.books = [makeBook(1, 'Dune', 0)];
      c.bookQuery = '';
      expect(c.bookSuggestions.length).toBe(0);
    });

    it('saisir une requête réinitialise la sélection', () => {
      const c = makeComponent();
      c.selectedBookId = 1;
      c.onBookQueryInput({ target: { value: 'Du' } } as any);
      expect(c.selectedBookId).toBeNull();
      expect(c.bookQuery).toBe('Du');
      expect(c.showBookSuggestions).toBeTrue();
    });

    it('choisir une suggestion verrouille le livre et ferme la liste', () => {
      const c = makeComponent();
      c.books = [makeBook(1, 'Dune', 0)];
      c.selectBookSuggestion(c.books[0]);
      expect(c.selectedBookId).toBe(1);
      expect(c.bookQuery).toBe('Dune');
      expect(c.showBookSuggestions).toBeFalse();
    });

    it('Enter sélectionne la suggestion mise en évidence au clavier', () => {
      const c = makeComponent();
      c.books = [makeBook(1, 'Dune', 0), makeBook(2, 'Duel', 0)];
      c.bookQuery = 'du';
      c.showBookSuggestions = true;
      c.onBookSearchKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      c.onBookSearchKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(c.selectedBookId).toBe(1);
      expect(c.showBookSuggestions).toBeFalse();
    });

    it('Escape ferme la liste sans sélectionner', () => {
      const c = makeComponent();
      c.showBookSuggestions = true;
      c.onBookSearchKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(c.showBookSuggestions).toBeFalse();
      expect(c.selectedBookId).toBeNull();
    });
  });

  // ---------- Validité du formulaire ----------

  describe('isFormValid', () => {
    it('un adhérent n\'a pas besoin de sélectionner d\'adhérent (RS-04)', () => {
      const c = makeComponent({ staff: false });
      c.selectedBookId = 1;
      expect(c.isFormValid).toBeTrue();
    });

    it('un adhérent ne peut rien soumettre sans livre sélectionné ni nom saisi', () => {
      const c = makeComponent({ staff: false });
      c.selectedBookId = null;
      c.newBookName = null;
      expect(c.isFormValid).toBeFalse();
    });

    it('un nom de nouveau livre suffit, sans bookId', () => {
      const c = makeComponent({ staff: false });
      c.selectedBookId = null;
      c.newBookName = 'Livre jamais enregistré';
      expect(c.isFormValid).toBeTrue();
    });

    it('le personnel doit choisir l\'adhérent concerné', () => {
      const c = makeComponent({ staff: true });
      c.selectedBookId = 1;
      c.selectedUserId = null;
      expect(c.isFormValid).toBeFalse();
      c.selectedUserId = 51;
      expect(c.isFormValid).toBeTrue();
    });
  });

  // ---------- Droit d'annulation ----------

  describe('canCancelReservation / canCancelDetail', () => {
    it('un adhérent peut annuler sa propre réservation en attente', () => {
      const c = makeComponent({ staff: false, userId: 51 });
      expect(c.canCancelReservation(makeReservation(1, 1, 51))).toBeTrue();
    });

    it('un adhérent ne peut pas annuler la réservation d\'un autre (miroir RS-03)', () => {
      const c = makeComponent({ staff: false, userId: 51 });
      expect(c.canCancelReservation(makeReservation(2, 1, 101))).toBeFalse();
    });

    it('le personnel peut annuler n\'importe quelle réservation', () => {
      const c = makeComponent({ staff: true, userId: 1 });
      expect(c.canCancelReservation(makeReservation(3, 1, 101))).toBeTrue();
    });

    it('une réservation déjà annulée ne peut plus être annulée', () => {
      const c = makeComponent({ staff: false, userId: 51 });
      expect(c.canCancelReservation(makeReservation(4, 1, 51, StatutReservation.ANNULEE))).toBeFalse();
    });

    it('canCancelDetail reflète le même droit pour la modale de détail', () => {
      const c = makeComponent({ staff: false, userId: 51 });
      c.detailReservation = makeReservation(5, 1, 101);
      expect(c.canCancelDetail).toBeFalse();
      c.detailReservation = makeReservation(6, 1, 51);
      expect(c.canCancelDetail).toBeTrue();
      c.detailReservation = null;
      expect(c.canCancelDetail).toBeFalse();
    });
  });

  // ---------- Format des dates ----------

  describe('formatDate', () => {
    it('retourne "-" pour une date absente', () => {
      const c = makeComponent();
      expect(c.formatDate(null)).toBe('-');
    });

    it('parse le format dd-MM-yyyy du backend', () => {
      const c = makeComponent();
      const out = c.formatDate('11-09-2026');
      expect(out).toContain('2026');
    });
  });
});
