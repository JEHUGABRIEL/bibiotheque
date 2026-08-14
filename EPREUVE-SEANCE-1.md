# Épreuve — Séance 1

**Remise en route et environnement**

| | |
|---|---|
| **Format** | Pratique, sur machine, en autonomie |
| **Durée** | 3 h |
| **Documents autorisés** | Tous : README, notes, documentation en ligne, moteur de recherche |
| **Rendu** | Une branche poussée + une Pull Request ouverte |
| **Barème** | 20 points |

L'épreuve est ouverte : ce n'est pas votre mémoire qu'on évalue, c'est votre
capacité à faire tourner un projet inconnu et à expliquer ce que vous faites.
Copier une réponse sans pouvoir la justifier à l'oral ne vaut aucun point.

---

## Consignes de rendu

Tout se rend par Git. Un travail qui n'est pas poussé n'existe pas.

1. Créez votre branche depuis `main` :

   ```bash
   git switch -c epreuve/nom-prenom
   ```

2. Travaillez, en commits séparés et lisibles (voir partie 5).

3. Poussez et ouvrez une **Pull Request** vers `main`, intitulée
   `Épreuve séance 1 — Nom Prénom`.

4. La PR doit contenir, à la racine du dépôt, un dossier `epreuve/` avec :

   ```
   epreuve/
   ├── RAPPORT.md        vos réponses écrites (parties 1, 2 et 4)
   └── captures/         vos captures d'écran
   ```

   Les fichiers Docker de la partie 3 vont, eux, à leur place normale : à la
   racine et dans les deux sous-projets.

**Ce qui invalide le rendu** : `node_modules/`, `target/` ou `dist/` commités ;
un commit direct sur `main` ; une PR sans description.

---

## Partie 1 — L'environnement (4 points)

Prouvez que votre machine est prête. Dans `epreuve/RAPPORT.md`, section
« Environnement » :

**1.1** *(1 pt)* Collez la sortie **brute** des commandes suivantes :

```bash
java -version
node -v
npm -v
docker compose version
git --version
```

**1.2** *(1 pt)* `mvn -version` (ou `./mvnw -version`) affiche aussi une version
de Java. Est-ce la même que `java -version` sur votre machine ? Expliquez en
deux phrases d'où vient cette version et quelle variable d'environnement la
détermine.

**1.3** *(2 pts)* Lancez :

```bash
cd bibliotheque-backend
./mvnw clean package
```

Collez la sortie d'erreur complète. Puis répondez :

* Quelle est la **cause** de cet échec ? Ne recopiez pas le message : expliquez
  le mécanisme.
* Quelles sont les **deux stratégies** possibles pour le résoudre ?
  Donnez un avantage et un inconvénient pour chacune.

> Si, sur votre machine, le build réussit : indiquez quel JDK vous utilisez et
> expliquez pourquoi il passe. La question reste notée.

---

## Partie 2 — Lire une arborescence (4 points)

Toujours dans `epreuve/RAPPORT.md`, section « Arborescence ». Répondez en
**citant le chemin exact du fichier** à chaque fois. Une réponse sans chemin
vaut zéro.

**2.1** *(0,5 pt)* Quel fichier contient l'URL, l'utilisateur et le mot de passe
de la base de données ?

**2.2** *(0,5 pt)* Quel fichier décide que `POST /authenticate` est accessible
sans être connecté ?

**2.3** *(0,5 pt)* Quelle classe transforme un objet `Books` en ligne de table
MySQL ? Quel nom de table vise-t-elle exactement, et où est-ce écrit ?

**2.4** *(0,5 pt)* `BooksRepository` est une interface **vide**. Qui écrit le
code de la méthode `save()` ? À quel moment ?

**2.5** *(1 pt)* Dans le frontend, trois fichiers contiennent l'adresse
`http://localhost:8080`, pour un total de quatre occurrences. Citez-les toutes.
Pourquoi est-ce un problème dès qu'on veut déployer ailleurs que sur son poste ?

**2.6** *(1 pt)* Le fichier `app-routing.module.ts` associe des routes à des
rôles. Listez les routes réservées au rôle `Admin` et celles réservées au rôle
`User`. Trois routes ne sont protégées par aucun `canActivate` : lesquelles, et
est-ce normal pour chacune ?

---

## Partie 3 — Faire tourner l'ensemble (6 points)

**L'objectif : `docker compose up` démarre les trois services, et l'application
est utilisable dans le navigateur.**

Le dépôt ne contient aucun fichier Docker. Vous les écrivez.

### Attendu

| Fichier | Contenu |
|---|---|
| `docker-compose.yml` (racine) | Les trois services : `db`, `backend`, `frontend` |
| `bibliotheque-backend/Dockerfile` | Construction et exécution de l'API |
| `bibliotheque-frontend/Dockerfile` | Construction et exécution de l'interface |

### Barème détaillé

| | Points |
|---|---|
| **3.1** Le service `db` démarre, le schéma `bibliotheque` existe, les données survivent à un `docker compose down` puis `up` | 1,5 |
| **3.2** Le service `backend` se construit et répond sur le port 8080 | 1,5 |
| **3.3** Le service `frontend` se construit et sert l'interface sur le port 4200 | 1,5 |
| **3.4** Le backend attend que la base soit **réellement prête** avant de démarrer, et ne meurt pas au premier lancement | 1 |
| **3.5** Aucun mot de passe en dur dans le `Dockerfile` : ils passent par des variables d'environnement | 0,5 |

### Contraintes

* **Vous ne modifiez ni `pom.xml` ni `package.json`.** Débrouillez-vous avec le
  projet tel qu'il est. (Si vous jugez qu'une modification est indispensable,
  ne la faites pas : décrivez-la dans le rapport, elle sera prise en compte.)
* **Vous ne modifiez pas `application.properties`.** Les paramètres de connexion
  se surchargent par variables d'environnement — trouvez comment.
* Les images doivent se construire depuis zéro : `docker compose build --no-cache`
  doit passer sur une machine qui n'a jamais vu le projet.

### Preuve à fournir

Dans `epreuve/captures/` :

* `docker-compose-ps.png` — la sortie de `docker compose ps` avec les trois
  services en cours d'exécution.
* `application.png` — l'application ouverte dans le navigateur, connecté en
  tant qu'administrateur, avec au moins un livre visible dans la liste.

### Piège annoncé

Le frontend appelle `http://localhost:8080`. Ce code s'exécute dans le
**navigateur**, pas dans le conteneur. Réfléchissez à ce que `localhost` désigne
dans chacun des deux cas avant d'écrire quoi que ce soit. Une mauvaise réponse
ici et rien ne s'affiche, sans le moindre message d'erreur côté serveur.

---

## Partie 4 — Suivre une donnée (4 points)

Section « Trajet » de `epreuve/RAPPORT.md`.

**4.1** *(2 pts)* Prenez **l'emprunt d'un livre** (pas la création — celle-là est
déjà faite dans le README). Reconstituez le trajet complet, du clic jusqu'à la
base, sous forme de tableau :

| # | Couche | Fichier (chemin exact) | Ce qui s'y passe |
|---|---|---|---|

On attend au minimum le composant, le service Angular, l'intercepteur, le filtre
JWT, le contrôleur, le ou les repositories, la ou les entités, et le SQL final.

Précisez ce que `BorrowController.borrowBook()` fait de **particulier** par
rapport à la création d'un livre — regardez combien de tables sont touchées.

**4.2** *(1 pt)* Réalisez les trois manipulations suivantes et, pour chacune,
donnez le **code HTTP obtenu ou le comportement observé**, puis le **fichier
responsable** de cette réponse. Attention : l'une des trois ne produit aucun
appel réseau — sachez dire laquelle et pourquoi.

| Manipulation | Code / comportement | Fichier responsable |
|---|---|---|
| `curl -X POST http://localhost:8080/admin/books` sans en-tête `Authorization` | ? | ? |
| Se connecter avec un compte de rôle `User`, puis ouvrir `/books` dans le navigateur | ? | ? |
| `GET /admin/books/9999` avec un token d'administrateur valide | ? | ? |

**4.3** *(1 pt)* La liste des livres est protégée à deux endroits : par
`auth.guard.ts` dans le navigateur et par `@PreAuthorize` dans le contrôleur.
Cette double protection est-elle redondante ? Si l'on devait n'en garder qu'une
seule, laquelle et pourquoi ? Répondez en cinq lignes maximum.

---

## Partie 5 — Git (2 points)

Évalué directement sur votre branche et votre Pull Request.

| | Points |
|---|---|
| **5.1** Branche nommée `epreuve/nom-prenom`, partant de `main` | 0,25 |
| **5.2** Au moins 4 commits, chacun cohérent (un sujet par commit), messages explicites à l'impératif | 0,75 |
| **5.3** Aucun fichier généré versionné : ni `node_modules/`, ni `target/`, ni `dist/` | 0,5 |
| **5.4** Pull Request ouverte, avec une description qui dit **ce que ça fait**, **comment le tester**, et **ce qui reste à faire** | 0,5 |

Un message comme `update`, `fix`, `wip` ou `commit final` ne compte pas comme
explicite.

---

## Bonus (jusqu'à +2 points, dans la limite de 20)

À traiter seulement si tout le reste est fait.

* **+1** — Un service supplémentaire dans `docker-compose.yml` qui insère le
  compte administrateur et quelques livres automatiquement au premier
  démarrage, de sorte qu'un `docker compose up` sur une machine vierge donne
  une application immédiatement utilisable, sans SQL manuel.
* **+0,5** — Un `README` de démarrage rapide en tête de votre PR : trois
  commandes maximum, du clone à l'application ouverte.
* **+0,5** — Repérez et documentez dans le rapport **un vrai défaut** du code
  existant (sécurité, gestion d'erreur, cohérence). Ne le corrigez pas :
  décrivez-le, expliquez le risque, proposez la correction. Un seul, bien
  argumenté.

---

## Récapitulatif du barème

| Partie | Sujet | Points |
|---|---|---|
| 1 | Environnement et diagnostic | 4 |
| 2 | Lecture de l'arborescence | 4 |
| 3 | Docker : faire tourner l'ensemble | 6 |
| 4 | Trajet d'une donnée | 4 |
| 5 | Git et Pull Request | 2 |
| — | **Total** | **20** |
| Bonus | | +2 max |

---

## Conseils

* **Commencez par la partie 3.** C'est la plus longue et la plus bloquante. Les
  parties 1, 2 et 4 se rédigent vite une fois que l'application tourne.
* **Committez au fur et à mesure.** Un seul gros commit à 11h55 coûte des points
  en partie 5, et vous prive de tout filet en cas de fausse manœuvre.
* **Une erreur qui vous bloque est un résultat**, pas un échec. Collez-la dans le
  rapport avec ce que vous avez tenté : un diagnostic honnête vaut mieux qu'une
  case laissée vide.
* **Relisez votre PR avant de la soumettre**, dans l'onglet *Files changed* de
  GitHub. Vous verrez ce que le correcteur verra — y compris les fichiers que
  vous n'aviez pas l'intention d'envoyer.
