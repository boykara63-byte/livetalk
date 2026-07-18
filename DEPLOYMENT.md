# Guide de déploiement LiveTalk

Ce document résume l'ordre de déploiement complet en production / staging pour permettre des tests sur de vrais réseaux mobiles.

> **Important :** aucun secret ni valeur de production réelle ne doit être commité. Utilisez les placeholders fournis et renseignez les variables d'environnement directement dans les dashboards Render, Vercel et la configuration du VPS.

## 1. Base de données PostgreSQL sur Neon

1. Créez un projet sur [neon.tech](https://neon.tech).
2. Récupérez la **connection string** dans le dashboard Neon.
3. Exécutez les migrations depuis le dossier `backend` :

   ```bash
   cd backend
   npm install
   npm run migrate
   ```

4. Notez la connection string : elle sera utilisée comme `DATABASE_URL` sur Render.

## 2. Backend sur Render

1. Dans le dashboard Render, créez un **Web Service** Node.js pointant sur le dossier `backend`.
2. Définissez :
   - **Build command** : `npm install`
   - **Start command** : `npm start`
3. Renseignez les variables d'environnement :

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | Connection string Neon |
   | `FRONTEND_URL` | URL du frontend Vercel (ex. `https://livetalk-frontend.vercel.app`) |
   | `PORT` | Géré automatiquement par Render |
   | `NODE_ENV` | `production` |

4. Déployez. Vérifiez que le service répond avec `GET /health` :

   ```bash
   curl https://<livetalk-api>.onrender.com/health
   # { "status": "ok" }
   ```

5. Notez l'URL publique du backend : elle servira de `VITE_SOCKET_URL` pour le frontend.

## 3. Serveur TURN sur VPS

1. Louez un VPS chez **Contabo** ou **OVH** en région **Europe** (proche de l'Afrique de l'Ouest).
2. Installez Docker et Docker Compose.
3. Copiez sur le VPS :
   - `livetalk-turn/docker-compose.yml`
   - `livetalk-turn/turnserver.conf`
4. Remplacez dans `turnserver.conf` :
   - `<YOUR_VPS_PUBLIC_IP>` par l'IP publique du VPS.
   - `YOUR_TURN_USERNAME` et `YOUR_TURN_CREDENTIAL` par des valeurs fortes.
5. Ouvrez les ports dans le pare-feu cloud **et** sur le VPS :

   - `3478` TCP / UDP
   - `5349` TCP / UDP
   - `10000-20000` UDP (plage de relais)

6. Démarrez le serveur :

   ```bash
   docker compose up -d
   ```

7. Notez l'URL TURN, le nom d'utilisateur et le mot de passe pour le frontend :

   ```
   turn:<IP_PUBLIQUE_DU_VPS>:3478
   ```

## 4. Frontend sur Vercel

1. Poussez le code sur GitHub.
2. Importez le projet dans [vercel.com](https://vercel.com).
   - Si le frontend est dans un sous-dossier (`frontend/`), définissez le **Root Directory** sur `frontend`.
3. Configurez les variables d'environnement Vercel :

   | Variable | Description |
   |----------|-------------|
   | `VITE_SOCKET_URL` | URL du backend Render (étape 2) |
   | `VITE_TURN_URL` | `turn:<IP_PUBLIQUE_DU_VPS>:3478` (étape 3) |
   | `VITE_TURN_USERNAME` | Nom d'utilisateur TURN |
   | `VITE_TURN_CREDENTIAL` | Mot de passe TURN |

4. Vercel déclenche automatiquement un déploiement à chaque `push`.
5. Récupérez l'URL publique du frontend (ex. `https://livetalk-frontend.vercel.app`).
6. Mettez à jour la variable d'environnement `FRONTEND_URL` du backend Render avec cette URL, puis redéployez le backend si nécessaire pour appliquer la restriction CORS.

## Vérification finale

- `GET /health` sur Render répond `{ "status": "ok" }`.
- Le frontend se connecte au backend via Socket.IO.
- Les échanges WebRTC passent par le serveur TURN si la connexion directe échoue.
- Testez depuis un vrai réseau mobile (3G/4G/5G) pour valider le relais TURN.
