package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.dao.BooksRepository;
import com.ibizabroker.bibliotheque.entity.Books;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
import com.ibizabroker.bibliotheque.exceptions.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CrossOrigin("http://localhost:4200/")
@RestController
@RequestMapping("/admin")
public class BooksController {

    @Autowired
    private BooksRepository booksRepository;

    @GetMapping("/books")
    public List<Books> getAllBooks() {
        return booksRepository.findAll();
    }

    @PreAuthorize("hasRole('Admin')")
    @GetMapping("/books/{id}")
    public ResponseEntity<?> getBookById(@PathVariable Integer id) {
        Books book = booksRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Livre avec l'id " + id + " introuvable"));
        return ResponseEntity.ok(book);
    }

    @PreAuthorize("hasRole('Admin')")
    @PostMapping("/books")
    public ResponseEntity<?> createBook(@RequestBody Books book) {
        if (book.getBookName() == null || book.getBookName().trim().isEmpty()) {
            throw new BadRequestException("Le titre du livre est obligatoire");
        }
        if (book.getBookAuthor() == null || book.getBookAuthor().trim().isEmpty()) {
            throw new BadRequestException("L'auteur du livre est obligatoire");
        }
        if (book.getNoOfCopies() != null && book.getNoOfCopies() < 0) {
            throw new BadRequestException("Le nombre d'exemplaires ne peut pas être négatif");
        }

        Books saved = booksRepository.save(book);
        return ResponseEntity.ok(Map.of(
                "message", "Livre \"" + saved.getBookName() + "\" ajouté avec succès",
                "bookId", saved.getBookId()
        ));
    }

    @PreAuthorize("hasRole('Admin')")
    @PutMapping("/books/{id}")
    public ResponseEntity<?> updateBook(@PathVariable Integer id, @RequestBody Books bookDetails) {
        Books book = booksRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Livre avec l'id " + id + " introuvable"));

        if (bookDetails.getBookName() != null) book.setBookName(bookDetails.getBookName());
        if (bookDetails.getBookAuthor() != null) book.setBookAuthor(bookDetails.getBookAuthor());
        if (bookDetails.getBookGenre() != null) book.setBookGenre(bookDetails.getBookGenre());
        if (bookDetails.getNoOfCopies() != null) {
            if (bookDetails.getNoOfCopies() < 0) {
                throw new BadRequestException("Le nombre d'exemplaires ne peut pas être négatif");
            }
            book.setNoOfCopies(bookDetails.getNoOfCopies());
        }

        Books updatedBook = booksRepository.save(book);
        return ResponseEntity.ok(Map.of(
                "message", "Livre mis à jour avec succès",
                "book", updatedBook
        ));
    }

    @PreAuthorize("hasRole('Admin')")
    @DeleteMapping("/books/{id}")
    public ResponseEntity<?> deleteBook(@PathVariable Integer id) {
        Books book = booksRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Livre avec l'id " + id + " introuvable"));

        booksRepository.delete(book);
        return ResponseEntity.ok(Map.of(
                "message", "Livre \"" + book.getBookName() + "\" supprimé avec succès",
                "deleted", Boolean.TRUE
        ));
    }
}
