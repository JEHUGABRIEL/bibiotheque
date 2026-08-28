package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.dao.UsersRepository;
import com.ibizabroker.bibliotheque.entity.Users;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
import com.ibizabroker.bibliotheque.exceptions.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@CrossOrigin("http://localhost:4200/")
@RestController
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    private UsersRepository usersRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/users")
    public ResponseEntity<?> addUserByAdmin(@RequestBody Users user) {
        // Validation des champs obligatoires
        if (user.getName() == null || user.getName().trim().isEmpty()) {
            throw new BadRequestException("Le nom est obligatoire");
        }
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            throw new BadRequestException("Le nom d'utilisateur est obligatoire");
        }
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            throw new BadRequestException("Le mot de passe est obligatoire");
        }
        if (user.getRole() == null || user.getRole().isEmpty()) {
            throw new BadRequestException("Le rôle est obligatoire");
        }

        // Vérifier l'unicité du username
        if (usersRepository.findByUsername(user.getUsername()).isPresent()) {
            throw new BadRequestException("Le nom d'utilisateur \"" + user.getUsername() + "\" est déjà pris");
        }

        String encryptPassword = passwordEncoder.encode(user.getPassword());
        user.setPassword(encryptPassword);
        Users saved = usersRepository.save(user);
        return ResponseEntity.ok(Map.of(
                "message", "Utilisateur \"" + saved.getName() + "\" créé avec succès",
                "userId", saved.getUserId()
        ));
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('Admin')")
    public List<Users> getAllUsers() {
        return usersRepository.findAll();
    }

    @PreAuthorize("hasRole('Admin')")
    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Integer id) {
        Users user = usersRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Utilisateur avec l'id " + id + " introuvable"));
        return ResponseEntity.ok(user);
    }

    @PreAuthorize("hasRole('Admin')")
    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Integer id, @RequestBody Users userDetails) {
        Users user = usersRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Utilisateur avec l'id " + id + " introuvable"));

        if (userDetails.getName() == null || userDetails.getName().trim().isEmpty()) {
            throw new BadRequestException("Le nom est obligatoire");
        }
        if (userDetails.getUsername() == null || userDetails.getUsername().trim().isEmpty()) {
            throw new BadRequestException("Le nom d'utilisateur est obligatoire");
        }

        user.setName(userDetails.getName());
        user.setRole(userDetails.getRole());
        user.setUsername(userDetails.getUsername());

        Users updatedUser = usersRepository.save(user);
        return ResponseEntity.ok(Map.of(
                "message", "Utilisateur mis à jour avec succès",
                "user", updatedUser
        ));
    }
}
