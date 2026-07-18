# Frontend LiveTalk

Ce dossier contient le frontend React + Vite de LiveTalk.

## Déploiement sur Vercel

1. **Pousser le code sur GitHub**

   Assurez-vous que le frontend est dans un dépôt accessible à Vercel (monorepo ou dépôt dédié).

2. **Importer le projet dans Vercel**

   - Connectez-vous à [vercel.com](https://vercel.com).
   - Cliquez sur **Add New Project**.
   - Sélectionnez le dépôt GitHub contenant le frontend.
   - Si votre frontend est dans un sous-dossier (`frontend/`), définissez le **Root Directory** sur `frontend`.

3. **Configurer les variables d'environnement**

   Dans l'onglet **Settings > Environment Variables** du projet Vercel, ajoutez :

   ```
   VITE_SOCKET_URL=<URL du backend Render une fois déployé>
   VITE_TURN_URL=turn:<IP publique du VPS TURN>:3478
   VITE_TURN_USERNAME=<utilisateur TURN>
   VITE_TURN_CREDENTIAL=<mot de passe TURN>
   ```

   Les valeurs TURN (`VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`) doivent correspondre à celles configurées dans `livetalk-turn/turnserver.conf`.

4. **Configurer le build**

   Vercel détecte automatiquement Vite. Les paramètres par défaut sont généralement suffisants :

   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
   - **Framework Preset** : Vite

   Si besoin, le fichier `vercel.json` à la racine du frontend forçe ces valeurs et redirige toutes les routes vers `index.html` pour une SPA.

5. **Déployer**

   - Vercel déclenche automatiquement un déploiement à chaque `push` sur la branche principale.
   - Récupérez l'URL du déploiement (ex. `https://livetalk-frontend.vercel.app`).

6. **Brancher le frontend sur le backend**

   Mettez à jour la variable d'environnement `FRONTEND_URL` du backend Render avec l'URL Vercel, puis redéployez le backend si nécessaire pour que la restriction CORS soit appliquée.
