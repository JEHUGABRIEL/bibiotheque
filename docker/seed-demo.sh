#!/usr/bin/env bash
#
# Jeu de données de démonstration — module Réservation (Séance 4).
#
# Crée le nécessaire pour la soutenance de 8 minutes :
#   - 2 comptes ADHERENT distincts + 1 compte BIBLIOTHECAIRE
#   - un catalogue mixte : livres AVEC exemplaires (emprunt) et livres à
#     0 exemplaire (réservation — RG-01 interdit de réserver un livre dispo)
#   - au moins une réservation par adhérent, dont une acceptée par le
#     personnel, plus une réservation créée par le personnel au nom d'un
#     adhérent (RS-04 / newBookName)
#
# Tout passe par l'API : les mots de passe sont encodés par l'application
# (BCrypt) et les règles métier (RG-01, RG-03, doublons) sont appliquées.
#
# IDEMPOTENT : relancé, le script ne recrée pas ce qui existe déjà.
#
# Prérequis
#   1. la base tourne :        docker compose up -d db
#   2. le backend tourne :     ./mvnw spring-boot:run   (voir knowledge.md)
#   3. un compte Admin existe : (README §5, admin / admin123)
#
# Usage
#   ./docker/seed-demo.sh
#   ./docker/seed-demo.sh http://localhost:9090
#   ADMIN_USER=root ADMIN_PASSWORD=secret ./docker/seed-demo.sh
#
set -euo pipefail

API="${1:-http://localhost:8080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

command -v curl >/dev/null || { echo "curl est requis" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq est requis (sudo apt install jq)" >&2; exit 1; }

# --- comptes de démonstration -----------------------------------------
A1_USER="adherent1"; A1_NAME="Awa Ndiaye";       A1_PASS="adherent123"
A2_USER="adherent2"; A2_NAME="Moussa Diallo";    A2_PASS="adherent123"
B1_USER="biblio1";   B1_NAME="Claire Fontaine";  B1_PASS="biblio123"

# --- catalogue ---------------------------------------------------------
# « copies » > 0  -> empruntable ; = 0 -> réservable (et libre pour une démo live)
BOOKS=(
  "L'Étranger|Albert Camus|Roman|3"
  "Le Petit Prince|Antoine de Saint-Exupéry|Conte|2"
  "Une si longue lettre|Mariama Bâ|Roman|1"
  "Les Misérables|Victor Hugo|Roman|0"
  "L'Aventure ambiguë|Cheikh Hamidou Kane|Roman|0"
  "Le Vieux Nègre et la Médaille|Ferdinand Oyono|Roman|0"
)

RES_BOOK_1="Les Misérables"           # réservé par adhérent 1, puis accepté
RES_BOOK_2="L'Aventure ambiguë"       # réservé par adhérent 2, laissé DEMANDE
RES_NEW_BOOK="Voyage au bout de la nuit"  # créé à la volée par le personnel

# --- helpers -----------------------------------------------------------

# req JETON MÉTHODE CHEMIN [CORPS_JSON]  ->  "<corps>\n<code_http>"
# Un jeton vide = requête anonyme : on n'envoie alors AUCUN en-tête
# Authorization (sinon on teste un « Bearer » vide, pas l'absence de jeton).
req() {
  local token="$1" method="$2" path="$3" body="${4:-}"
  local -a auth=()
  [ -n "$token" ] && auth=(-H "Authorization: Bearer $token")
  if [ -n "$body" ]; then
    curl -sS -w $'\n%{http_code}' -X "$method" "$API$path" \
      -H 'Content-Type: application/json' "${auth[@]}" -d "$body"
  else
    curl -sS -w $'\n%{http_code}' -X "$method" "$API$path" "${auth[@]}"
  fi
}

# Découpe la sortie de req() en variables globales BODY / STATUS
split_response() {
  STATUS="${1##*$'\n'}"
  BODY="${1%$'\n'*}"
}

# login UTILISATEUR MOT_DE_PASSE -> jeton JWT (vide si échec)
login() {
  curl -sS -X POST "$API/authenticate" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg u "$1" --arg p "$2" '{username:$u,password:$p}')" \
    | jq -r '.jwtToken // empty'
}

ensure_user() { # utilisateur nom mot_de_passe rôle
  local username="$1" name="$2" password="$3" role="$4"
  split_response "$(req "$TOKEN_ADMIN" POST /admin/users \
    "$(jq -nc --arg u "$username" --arg n "$name" --arg p "$password" --arg r "$role" \
      '{username:$u,name:$n,password:$p,role:[{roleName:$r}]}')")"
  case "$STATUS" in
    200) echo "   + $role   $username (mot de passe : $password)" ;;
    400) echo "   = $username existe déjà" ;;
    *)   echo "   ! $username : HTTP $STATUS — $BODY" >&2 ;;
  esac
}

ensure_book() { # titre auteur genre exemplaires
  local title="$1" author="$2" genre="$3" copies="$4"
  split_response "$(req "$TOKEN_ADMIN" POST /admin/books \
    "$(jq -nc --arg t "$title" --arg a "$author" --arg g "$genre" --argjson c "$copies" \
      '{bookName:$t,bookAuthor:$a,bookGenre:$g,noOfCopies:$c}')")"
  case "$STATUS" in
    200) echo "   + $title ($copies exemplaire(s))" ;;
    400) echo "   = $title existe déjà" ;;
    *)   echo "   ! $title : HTTP $STATUS — $BODY" >&2 ;;
  esac
}

book_id() { # titre -> id (vide si absent)
  curl -sS "$API/admin/books" -H "Authorization: Bearer $TOKEN_ADMIN" \
    | jq -r --arg t "$1" '[.[] | select(.bookName==$t)][0].bookId // empty'
}

# "id statut" de la réservation active d'un livre (vide si aucune)
reservation_of_book() { # id_livre
  curl -sS "$API/api/reservations" -H "Authorization: Bearer $TOKEN_BIBLIO" \
    | jq -r --argjson b "$1" \
        '[.[] | select(.bookId==$b and (.statut=="DEMANDE" or .statut=="EN_ATTENTE" or .statut=="DISPONIBLE"))]
         | .[0] | if . then "\(.id) \(.statut)" else empty end'
}

create_reservation() { # jeton payload description
  split_response "$(req "$1" POST /api/reservations "$2")"
  case "$STATUS" in
    201) echo "   + $3 → réservation id $(printf '%s' "$BODY" | jq -r .id) ($(printf '%s' "$BODY" | jq -r .statut))" ;;
    409) echo "   = $3 : une réservation active existe déjà pour ce livre" ;;
    *)   echo "   ! $3 : HTTP $STATUS — $BODY" >&2 ;;
  esac
}

# Crée la réservation d'un livre si elle n'existe pas, puis l'accepte si demandé
ensure_reservation() { # id_livre jeton payload description statut_voulu
  local bookId="$1" token="$2" payload="$3" label="$4" target="${5:-}"
  local existing
  existing="$(reservation_of_book "$bookId")"
  if [ -z "$existing" ]; then
    create_reservation "$token" "$payload" "$label"
    existing="$(reservation_of_book "$bookId")"
  else
    echo "   = $label existe déjà"
  fi
  [ -z "$existing" ] && return 0
  [ "$target" != "EN_ATTENTE" ] && return 0
  local id="${existing%% *}" statut="${existing##* }"
  if [ "$statut" = "DEMANDE" ]; then
    split_response "$(req "$TOKEN_BIBLIO" PATCH "/api/reservations/$id/accepter")"
    if [ "$STATUS" = "200" ]; then
      echo "   ^ réservation $id acceptée par $B1_USER (DEMANDE → EN_ATTENTE)"
    else
      echo "   ! acceptation de $id : HTTP $STATUS — $BODY" >&2
    fi
  fi
}

# --- exécution ---------------------------------------------------------

echo "Cible : $API"
echo

echo "1. Authentification de l'admin ($ADMIN_USER)"
TOKEN_ADMIN="$(login "$ADMIN_USER" "$ADMIN_PASSWORD")"
if [ -z "$TOKEN_ADMIN" ]; then
  cat >&2 <<'EOM'
   ! Échec : impossible de s'authentifier en tant qu'admin.
     - le backend tourne-t-il sur cette adresse ?
     - le compte admin existe-t-il (README §5) ?
     - ADMIN_USER / ADMIN_PASSWORD sont-ils les bons ?
EOM
  exit 1
fi
echo "   ok"

echo
echo "2. Comptes de démonstration"
ensure_user "$A1_USER" "$A1_NAME" "$A1_PASS" ADHERENT
ensure_user "$A2_USER" "$A2_NAME" "$A2_PASS" ADHERENT
ensure_user "$B1_USER" "$B1_NAME" "$B1_PASS" BIBLIOTHECAIRE

echo
echo "3. Jetons des comptes créés"
TOKEN_A1="$(login "$A1_USER" "$A1_PASS")"
TOKEN_A2="$(login "$A2_USER" "$A2_PASS")"
TOKEN_BIBLIO="$(login "$B1_USER" "$B1_PASS")"
for pair in "TOKEN_A1:$A1_USER" "TOKEN_A2:$A2_USER" "TOKEN_BIBLIO:$B1_USER"; do
  var="${pair%%:*}"; who="${pair##*:}"
  [ -n "${!var}" ] || { echo "   ! $who : connexion impossible" >&2; exit 1; }
  echo "   ok  $who"
done

echo
echo "4. Catalogue"
for entry in "${BOOKS[@]}"; do
  IFS='|' read -r title author genre copies <<<"$entry"
  ensure_book "$title" "$author" "$genre" "$copies"
done

echo
echo "5. Réservations"
ID_RES1="$(book_id "$RES_BOOK_1")"
ID_RES2="$(book_id "$RES_BOOK_2")"
ensure_reservation "$ID_RES1" "$TOKEN_A1" \
  "$(jq -nc --argjson b "$ID_RES1" '{bookId:$b}')" \
  "$A1_USER réserve « $RES_BOOK_1 »" EN_ATTENTE
ensure_reservation "$ID_RES2" "$TOKEN_A2" \
  "$(jq -nc --argjson b "$ID_RES2" '{bookId:$b}')" \
  "$A2_USER réserve « $RES_BOOK_2 »"
ID_NEW="$(book_id "$RES_NEW_BOOK")"
ID_A2="$(curl -sS "$API/admin/users" -H "Authorization: Bearer $TOKEN_ADMIN" \
          | jq -r --arg u "$A2_USER" '[.[] | select(.username==$u)][0].userId')"
if [ -z "$ID_NEW" ]; then
  create_reservation "$TOKEN_BIBLIO" \
    "$(jq -nc --arg n "$RES_NEW_BOOK" --argjson u "$ID_A2" '{newBookName:$n,userId:$u}')" \
    "$B1_USER réserve un livre inconnu « $RES_NEW_BOOK » pour $A2_USER"
else
  echo "   = « $RES_NEW_BOOK » existe déjà"
fi

echo
echo "6. Vérification des droits (doit échouer proprement)"
check_code() { # attendu description jeton méthode chemin
  split_response "$(req "$3" "$4" "$5")"
  if [ "$STATUS" = "$1" ]; then echo "   ok  HTTP $STATUS — $2"; else echo "   ! HTTP $STATUS au lieu de $1 — $2" >&2; fi
}
check_code 401 "sans jeton"            ""             GET   /api/reservations
check_code 200 "$A1_USER (ses réservations)" "$TOKEN_A1" GET /api/reservations
check_code 200 "$B1_USER (toutes)"     "$TOKEN_BIBLIO" GET /api/reservations
RES_A2="$(reservation_of_book "$ID_RES2")"
if [ -n "$RES_A2" ]; then
  check_code 403 "RS-03 : $A1_USER sur la réservation ${RES_A2%% *} de $A2_USER" \
    "$TOKEN_A1" GET "/api/reservations/${RES_A2%% *}"
  check_code 403 "RS-02 : $A1_USER tente une action du personnel" \
    "$TOKEN_A1" DELETE "/api/reservations/${RES_A2%% *}"
else
  echo "   ! réservation de $A2_USER introuvable" >&2
fi

echo
echo "Données de démonstration en place. Identifiants à présenter :"
printf '   %-12s %-15s %s\n' "COMPTE" "MOT DE PASSE" "RÔLE"
printf '   %-12s %-15s %s\n' "$ADMIN_USER" "$ADMIN_PASSWORD" "Admin (tout)"
printf '   %-12s %-15s %s\n' "$A1_USER" "$A1_PASS" "ADHERENT"
printf '   %-12s %-15s %s\n' "$A2_USER" "$A2_PASS" "ADHERENT"
printf '   %-12s %-15s %s\n' "$B1_USER" "$B1_PASS" "BIBLIOTHECAIRE"
echo
echo "À raconter devant le formateur :"
echo "   - $A1_USER a une réservation EN_ATTENTE sur « $RES_BOOK_1 » (acceptée par $B1_USER)."
echo "   - $A2_USER a une DEMANDE sur « $RES_BOOK_2 » : $B1_USER peut l'accepter en direct."
echo "   - « $RES_NEW_BOOK » n'existait pas : $B1_USER l'a créé en réservant (newBookName)."
echo "   - RS-03 : connecté en $A1_USER, ouvrir la réservation de $A2_USER → 403."
echo "   - RS-01 : sans jeton, curl $API/api/reservations → 401."
echo "   - RS-04 : dans le corps POST /api/reservations, ajouter \"userId\":1 en tant"
echo "     qu'ADHERENT ne change rien — l'identité vient du token."
echo "   - « Le Vieux Nègre et la Médaille » (0 exemplaire) reste libre pour une démo live."
