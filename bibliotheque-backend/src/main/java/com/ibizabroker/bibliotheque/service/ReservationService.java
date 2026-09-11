package com.ibizabroker.bibliotheque.service;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.ReservationRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
import com.ibizabroker.bibliotheque.exceptions.ConflictException;
import com.ibizabroker.bibliotheque.exceptions.ForbiddenException;
import com.ibizabroker.bibliotheque.exceptions.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ReservationService {

    private static final int QUOTA_MAX = 3;
    private static final String ROLE_BIBLIOTHECAIRE = "BIBLIOTHECAIRE";
    private static final String ROLE_ADMIN = "Admin";

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private BooksRepository booksRepository;

    @Autowired
    private UsersRepository usersRepository;

    // ------------------------------------------------------------------
    // Résolution de l'identité — RS-04 : l'identité vient du token,
    // jamais du corps de la requête.
    // ------------------------------------------------------------------

    private Users resolveUser(String username) {
        return usersRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Utilisateur '" + username + "' introuvable"));
    }

    private boolean isBibliothecaire(Users user) {
        // L'ancien rôle 'Admin' (séances précédentes) donne aussi les droits staff
        return user.getRole().stream()
                .anyMatch(r -> ROLE_BIBLIOTHECAIRE.equals(r.getRoleName())
                        || ROLE_ADMIN.equals(r.getRoleName()));
    }

    // ------------------------------------------------------------------
    // Lecture — RS-03 / RS-05 : un adhérent ne voit que ses réservations
    // ------------------------------------------------------------------

    public List<Reservation> findAllFor(StatutReservation statut, String username) {
        Users user = resolveUser(username);
        if (isBibliothecaire(user)) {
            return (statut != null) ? reservationRepository.findByStatut(statut)
                    : reservationRepository.findAll();
        }
        return (statut != null) ? reservationRepository.findByUserIdAndStatut(user.getUserId(), statut)
                : reservationRepository.findByUserId(user.getUserId());
    }

    public Reservation getByIdFor(Long id, String username) {
        Users user = resolveUser(username);
        Reservation reservation = getExisting(id);
        if (!isBibliothecaire(user) && !reservation.getUserId().equals(user.getUserId())) {
            throw new ForbiddenException(
                    "La réservation " + id + " n'appartient pas à l'adhérent '" + username + "'");
        }
        return reservation;
    }

    // ------------------------------------------------------------------
    // Création — RS-04 : on ÉCRASE l'userId du corps par celui du token
    // ------------------------------------------------------------------

    public Reservation createFor(Reservation reservation, String username) {
        Users user = resolveUser(username);
        if (!isBibliothecaire(user)) {
            reservation.setUserId(user.getUserId());
        }
        return create(reservation);
    }

    // ------------------------------------------------------------------
    // Annulation — même règle de propriété que la lecture (RS-03)
    // ------------------------------------------------------------------

    public Reservation cancelFor(Long id, String username) {
        Users user = resolveUser(username);
        Reservation reservation = getExisting(id);
        if (!isBibliothecaire(user) && !reservation.getUserId().equals(user.getUserId())) {
            throw new ForbiddenException(
                    "La réservation " + id + " n'appartient pas à l'adhérent '" + username + "'");
        }
        return cancel(id);
    }

    public void delete(Long id) {
        Reservation reservation = getExisting(id);
        reservationRepository.delete(reservation);
    }

    // ------------------------------------------------------------------
    // Règles métier (inchangées — séance précédente)
    // ------------------------------------------------------------------

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

        // RG-01 : un livre DISPONIBLE (copies > 0) ne peut PAS être réservé
        if (book.getNoOfCopies() > 0) {
            throw new ConflictException(
                    "Le livre \"" + book.getBookName() + "\" est disponible avec " + book.getNoOfCopies() + " exemplaire(s) et peut être emprunté. " +
                    "Seuls les livres indisponibles (0 exemplaire) peuvent être réservés.");
        }

        // Vérifier que l'adhérent existe
        usersRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Adhérent avec l'id " + userId + " introuvable"));

        // Vérifier qu'aucune réservation active n'existe déjà pour ce livre
        boolean hasActive = reservationRepository.existsByBookIdAndStatutIn(
                bookId, List.of(StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE));
        if (hasActive) {
            throw new ConflictException("Une réservation active existe déjà pour ce livre");
        }

        // RG-03 : quota de 3 réservations actives
        long activeCount = reservationRepository.countByUserIdAndStatutIn(
                userId, List.of(StatutReservation.EN_ATTENTE, StatutReservation.DISPONIBLE));
        if (activeCount >= QUOTA_MAX) {
            throw new ConflictException("Quota de " + QUOTA_MAX + " réservations actives atteint pour cet adhérent");
        }

        reservation.setStatut(StatutReservation.EN_ATTENTE);
        reservation.setDateReservation(new Date());

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

        Reservation reservation = getExisting(id);

        StatutReservation statut = reservation.getStatut();
        if (statut != StatutReservation.EN_ATTENTE && statut != StatutReservation.DISPONIBLE) {
            throw new ConflictException(
                    "Impossible d'annuler une réservation avec le statut \"" + statut + "\". " +
                    "Seules les réservations EN_ATTENTE ou DISPONIBLE peuvent être annulées.");
        }

        reservation.setStatut(StatutReservation.ANNULEE);
        return reservationRepository.save(reservation);
    }

    private Reservation getExisting(Long id) {
        if (id == null) {
            throw new BadRequestException("L'identifiant de la réservation est requis");
        }
        return reservationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Réservation avec l'id " + id + " introuvable"));
    }
}
