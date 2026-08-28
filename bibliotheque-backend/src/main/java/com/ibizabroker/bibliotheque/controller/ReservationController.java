package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.entity.Reservation;
import com.ibizabroker.bibliotheque.entity.StatutReservation;
import com.ibizabroker.bibliotheque.service.ReservationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    @Autowired
    private ReservationService reservationService;

    @GetMapping
    public ResponseEntity<List<Reservation>> getAll(@RequestParam(required = false) StatutReservation statut) {
        List<Reservation> list;
        if (statut != null) {
            list = reservationService.findByStatut(statut);
        } else {
            list = reservationService.findAll();
        }
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<Reservation> create(@RequestBody Reservation reservation) {
        Reservation created = reservationService.create(reservation);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{id}/annuler")
    public ResponseEntity<Reservation> cancel(@PathVariable Long id) {
        Reservation updated = reservationService.cancel(id);
        return ResponseEntity.ok(updated);
    }
}
