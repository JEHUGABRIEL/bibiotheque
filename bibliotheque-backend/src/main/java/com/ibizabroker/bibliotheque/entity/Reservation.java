package com.ibizabroker.bibliotheque.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Data;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.*;
import java.util.Date;

@Data
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "reservation")
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer bookId;
    private Integer userId;

    /**
     * Nom d'un livre PAS encore enregistré — transporté par la requête de
     * réservation puis résolu/créé côté service. Jamais persisté (sinon
     * une colonne sans rapport apparaîtrait sur la table reservation).
     */
    @Transient
    private String newBookName;

    @Enumerated(EnumType.STRING)
    private StatutReservation statut;

    @Temporal(TemporalType.TIMESTAMP)
    @JsonSerialize(using = JsonDataSerializer.class)
    private Date dateReservation;

    @Temporal(TemporalType.TIMESTAMP)
    @JsonSerialize(using = JsonDataSerializer.class)
    private Date dateExpiration;
}
