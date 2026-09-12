package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.BorrowRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Borrow;
import com.ibizabroker.bibliotheque.entity.StatutBorrow;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
import com.ibizabroker.bibliotheque.exceptions.ConflictException;
import com.ibizabroker.bibliotheque.exceptions.ForbiddenException;
import com.ibizabroker.bibliotheque.exceptions.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;

import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/borrow")
public class BorrowController {

    @Autowired
    private BorrowRepository borrowRepository;

    @Autowired
    private UsersRepository usersRepository;

    @Autowired
    private BooksRepository booksRepository;

    /** Nombre maximal d'emprunts actifs par adhérent. */
    private static final int QUOTA_MAX_BORROWS = 3;

    /**
     * Demande d'emprunt — toute demande est créée avec le statut EN_ATTENTE.
     * Le personnel (Admin/BIBLIOTHECAIRE) peut confirmer immédiatement.
     * Un adhérent soumet une demande en attente de validation.
     *
     * Règles métier :
     * - QUOTA-01 : max 3 emprunts actifs par adhérent
     * - QUOTA-02 : 1 seul exemplaire d'un même livre par adhérent
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADHERENT', 'User', 'BIBLIOTHECAIRE', 'Admin')")
    public ResponseEntity<?> borrowBook(Authentication authentication, @RequestBody Borrow borrow) {
        if (borrow.getBookId() == null) {
            throw new BadRequestException("L'identifiant du livre est requis");
        }

        Users authenticated = usersRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new NotFoundException("Utilisateur introuvable : " + authentication.getName()));

        Users user = authenticated;
        if (isStaff(authentication) && borrow.getUserId() != null
                && !borrow.getUserId().equals(authenticated.getUserId())) {
            user = usersRepository.findById(borrow.getUserId())
                    .orElseThrow(() -> new NotFoundException("Utilisateur avec l'id " + borrow.getUserId() + " introuvable"));
        }
        borrow.setUserId(user.getUserId());

        Books book = booksRepository.findById(borrow.getBookId())
                .orElseThrow(() -> new NotFoundException("Livre avec l'id " + borrow.getBookId() + " introuvable"));

        if (book.getNoOfCopies() < 1) {
            throw new ConflictException("Le livre \"" + book.getBookName() + "\" n'est plus disponible (0 exemplaire)");
        }

        if (!isStaff(authentication)) {
            // QUOTA-01 : max 3 emprunts actifs (EN_ATTENTE ou VALIDEE)
            long activeCount = borrowRepository.countByUserIdAndStatutIn(
                    user.getUserId(), List.of(StatutBorrow.EN_ATTENTE, StatutBorrow.VALIDEE));
            if (activeCount >= QUOTA_MAX_BORROWS) {
                throw new ConflictException(
                        "Quota atteint : vous avez déjà " + activeCount + " emprunt(s) actif(s). " +
                        "Maximum autorisé : " + QUOTA_MAX_BORROWS + " emprunts.");
            }

            // QUOTA-02 : 1 seul exemplaire du même livre
            boolean alreadyBorrowed = borrowRepository.findByUserId(user.getUserId()).stream()
                    .anyMatch(b -> b.getBookId().equals(book.getBookId())
                            && (b.getStatut() == StatutBorrow.EN_ATTENTE || b.getStatut() == StatutBorrow.VALIDEE));
            if (alreadyBorrowed) {
                throw new ConflictException(
                        "Vous avez déjà un emprunt en cours ou en attente pour \"" + book.getBookName() + "\"");
            }
        }

        // Le personnel peut valider immédiatement, sinon en attente
        if (isStaff(authentication)) {
            book.borrowBook();
            booksRepository.save(book);

            Date currentDate = new Date();
            Date dueDate = new Date();
            Calendar c = Calendar.getInstance();
            c.setTime(dueDate);
            c.add(Calendar.DATE, 7);
            dueDate = c.getTime();
            borrow.setIssueDate(currentDate);
            borrow.setDueDate(dueDate);
            borrow.setStatut(StatutBorrow.VALIDEE);
            borrowRepository.save(borrow);

            return ResponseEntity.ok(Map.of(
                    "message", user.getName() + " a emprunté \"" + book.getBookName() + "\"",
                    "borrow", borrow
            ));
        } else {
            // Adhérent : demande en attente
            borrow.setStatut(StatutBorrow.EN_ATTENTE);
            borrowRepository.save(borrow);

            long newCount = activeCount(user.getUserId()) + 1;
            return ResponseEntity.ok(Map.of(
                    "message", "Votre demande d'emprunt pour \"" + book.getBookName() + "\" a été enregistrée. " +
                            "Le bibliothécaire la traitera dans les plus brefs délais. " +
                            "(Emprunts : " + newCount + "/" + QUOTA_MAX_BORROWS + ")",
                    "borrow", borrow
            ));
        }
    }

    /** Compte les emprunts actifs (EN_ATTENTE + VALIDEE) d'un adhérent. */
    private long activeCount(Integer userId) {
        return borrowRepository.countByUserIdAndStatutIn(
                userId, List.of(StatutBorrow.EN_ATTENTE, StatutBorrow.VALIDEE));
    }

    /**
     * Liste complète des emprunts — réservé au personnel.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin')")
    public List<Borrow> getAllBorrow() {
        return borrowRepository.findAll();
    }

    /**
     * Demandes en attente — réservé au personnel.
     */
    @GetMapping("pending")
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin')")
    public List<Borrow> getPendingBorrows() {
        return borrowRepository.findByStatut(StatutBorrow.EN_ATTENTE);
    }

    /**
     * Confirmer une demande d'emprunt — réservé au personnel.
     */
    @PatchMapping("{id}/confirmer")
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin')")
    public ResponseEntity<?> confirmBorrow(@PathVariable Integer id) {
        Borrow borrow = borrowRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Emprunt avec l'id " + id + " introuvable"));

        if (borrow.getStatut() != StatutBorrow.EN_ATTENTE) {
            throw new ConflictException("Cet emprunt n'est pas en attente de validation");
        }

        Books book = booksRepository.findById(borrow.getBookId())
                .orElseThrow(() -> new NotFoundException("Livre associé à l'emprunt introuvable"));

        if (book.getNoOfCopies() < 1) {
            throw new ConflictException("Le livre \"" + book.getBookName() + "\" n'est plus disponible");
        }

        book.borrowBook();
        booksRepository.save(book);

        Date currentDate = new Date();
        Date dueDate = new Date();
        Calendar c = Calendar.getInstance();
        c.setTime(dueDate);
        c.add(Calendar.DATE, 7);
        dueDate = c.getTime();
        borrow.setIssueDate(currentDate);
        borrow.setDueDate(dueDate);
        borrow.setStatut(StatutBorrow.VALIDEE);
        Borrow confirmed = borrowRepository.save(borrow);

        return ResponseEntity.ok(Map.of(
                "message", "Emprunt de \"" + book.getBookName() + "\" confirmé",
                "borrow", confirmed
        ));
    }

    /**
     * Refuser un emprunt — réservé au personnel.
     * Une demande EN_ATTENTE est simplement marquée REFUSEE ; un emprunt VALIDEE
     * (livre déjà décompté) remet l'exemplaire en rayon avant refus.
     */
    @PatchMapping("{id}/refuser")
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin')")
    public ResponseEntity<?> refuseBorrow(@PathVariable Integer id) {
        Borrow borrow = borrowRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Emprunt avec l'id " + id + " introuvable"));

        if (borrow.getStatut() == StatutBorrow.RENDU) {
            throw new ConflictException("Cet emprunt a déjà été retourné");
        }
        if (borrow.getStatut() == StatutBorrow.REFUSEE) {
            throw new ConflictException("Cet emprunt est déjà refusé");
        }

        Books book = booksRepository.findById(borrow.getBookId())
                .orElseThrow(() -> new NotFoundException("Livre associé à l'emprunt introuvable"));

        // Un emprunt validé a décompté un exemplaire : on le remet en rayon
        if (borrow.getStatut() == StatutBorrow.VALIDEE) {
            book.returnBook();
            booksRepository.save(book);
        }

        borrow.setStatut(StatutBorrow.REFUSEE);
        Borrow refused = borrowRepository.save(borrow);

        return ResponseEntity.ok(Map.of(
                "message", "Emprunt de \"" + book.getBookName() + "\" refusé",
                "borrow", refused
        ));
    }

    /**
     * Suppression d'un emprunt — réservé à l'Admin.
     * Même garde-fou que la suppression de livre : un emprunt en cours
     * (VALIDEE non rendu) bloque la suppression — le livre doit d'abord être
     * retourné, sinon l'exemplaire décompté serait perdu.
     */
    @PreAuthorize("hasRole('Admin')")
    @DeleteMapping("{id}")
    public ResponseEntity<?> deleteBorrow(@PathVariable Integer id) {
        Borrow borrow = borrowRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Emprunt avec l'id " + id + " introuvable"));

        if (borrow.getStatut() == StatutBorrow.VALIDEE && borrow.getReturnDate() == null) {
            throw new ConflictException(
                    "Impossible de supprimer un emprunt en cours. Le livre doit d'abord être retourné.");
        }

        borrowRepository.delete(borrow);
        return ResponseEntity.ok(Map.of(
                "message", "Emprunt #" + borrow.getBorrowId() + " supprimé avec succès",
                "deleted", Boolean.TRUE
        ));
    }

    /**
     * Le personnel (Admin hérité ou BIBLIOTHECAIRE).
     */
    private boolean isStaff(Authentication authentication) {
        return authentication.getAuthorities().stream().anyMatch(a ->
                "ROLE_Admin".equals(a.getAuthority()) || "ROLE_BIBLIOTHECAIRE".equals(a.getAuthority()));
    }

    /**
     * Retour de livre — validé par le personnel.
     */
    @PutMapping
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin')")
    public ResponseEntity<?> returnBook(@RequestBody Borrow borrow) {
        if (borrow.getBorrowId() == null) {
            throw new BadRequestException("L'identifiant de l'emprunt est requis");
        }

        Borrow borrowBook = borrowRepository.findById(borrow.getBorrowId())
                .orElseThrow(() -> new NotFoundException("Emprunt avec l'id " + borrow.getBorrowId() + " introuvable"));

        if (borrowBook.getStatut() != StatutBorrow.VALIDEE) {
            throw new ConflictException("Seuls les emprunts validés peuvent être retournés");
        }

        Books book = booksRepository.findById(borrowBook.getBookId())
                .orElseThrow(() -> new NotFoundException("Livre associé à l'emprunt introuvable"));

        if (borrowBook.getReturnDate() != null) {
            throw new ConflictException("Cet emprunt a déjà été retourné le " + borrowBook.getReturnDate());
        }

        book.returnBook();
        booksRepository.save(book);

        Date currentDate = new Date();
        borrowBook.setReturnDate(currentDate);
        borrowBook.setStatut(StatutBorrow.RENDU);
        Borrow returned = borrowRepository.save(borrowBook);

        return ResponseEntity.ok(Map.of(
                "message", "Retour enregistré pour \"" + book.getBookName() + "\"",
                "borrow", returned
        ));
    }

    /**
     * Demande de retour — soumise par l'adhérent.
     */
    @PutMapping("request")
    @PreAuthorize("hasAnyRole('ADHERENT', 'User')")
    public ResponseEntity<?> requestReturn(Authentication authentication, @RequestBody Borrow borrow) {
        if (borrow.getBorrowId() == null) {
            throw new BadRequestException("L'identifiant de l'emprunt est requis");
        }

        Users authenticated = usersRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new NotFoundException("Utilisateur introuvable : " + authentication.getName()));

        Borrow borrowBook = borrowRepository.findById(borrow.getBorrowId())
                .orElseThrow(() -> new NotFoundException("Emprunt avec l'id " + borrow.getBorrowId() + " introuvable"));

        // Vérifier que l'emprunt appartient à l'adhérent
        if (!borrowBook.getUserId().equals(authenticated.getUserId())) {
            throw new ForbiddenException("Cet emprunt ne vous appartient pas");
        }

        if (borrowBook.getStatut() != StatutBorrow.VALIDEE) {
            throw new ConflictException("Seuls les emprunts validés peuvent être retournés");
        }

        Books book = booksRepository.findById(borrowBook.getBookId())
                .orElseThrow(() -> new NotFoundException("Livre associé à l'emprunt introuvable"));

        book.returnBook();
        booksRepository.save(book);

        Date currentDate = new Date();
        borrowBook.setReturnDate(currentDate);
        borrowBook.setStatut(StatutBorrow.RENDU);
        Borrow returned = borrowRepository.save(borrowBook);

        return ResponseEntity.ok(Map.of(
                "message", "Retour de \"" + book.getBookName() + "\" enregistré",
                "borrow", returned
        ));
    }

    @GetMapping("user/{id}")
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin') or @borrowSecurity.canAccessUser(authentication, #id)")
    public List<Borrow> booksBorrowedByUser(@PathVariable Integer id) {
        if (!usersRepository.existsById(id)) {
            throw new NotFoundException("Utilisateur avec l'id " + id + " introuvable");
        }
        return borrowRepository.findByUserId(id);
    }

    @GetMapping("user/{id}/pending")
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin') or @borrowSecurity.canAccessUser(authentication, #id)")
    public List<Borrow> pendingBorrowsByUser(@PathVariable Integer id) {
        if (!usersRepository.existsById(id)) {
            throw new NotFoundException("Utilisateur avec l'id " + id + " introuvable");
        }
        return borrowRepository.findByUserIdAndStatut(id, StatutBorrow.EN_ATTENTE);
    }

    /**
     * Quota de l'adhérent connecté : emprunts actifs + quota restant.
     */
    @GetMapping("my/quota")
    @PreAuthorize("hasAnyRole('ADHERENT', 'User')")
    public ResponseEntity<?> myQuota(Authentication authentication) {
        Users user = usersRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        long activeCount = activeCount(user.getUserId());
        return ResponseEntity.ok(Map.of(
                "activeCount", activeCount,
                "maxQuota", QUOTA_MAX_BORROWS,
                "remaining", QUOTA_MAX_BORROWS - activeCount
        ));
    }

    @GetMapping("book/{id}")
    @PreAuthorize("hasAnyRole('BIBLIOTHECAIRE', 'Admin')")
    public List<Borrow> bookBorrowHistory(@PathVariable Integer id) {
        if (!booksRepository.existsById(id)) {
            throw new NotFoundException("Livre avec l'id " + id + " introuvable");
        }
        return borrowRepository.findByBookId(id);
    }

    /**
     * Bean référencé par les @PreAuthorize ci-dessus (SpEL) : autorise l'accès
     * aux emprunts d'un adhérent uniquement s'il s'agit de l'adhérent connecté
     * lui-même. Le personnel (BIBLIOTHECAIRE/Admin) passe par la première
     * condition et n'utilise pas ce bean.
     */
    @Component("borrowSecurity")
    public static class BorrowSecurity {

        private final UsersRepository usersRepository;

        BorrowSecurity(UsersRepository usersRepository) {
            this.usersRepository = usersRepository;
        }

        public boolean canAccessUser(Authentication authentication, Integer userId) {
            if (authentication == null || userId == null) {
                return false;
            }
            return usersRepository.findByUsername(authentication.getName())
                    .map(u -> userId.equals(u.getUserId()))
                    .orElse(false);
        }
    }
}
