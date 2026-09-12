package com.ibizabroker.bibliotheque.service;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
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
 * Réservation d'un livre NON enregistré — le livre est résolu par son nom
 * (insensible à la casse) ou créé à 0 exemplaire, puis réservé.
 * Test UNITAIRE : repositories mockés, aucune base de données.
 */
@ExtendWith(MockitoExtension.class)
class ReservationServiceNewBookTest {

    private static final Integer USER_ID = 42;

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private BooksRepository booksRepository;

    @Mock
    private UsersRepository usersRepository;

    @InjectMocks
    private ReservationService reservationService;

    private Reservation demandeParNom(String nom) {
        Reservation demande = new Reservation();
        demande.setUserId(USER_ID);
        demande.setNewBookName(nom);
        return demande;
    }

    @Test
    @DisplayName("un livre non enregistré est créé à 0 exemplaire puis réservé")
    void create_avecLivreNonEnregistre_leCreeEtLeReserve() {
        // given — aucun livre existant sous ce nom
        when(usersRepository.findById(USER_ID)).thenReturn(Optional.of(new Users()));
        when(booksRepository.findByBookNameIgnoreCase("Dune")).thenReturn(Optional.empty());
        when(booksRepository.save(any(Books.class))).thenAnswer(inv -> {
            Books b = inv.getArgument(0);
            b.setBookId(7);
            return b;
        });
        when(reservationRepository.existsByBookIdAndStatutIn(eq(7), anyList())).thenReturn(false);
        when(reservationRepository.countByUserIdAndStatutIn(eq(USER_ID), anyList())).thenReturn(0L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // when
        Reservation creee = reservationService.create(demandeParNom("Dune"));

        // then — le livre est créé à 0 exemplaire et la réservation part en attente
        ArgumentCaptor<Books> livreCree = ArgumentCaptor.forClass(Books.class);
        verify(booksRepository).save(livreCree.capture());
        assertThat(livreCree.getValue().getBookName()).isEqualTo("Dune");
        assertThat(livreCree.getValue().getNoOfCopies()).isZero();

        assertThat(creee.getStatut()).isEqualTo(StatutReservation.DEMANDE);
        assertThat(creee.getBookId()).isEqualTo(7);
    }

    @Test
    @DisplayName("un livre existant est réutilisé, pas dupliqué (recherche insensible à la casse)")
    void create_avecNomDeLivreExistant_reutiliseLeLivre() {
        // given — « dune » existe déjà sous une autre casse
        Books existant = new Books();
        existant.setBookId(3);
        existant.setBookName("Dune");
        existant.setNoOfCopies(0);

        when(usersRepository.findById(USER_ID)).thenReturn(Optional.of(new Users()));
        when(booksRepository.findByBookNameIgnoreCase("dune")).thenReturn(Optional.of(existant));
        when(reservationRepository.existsByBookIdAndStatutIn(eq(3), anyList())).thenReturn(false);
        when(reservationRepository.countByUserIdAndStatutIn(eq(USER_ID), anyList())).thenReturn(0L);
        when(reservationRepository.save(any(Reservation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // when
        Reservation creee = reservationService.create(demandeParNom("dune"));

        // then — aucun nouveau livre créé, la réservation pointe sur l'existant
        verify(booksRepository, never()).save(any(Books.class));
        assertThat(creee.getBookId()).isEqualTo(3);
    }

    @Test
    @DisplayName("ni bookId ni nom de livre : la demande est rejetée (400)")
    void create_sansLivreNiNom_refusee() {
        Reservation demande = new Reservation();
        demande.setUserId(USER_ID);

        assertThatThrownBy(() -> reservationService.create(demande))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("livre");

        verify(reservationRepository, never()).save(any(Reservation.class));
    }
}
