# LiveTalk

Application de chat vidéo anonyme en WebRTC (backend Node.js / Socket.IO, frontend Vite / React, serveur TURN coturn).

Ce dépôt est prêt pour un déploiement multi-services :

- `backend/` : API Node.js (Render)
- `frontend/` : application Vite / React (Vercel)
- `livetalk-turn/` : serveur TURN coturn (VPS)

L'ordre de déploiement complet est décrit dans [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Base de données PostgreSQL (Neon)

1. Créez un projet sur [neon.tech](https://neon.tech).
2. Récupérez la **connection string** dans le dashboard.
3. Exécutez les migrations :

   ```bash
   cd backend
   npm install
   npm run migrate
   ```

La connexion SSL est activée automatiquement dans `backend/db.js` si la connection string contient `neon.tech` ou si `NODE_ENV=production`.

## Détection du pays par IP

Le pays de l'utilisateur est détecté automatiquement côté serveur avec `geoip-lite`, à partir de l'adresse IP du visiteur. Cela remplace la sélection manuelle précédente. En environnement local, ou si l'utilisateur utilise un VPN/proxy, la détection peut échouer et le pays sera enregistré comme non déterminé. C'est une aide pratique, pas une garantie absolue.

## Backend (Render)

Voir [`backend/README.md`](backend/README.md) pour la configuration détaillée.

Variables d'environnement à renseigner dans le dashboard Render :

- `DATABASE_URL` : connection string Neon
- `PORT` : géré automatiquement par Render
- `FRONTEND_URL` : URL du frontend Vercel (pour CORS)
- `NODE_ENV` : `production`
- `JWT_SECRET` : chaîne aléatoire longue pour signer les tokens admin
- `ADMIN_PASSWORD_HASH` : hash bcrypt du mot de passe admin

Générez `ADMIN_PASSWORD_HASH` une seule fois localement :

```bash
cd backend
node -e "console.log(require('bcrypt').hashSync('TON_MOT_DE_PASSE', 10))"
```

Copiez la chaîne obtenue dans la variable d'environnement Render. Ne stockez jamais le mot de passe en clair.

## Serveur TURN (VPS)

Voir [`livetalk-turn/README.md`](livetalk-turn/README.md) pour le déploiement coturn sur un VPS.

## Frontend (Vercel)

Voir [`frontend/README.md`](frontend/README.md) pour le déploiement Vercel.

Variables d'environnement Vercel :

- `VITE_SOCKET_URL` : URL du backend Render
- `VITE_TURN_URL` : `turn:<IP_TURN>:3478`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

## Variables d'environnement

Aucun secret de production n'est commité. Utilisez les fichiers `.env.example` et `.env.production` comme modèles, et renseignez les valeurs réelles dans les dashboards Render / Vercel / VPS.
