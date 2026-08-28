package com.ibizabroker.bibliotheque.controller;

import com.ibizabroker.bibliotheque.entity.JwtRequest;
import com.ibizabroker.bibliotheque.entity.JwtResponse;
import com.ibizabroker.bibliotheque.exceptions.BadRequestException;
import com.ibizabroker.bibliotheque.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin
public class JwtController {

    @Autowired
    private JwtService jwtService;

    @PostMapping("/authenticate")
    public ResponseEntity<?> createJwtToken(@RequestBody JwtRequest jwtRequest) {
        if (jwtRequest.getUsername() == null || jwtRequest.getUsername().trim().isEmpty()) {
            throw new BadRequestException("Le nom d'utilisateur est requis");
        }
        if (jwtRequest.getPassword() == null || jwtRequest.getPassword().trim().isEmpty()) {
            throw new BadRequestException("Le mot de passe est requis");
        }

        try {
            JwtResponse response = jwtService.createJwtToken(jwtRequest);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            // Bad credentials, user not found, etc.
            return ResponseEntity.status(401)
                    .body(java.util.Map.of("message", "Identifiants incorrects"));
        }
    }
}
