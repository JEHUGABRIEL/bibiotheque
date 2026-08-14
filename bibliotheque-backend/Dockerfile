# ============================================================
# Étape 1 — Compilation
#
# Le pom.xml cible Java 1.8 et hérite de Lombok ~1.18.20 (parent
# Spring Boot 2.4.5). Ce Lombok ne connaît pas les JDK récents
# (NoSuchFieldError JCTree$JCImport.qualid). On compile donc avec
# un JDK 8 : stratégie A de la partie 1.3, sans toucher au pom.
#
# -DskipTests : le test @SpringBootTest charge tout le contexte
# Spring, y compris la base MySQL — absente pendant la construction.
# ============================================================
FROM maven:3.6.3-jdk-8 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# ============================================================
# Étape 2 — Exécution
#
# On ne garde que le jar compilé en Java 8 + un JRE 8.
# Aucun mot de passe ici : la connexion DB passe par les variables
# d'environnement définies dans docker-compose.yml.
# ============================================================
FROM eclipse-temurin:8-jre
WORKDIR /app
COPY --from=build /app/target/bibliotheque-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
