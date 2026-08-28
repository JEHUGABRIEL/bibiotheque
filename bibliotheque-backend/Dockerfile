# ============================================================
# Étape 1 — Compilation (Java 21 pour Spring Boot 3.x)
# ============================================================
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# ============================================================
# Étape 2 — Exécution (JRE 21)
# ============================================================
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/bibliotheque-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
