package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.dao.BorrowRepository;
import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.entity.Borrow;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
import com.ibizabroker.bibliotheque.exceptions.ConflictException;
import com.ibizabroker.bibliotheque.exceptions.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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

    @PostMapping
    public ResponseEntity<?> borrowBook(@RequestBody Borrow borrow) {
        if (borrow.getUserId() == null || borrow.getBookId() == null) {
            throw new BadRequestException("L'identifiant de l'utilisateur et du livre sont requis");
        }

        Users user = usersRepository.findById(borrow.getUserId())
                .orElseThrow(() -> new NotFoundException("Utilisateur avec l'id " + borrow.getUserId() + " introuvable"));

        Books book = booksRepository.findById(borrow.getBookId())
                .orElseThrow(() -> new NotFoundException("Livre avec l'id " + borrow.getBookId() + " introuvable"));

        if (book.getNoOfCopies() < 1) {
            throw new ConflictException("Le livre \"" + book.getBookName() + "\" n'est plus disponible (0 exemplaire)");
        }

        book.borrowBook();
        booksRepository.save(book);

        Date currentDate = new Date();
        Date overdueDate = new Date();
        Calendar c = Calendar.getInstance();
        c.setTime(overdueDate);
        c.add(Calendar.DATE, 7);
        overdueDate = c.getTime();
        borrow.setIssueDate(currentDate);
        borrow.setDueDate(overdueDate);
        borrowRepository.save(borrow);

        return ResponseEntity.ok(Map.of(
                "message", user.getName() + " a emprunté \"" + book.getBookName() + "\"",
                "borrow", borrow
        ));
    }

    @GetMapping
    public List<Borrow> getAllBorrow() {
        return borrowRepository.findAll();
    }

    @PutMapping
    public ResponseEntity<?> returnBook(@RequestBody Borrow borrow) {
        if (borrow.getBorrowId() == null) {
            throw new BadRequestException("L'identifiant de l'emprunt est requis");
        }

        Borrow borrowBook = borrowRepository.findById(borrow.getBorrowId())
                .orElseThrow(() -> new NotFoundException("Emprunt avec l'id " + borrow.getBorrowId() + " introuvable"));

        Books book = booksRepository.findById(borrowBook.getBookId())
                .orElseThrow(() -> new NotFoundException("Livre associé à l'emprunt introuvable"));

        if (borrowBook.getReturnDate() != null) {
            throw new ConflictException("Cet emprunt a déjà été retourné le " + borrowBook.getReturnDate());
        }

        book.returnBook();
        booksRepository.save(book);

        Date currentDate = new Date();
        borrowBook.setReturnDate(currentDate);
        Borrow returned = borrowRepository.save(borrowBook);

        return ResponseEntity.ok(Map.of(
                "message", "Retour enregistré pour \"" + book.getBookName() + "\"",
                "borrow", returned
        ));
    }

    @GetMapping("user/{id}")
    public List<Borrow> booksBorrowedByUser(@PathVariable Integer id) {
        if (!usersRepository.existsById(id)) {
            throw new NotFoundException("Utilisateur avec l'id " + id + " introuvable");
        }
        return borrowRepository.findByUserId(id);
    }

    @GetMapping("book/{id}")
    public List<Borrow> bookBorrowHistory(@PathVariable Integer id) {
        if (!booksRepository.existsById(id)) {
            throw new NotFoundException("Livre avec l'id " + id + " introuvable");
        }
        return borrowRepository.findByBookId(id);
    }
}
