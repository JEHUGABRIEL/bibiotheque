package com.ibizabroker.bibliotheque.service;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
import com.ibizabroker.bibliotheque.exceptions.ConflictException;
import com.ibizabroker.bibliotheque.exceptions.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ReservationService {

    private static final int QUOTA_MAX = 3;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private BooksRepository booksRepository;

    @Autowired
    private UsersRepository usersRepository;

    public List<Reservation> findAll() {
        return reservationRepository.findAll();
    }

    public List<Reservation> findByStatut(StatutReservation statut) {
        return reservationRepository.findByStatut(statut);
    }

    public Reservation create(Reservation reservation) {
        Integer bookId = reservation.getBookId();
        Integer userId = reservation.getUserId();

        if (bookId == null) {
            throw new BadRequestException("L'identifiant du livre est requis");
        }
        if (userId == null) {
            throw new BadRequestException("L'identifiant de l'adhérent est requis");
        }

        // Vérifier que le livre existe
        Books book = booksRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("Livre avec l'id " + bookId + " introuvable"));

        // Vérifier que l'adhérent existe
        usersRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Adhérent avec l'id " + userId + " introuvable"));

        // Vérifier qu'aucune réservation active n'existe déjà pour ce livre
        boolean hasActive = reservationRepository.existsByBookIdAndStatutIn(
                bookId, List.of(StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE));
        if (hasActive) {
            throw new ConflictException("Une réservation active existe déjà pour ce livre");
        }

        // Vérifier le quota de 3 réservations actives
        long activeCount = reservationRepository.countByUserIdAndStatutIn(
                userId, List.of(StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE));
        if (activeCount >= QUOTA_MAX) {
            throw new ConflictException("Quota de " + QUOTA_MAX + " réservations actives atteint pour cet adhérent");
        }

        // Déterminer le statut initial
        if (book.getNoOfCopies() > 0) {
            reservation.setStatut(StatutReservation.DISPONIBLE);
        } else {
            reservation.setStatut(StatutReservation.EN_ATTENTE);
        }

        reservation.setDateReservation(new Date());

        // Date d'expiration = 7 jours
        Calendar cal = Calendar.getInstance();
        cal.setTime(new Date());
        cal.add(Calendar.DATE, 7);
        reservation.setDateExpiration(cal.getTime());

        return reservationRepository.save(reservation);
    }

    public Reservation cancel(Long id) {
        if (id == null) {
            throw new BadRequestException("L'identifiant de la réservation est requis");
        }

        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Réservation avec l'id " + id + " introuvable"));

        StatutReservation statut = reservation.getStatut();
        if (statut != StatutReservation.EN_ATTENTE && statut != StatutReservation.DISPONIBLE) {
            throw new ConflictException(
                    "Impossible d'annuler une réservation avec le statut \"" + statut + "\". " +
                    "Seules les réservations EN_ATTENTE ou DISPONIBLE peuvent être annulées.");
        }

        reservation.setStatut(StatutReservation.ANNULEE);
        return reservationRepository.save(reservation);
    }
}
