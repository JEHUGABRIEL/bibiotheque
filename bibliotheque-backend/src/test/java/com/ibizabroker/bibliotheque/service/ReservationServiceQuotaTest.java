package com.ibizabroker.bibliotheque.service;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.exceptions.ConflictException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RG-03 — Quota de 3 réservations actives par adhérent.
 * Test UNITAIRE : le repository est un mock, aucune base de données n'est démarrée.
 */
@ExtendWith(MockitoExtension.class)
class ReservationServiceQuotaTest {

    private static final Integer BOOK_ID = 1;
    private static final Integer USER_ID = 42;

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private BooksRepository booksRepository;

    @Mock
    private UsersRepository usersRepository;

    @InjectMocks
    private ReservationService reservationService;

    private Books unLivreIndisponible() {
        Books book = new Books();
        book.setBookId(BOOK_ID);
        book.setBookName("Livre épuisé");
        book.setNoOfCopies(0);
        return book;
    }

    @Test
    @DisplayName("RG-03 : avec 2 réservations actives, un adhérent peut créer une 3e réservation")
    void create_avecDeuxReservationsActives_troisiemeAcceptee() {
        // given — livre indisponible, adhérent existant, 2 réservations actives
        when(booksRepository.findById(BOOK_ID)).thenReturn(Optional.of(unLivreIndisponible()));
        when(usersRepository.findById(USER_ID)).thenReturn(Optional.of(new Users()));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(BOOK_ID), anyList())).thenReturn(false);
        when(reservationRepository.countByUserIdAndStatutIn(eq(USER_ID), anyList())).thenReturn(2L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Reservation demande = new Reservation();
        demande.setBookId(BOOK_ID);
        demande.setUserId(USER_ID);

        // when
        Reservation creee = reservationService.create(demande);

        // then — la 3e réservation est acceptée : l'adhérent crée une DEMANDE
        assertThat(creee.getStatut()).isEqualTo(StatutReservation.DEMANDE);
        verify(reservationRepository).save(any(Reservation.class));
    }

    @Test
    @DisplayName("RG-03 : à 3 réservations actives, la création est refusée (409) et rien n'est sauvegardé")
    void create_avecTroisReservationsActives_refusee() {
        // given — même scénario, mais le quota est déjà atteint
        when(booksRepository.findById(BOOK_ID)).thenReturn(Optional.of(unLivreIndisponible()));
        when(usersRepository.findById(USER_ID)).thenReturn(Optional.of(new Users()));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(BOOK_ID), anyList())).thenReturn(false);
        when(reservationRepository.countByUserIdAndStatutIn(eq(USER_ID), anyList())).thenReturn(3L);

        Reservation demande = new Reservation();
        demande.setBookId(BOOK_ID);
        demande.setUserId(USER_ID);

        // when / then — refus métier, aucune écriture en base
        assertThatThrownBy(() -> reservationService.create(demande))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Quota");

        verify(reservationRepository, never()).save(any(Reservation.class));
    }

    @Test
    @DisplayName("RG-03 : le compteur de quota compte EN_ATTENTE et DISPONIBLE, pas les annulées")
    void create_leCompteurIgnoreLesReservationsAnnulees() {
        // given
        when(booksRepository.findById(BOOK_ID)).thenReturn(Optional.of(unLivreIndisponible()));
        when(usersRepository.findById(USER_ID)).thenReturn(Optional.of(new Users()));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(BOOK_ID), anyList())).thenReturn(false);
        when(reservationRepository.countByUserIdAndStatutIn(eq(USER_ID), anyList())).thenReturn(1L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Reservation demande = new Reservation();
        demande.setBookId(BOOK_ID);
        demande.setUserId(USER_ID);

        // when
        reservationService.create(demande);

        // then — les statuts actifs interrogés sont bien DEMANDE + EN_ATTENTE + DISPONIBLE
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<StatutReservation>> statuts = ArgumentCaptor.forClass(List.class);
        verify(reservationRepository).countByUserIdAndStatutIn(eq(USER_ID), statuts.capture());
        assertThat(statuts.getValue())
                .containsExactlyInAnyOrder(StatutReservation.DEMANDE, StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE);
    }
}
