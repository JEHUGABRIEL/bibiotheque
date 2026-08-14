# ============================================================
# Étape 1 — Build Angular 14
#
# Node 18 : dernière version officiellement supportée par Angular 14
# (le README note que Node 22 build mais avec un warning "Unsupported").
# Pas de package-lock.json dans le dépôt → npm install, pas npm ci.
# ============================================================
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# ============================================================
# Étape 2 — Serveur statique
#
# nginx sert le build de prod. Le frontend appelle http://localhost:8080 :
# ce code s'exécute dans le navigateur (sur la machine de l'utilisateur),
# donc "localhost" = l'hôte, où le backend est publié sur le port 8080.
# ============================================================
FROM nginx:alpine
COPY --from=build /app/dist/bibliotheque-frontend /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
