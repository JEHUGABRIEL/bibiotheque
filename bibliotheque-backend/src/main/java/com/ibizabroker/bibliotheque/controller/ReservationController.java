package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.service.ReservationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoints de réservation — sécurisés (Séance 4).
 *
 * RS-01 : aucun endpoint n'est permitAll → 401 sans token (JwtAuthenticationEntryPoint).
 * RS-02 : @PreAuthorize distingue ADHERENT et BIBLIOTHECAIRE → 403 sinon.
 *         (le rôle hérité 'Admin' des séances précédentes a aussi les droits staff)
 * RS-03 / RS-05 : la liste et les accès individuels sont filtrés par l'identité du token (service).
 * RS-04 : l'identité de l'adhérent vient de l'Authentication (token JWT), jamais du corps de la requête.
 */
@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    @Autowired
    private ReservationService reservationService;

    /**
     * ADHERENT : uniquement ses propres réservations (filtre service).
     * BIBLIOTHECAIRE : toutes les réservations.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADHERENT') or hasRole('BIBLIOTHECAIRE') or hasRole('Admin')")
    public ResponseEntity<List<Reservation>> getAll(@RequestParam(required = false) StatutReservation statut,
                                                    Authentication authentication) {
        List<Reservation> list = reservationService.findAllFor(statut, authentication.getName());
        return ResponseEntity.ok(list);
    }

    /**
     * ADHERENT : pour lui-même uniquement — le service écrase l'userId du corps par celui du token (RS-04).
     * BIBLIOTHECAIRE : pour n'importe qui.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADHERENT') or hasRole('BIBLIOTHECAIRE') or hasRole('Admin')")
    public ResponseEntity<Reservation> create(@RequestBody Reservation reservation,
                                              Authentication authentication) {
        Reservation created = reservationService.createFor(reservation, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * ADHERENT : si la réservation lui appartient (sinon 403, RS-03).
     * BIBLIOTHECAIRE : toutes.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADHERENT') or hasRole('BIBLIOTHECAIRE') or hasRole('Admin')")
    public ResponseEntity<Reservation> getById(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(reservationService.getByIdFor(id, authentication.getName()));
    }

    /**
     * Annulation — mêmes règles de propriété que la lecture (RS-03).
     */
    @PatchMapping("/{id}/annuler")
    @PreAuthorize("hasRole('ADHERENT') or hasRole('BIBLIOTHECAIRE') or hasRole('Admin')")
    public ResponseEntity<Reservation> cancel(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(reservationService.cancelFor(id, authentication.getName()));
    }

    /**
     * Réservé au BIBLIOTHECAIRE — un ADHERENT reçoit 403 (RS-02).
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('BIBLIOTHECAIRE') or hasRole('Admin')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        reservationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
