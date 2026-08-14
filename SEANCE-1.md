# Séance 1 — Vendredi 14 août

## Remise en route et environnement

**Objectif** : que chacun ait un environnement qui tourne et sache lancer un
projet complet de zéro. C'est la séance qui rattrape ceux qui n'ont pas codé
depuis des mois.

**À la fin, vous savez** : démarrer un projet Spring Boot + Angular inconnu sur
votre machine, et suivre le trajet d'une donnée à travers les couches.

---

## À faire AVANT de venir

Installer et vérifier :

| Outil | Version minimale | Commande de vérification |
|---|---|---|
| JDK | 17 | `java -version` |
| Node.js | 20 | `node -v` |
| Docker Desktop | à jour, **lancé** | `docker compose version` |
| IDE | IntelliJ IDEA ou VS Code | — |

Ne venez pas avec une machine vierge. Une installation ratée le matin même,
c'est une demi-journée perdue pour vous et pour le groupe.

---

## Déroulé

### 8h30 — Installation et vérification

On ne code pas encore. On prouve que la machine est prête.

Ouvrez un terminal et exécutez les quatre commandes ci-dessus. Notez les
versions exactes que vous obtenez : vous en aurez besoin dans l'épreuve.

Points d'attention fréquents :

* **Plusieurs JDK installés.** `java -version` donne le JDK d'exécution ;
  `mvn -version` révèle celui que Maven utilise réellement. Les deux peuvent
  différer. La variable qui tranche est `JAVA_HOME`.
* **Docker Desktop installé mais pas démarré.** `docker -v` répondra quand même,
  `docker ps` échouera. C'est `docker ps` qui fait foi.
* **Node installé par un gestionnaire de versions** (nvm, volta, fnm) : vérifiez
  la version *active dans ce terminal*, pas celle installée globalement.

### 9h15 — Cloner le projet et comprendre son arborescence

```bash
git clone <url-du-depot> bibliotheque
cd bibliotheque
```

Puis, avant toute chose : **lisez le [README](README.md), sections 2 et 3.**

L'exercice de cette demi-heure n'est pas de lancer le projet, c'est de savoir
répondre à ces questions sans exécuter une seule ligne :

1. Combien y a-t-il d'applications dans ce dépôt ? Sur quels ports ?
2. Où se trouve le point d'entrée du backend ? Et celui du frontend ?
3. Quel fichier contient l'adresse de la base de données ?
4. Quel fichier décide qu'une URL est accessible sans être connecté ?
5. Dans le frontend, où sont écrits les appels réseau ?
6. Quels dossiers ne sont pas versionnés, et pourquoi ?

Réflexe à prendre : dans un projet inconnu, on lit d'abord `pom.xml` et
`package.json`. Ils disent la stack, les versions et les commandes disponibles.

### 10h00 — Lancer backend + frontend + base

La consigne est de tout lancer avec **`docker compose up`**.

Or ce dépôt ne contient **aucun** fichier Docker. C'est le cœur de l'exercice :
vous allez les écrire.

Ce qu'il faut faire tourner ensemble :

| Service | Rôle | Port |
|---|---|---|
| `db` | MySQL, schéma `bibliotheque` | 3306 |
| `backend` | l'API Spring Boot | 8080 |
| `frontend` | l'interface Angular | 4200 |

Trois difficultés à anticiper, dans cet ordre :

1. **Le backend ne compile pas avec un JDK récent.** Testez d'abord en local
   (`./mvnw clean package`) pour voir l'erreur de vos propres yeux. Deux sorties
   possibles : construire l'image avec un JDK plus ancien, ou moderniser le
   projet. Les deux sont défendables — sachez dire laquelle vous avez choisie et
   pourquoi.
2. **Le backend démarre avant que MySQL soit prêt** et meurt sur une erreur de
   connexion. `depends_on` seul ne suffit pas : il attend le démarrage du
   conteneur, pas la disponibilité de la base.
3. **Le frontend appelle `http://localhost:8080` en dur.** Réfléchissez à qui
   exécute ce code : ce n'est pas le conteneur, c'est le navigateur de
   l'utilisateur. Cela change complètement ce que « localhost » désigne.

Repli si vous bloquez : lancez les trois à la main (MySQL local,
`mvnw spring-boot:run`, `npm start`) pour ne pas rester à l'arrêt, et revenez à
Docker ensuite. Mais notez que le repli n'est pas le rendu attendu.

Quand ça tourne, créez le premier compte administrateur — voir la
[section 5 du README](README.md#5-créer-le-premier-compte). Sans lui, vous ne
pouvez rien faire dans l'interface.

### 10h45 — Parcourir un CRUD de bout en bout

On prend la **création d'un livre** et on la suit du clic jusqu'à l'`INSERT`.

Le trajet complet, couche par couche, est détaillé dans la
[section 6 du README](README.md#6-le-trajet-dune-donnée--du-clic-à-la-base).
Ne le lisez pas : **exécutez-le**, un fichier ouvert à la fois.

Trois observations à faire, avec preuve à l'appui :

* **Dans le navigateur** : onglet *Réseau* des DevTools. Repérez le POST, son
  corps JSON, et l'en-tête `Authorization`. Qui a ajouté cet en-tête ? Vous ne
  l'avez écrit dans aucun composant.
* **Dans la console du backend** : `spring.jpa.show-sql=true` est actif. Vous
  devez voir passer l'`INSERT` généré par Hibernate.
* **Dans la base** : `SELECT * FROM books;` confirme la ligne. Le trajet est
  bouclé.

Puis on casse les choses volontairement, pour comprendre qui protège quoi :

| Manipulation | Résultat attendu | Qui a réagi ? |
|---|---|---|
| Vider `localStorage` puis recharger | Redirection vers `/login` | `auth.guard.ts` |
| Appeler `POST /admin/books` en curl **sans** token | 401 | `JwtAuthenticationEntryPoint` |
| Se connecter comme `User` puis aller sur `/books` | Page *forbidden* | `auth.guard.ts` côté front, `@PreAuthorize` côté back |

Cette dernière ligne est importante : la protection existe **en double**, côté
client et côté serveur. Sachez expliquer pourquoi le contrôle côté navigateur ne
suffira jamais.

### 11h30 — Rappel Git

Le cycle complet est dans la [section 8 du README](README.md#8-rappel-git).

On le refait ensemble une fois, puis chacun le rejoue seul :

```bash
git switch -c feat/mon-sujet
# ... modifications ...
git status
git diff
git add <fichiers>
git commit -m "feat: ..."
git push -u origin feat/mon-sujet
# puis Pull Request sur GitHub
```

Les erreurs qu'on veut ne plus voir :

* `git add .` alors que `node_modules/` ou `target/` traînent dans `git status`.
* Un commit intitulé « update », « fix » ou « wip ».
* Une PR sans description : le relecteur doit deviner ce qu'il relit.
* Un commit poussé directement sur `main`.

---

## Ce qui est évalué

L'épreuve est dans [EPREUVE-SEANCE-1.md](EPREUVE-SEANCE-1.md). Elle est
pratique : elle se rend sous forme d'une **branche poussée** et d'une **Pull
Request**. Lisez-la dès 8h30, pas à 11h30 — plusieurs points se collectent au
fil de la matinée.
