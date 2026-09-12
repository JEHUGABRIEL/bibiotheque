package com.ibizabroker.bibliotheque.dao;

import com.ibizabroker.bibliotheque.entity.Books;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BooksRepository extends JpaRepository<Books, Integer> {

    /** Résolution d'un livre par son nom (insensible à la casse) — réservation d'un livre non enregistré. */
    Optional<Books> findByBookNameIgnoreCase(String bookName);
}
