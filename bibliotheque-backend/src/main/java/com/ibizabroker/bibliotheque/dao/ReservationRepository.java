package com.ibizabroker.bibliotheque.dao;

import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByStatut(StatutReservation statut);

    long countByUserIdAndStatutIn(Integer userId, Collection<StatutReservation> statuts);

    boolean existsByBookIdAndStatutIn(Integer bookId, Collection<StatutReservation> statuts);
}
