package com.ibizabroker.bibliotheque.service;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
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

        // Vérifier que le livre existe
        Books book = booksRepository.findById(bookId)
                .orElseThrow(() -> new BusinessException("Livre introuvable", 404));

        // Vérifier que l'adhérent existe
        usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("Adhérent introuvable", 404));

        // Vérifier qu'aucune réservation active n'existe déjà pour ce livre
        boolean hasActive = reservationRepository.existsByBookIdAndStatutIn(
                bookId, List.of(StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE));
        if (hasActive) {
            throw new BusinessException("Une réservation existe déjà pour ce livre", 409);
        }

        // Vérifier le quota de 3 réservations actives
        long activeCount = reservationRepository.countByUserIdAndStatutIn(
                userId, List.of(StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE));
        if (activeCount >= QUOTA_MAX) {
            throw new BusinessException("Quota de 3 réservations atteint", 409);
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
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Réservation introuvable", 404));

        StatutReservation statut = reservation.getStatut();
        if (statut != StatutReservation.EN_ATTENTE && statut != StatutReservation.DISPONIBLE) {
            throw new BusinessException(
                    "Impossible d'annuler une réservation avec le statut " + statut, 409);
        }

        reservation.setStatut(StatutReservation.ANNULEE);
        return reservationRepository.save(reservation);
    }

    // Exception métier personnalisée
    public static class BusinessException extends RuntimeException {
        private final int statusCode;

        public BusinessException(String message, int statusCode) {
            super(message);
            this.statusCode = statusCode;
        }

        public int getStatusCode() {
            return statusCode;
        }
    }
}
