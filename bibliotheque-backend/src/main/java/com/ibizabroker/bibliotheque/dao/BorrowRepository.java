package com.ibizabroker.bibliotheque.dao;

import com.ibizabroker.bibliotheque.entity.Borrow;
import com.ibizabroker.bibliotheque.entity.StatutBorrow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BorrowRepository extends JpaRepository<Borrow, Integer> {
    List<Borrow> findByUserId(Integer userId);
    List<Borrow> findByBookId(Integer bookId);
    List<Borrow> findByStatut(StatutBorrow statut);
    List<Borrow> findByUserIdAndStatut(Integer userId, StatutBorrow statut);
    long countByUserIdAndStatutIn(Integer userId, List<StatutBorrow> statuts);
}
