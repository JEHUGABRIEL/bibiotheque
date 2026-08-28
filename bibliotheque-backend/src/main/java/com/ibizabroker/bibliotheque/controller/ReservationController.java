package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.service.ReservationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    @Autowired
    private ReservationService reservationService;

    @GetMapping
    public ResponseEntity<?> getAll(@RequestParam(required = false) StatutReservation statut) {
        List<Reservation> list;
        if (statut != null) {
            list = reservationService.findByStatut(statut);
        } else {
            list = reservationService.findAll();
        }
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Reservation reservation) {
        try {
            Reservation created = reservationService.create(reservation);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (ReservationService.BusinessException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/annuler")
    public ResponseEntity<?> cancel(@PathVariable Long id) {
        try {
            Reservation updated = reservationService.cancel(id);
            return ResponseEntity.ok(updated);
        } catch (ReservationService.BusinessException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
