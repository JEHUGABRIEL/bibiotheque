package com.ibizabroker.bibliotheque.exceptions;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Traduit les exceptions en réponses JSON uniformes :
 * {@code { "message": ..., "status": ..., "timestamp": ... }} (voir {@link ApiErrorResponse}).
 *
 * <p>Le statut du corps et celui de la ligne HTTP sont produits par le MÊME handler
 * (méthode {@link #erreur(HttpStatus, String)}), donc jamais désynchronisés.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Qui est à l'origine de la requête refusée (pour la journalisation). */
    private String utilisateurCourant() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "anonyme";
    }

    /**
     * Fabrique unique des réponses d'erreur : le statut passé ici alimente à la fois la
     * ligne de statut HTTP et le champ {@code status} du corps.
     */
    private ResponseEntity<Map<String, Object>> erreur(HttpStatus statut, String message) {
        return ResponseEntity.status(statut).body(ApiErrorResponse.of(message, statut));
    }

    /**
     * 400 — Données invalides (champs manquants, format incorrect)
     */
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(BadRequestException e) {
        return erreur(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    /**
     * 400 — Erreur de validation @Valid sur @RequestBody
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return erreur(HttpStatus.BAD_REQUEST, message.isEmpty() ? "Données invalides" : message);
    }

    /**
     * 400 — JSON malformé ou type incompatible
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
        return erreur(HttpStatus.BAD_REQUEST, "Format de données invalide");
    }

    /**
     * 400 — Paramètre obligatoire manquant
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(MissingServletRequestParameterException e) {
        return erreur(HttpStatus.BAD_REQUEST, "Paramètre manquant: " + e.getParameterName());
    }

    /**
     * 403 — Un adhérent tente d'accéder à la réservation d'un autre (RS-03)
     */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(ForbiddenException e, HttpServletRequest request) {
        log.warn("Accès refusé [403] {} {} — utilisateur '{}' : {}",
                request.getMethod(), request.getRequestURI(), utilisateurCourant(), e.getMessage());
        return erreur(HttpStatus.FORBIDDEN, e.getMessage());
    }

    /**
     * 404 — Ressource introuvable
     */
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NotFoundException e) {
        return erreur(HttpStatus.NOT_FOUND, e.getMessage());
    }

    /**
     * 409 — Conflit métier (reservation, quota, état interdit)
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(ConflictException e) {
        return erreur(HttpStatus.CONFLICT, e.getMessage());
    }

    /**
     * 409 — Violation de contrainte DB (clé dupliquée, FK, etc.)
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException e) {
        log.warn("Violation de contrainte DB: {}", e.getMessage());
        return erreur(HttpStatus.CONFLICT,
                "Cette opération viole une contrainte de la base de données (doublon ou référence manquante)");
    }

    /**
     * 403 — Accès refusé : l'utilisateur est authentifié mais n'a pas le droit.
     * À déclarer AVANT le handler générique Exception, sinon Spring la transformerait en 500.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException e, HttpServletRequest request) {
        log.warn("Accès refusé [403] {} {} — utilisateur '{}' : droits insuffisants",
                request.getMethod(), request.getRequestURI(), utilisateurCourant());
        return erreur(HttpStatus.FORBIDDEN, "Accès refusé : vous n'avez pas les droits nécessaires");
    }

    /**
     * Erreur inattendue — on log le détail côté serveur, on renvoie un message générique côté client
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        log.error("Erreur inattendue", e);
        return erreur(HttpStatus.INTERNAL_SERVER_ERROR,
                "Une erreur interne est survenue. Veuillez réessayer.");
    }
}
