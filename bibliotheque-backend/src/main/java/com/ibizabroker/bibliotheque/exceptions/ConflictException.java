package com.ibizabroker.bibliotheque.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Erreur 409 : conflit métier.
 * Ex: réservation déjà existante, quota atteint, opération impossible sur l'état actuel.
 */
@ResponseStatus(value = HttpStatus.CONFLICT)
public class ConflictException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public ConflictException(String message) {
        super(message);
    }
}
