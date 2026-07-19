# Backend LiveTalk

API Node.js / Express / Socket.IO du projet LiveTalk. Elle s'appuie sur une base PostgreSQL.

## Variables d'environnement

Copiez `.env.example` en `.env` et renseignez les valeurs réelles :

```env
PORT=3001
DATABASE_URL=postgres://user:password@host:5432/database
FRONTEND_URL=https://your-frontend-url.vercel.app
NODE_ENV=development
JWT_SECRET=une-chaine-aleatoire-tres-longue
ADMIN_PASSWORD_HASH=$2b$10$...
```

- `PORT` : port d'écoute. Sur Render, il est fourni automatiquement ; en local, `3001` par défaut.
- `DATABASE_URL` : connection string PostgreSQL.
- `FRONTEND_URL` : URL du frontend, utilisée pour restreindre le CORS. Laissez-la vide ou non définie en local pour conserver `origin: "*"`.
- `NODE_ENV` : `development` en local, `production` sur Render.
- `JWT_SECRET` : chaîne aléatoire longue pour signer les tokens admin.
- `ADMIN_PASSWORD_HASH` : hash bcrypt du mot de passe admin (voir ci-dessous).

Pour générer le hash admin une seule fois :

```bash
node -e "console.log(require('bcrypt').hashSync('TON_MOT_DE_PASSE', 10))"
```

Ne stockez jamais le mot de passe en clair dans le code ou les variables d'environnement.

## Base de données PostgreSQL sur Neon

### 1. Créer un projet Neon

1. Rendez-vous sur [neon.tech](https://neon.tech) et créez un compte.
2. Créez un nouveau projet nommé par exemple `livetalk`.
3. Choisissez une région proche de votre zone cible (Europe recommandée pour l'Afrique de l'Ouest).

### 2. Récupérer la connection string

1. Dans le dashboard Neon, allez dans **Connection Details**.
2. Sélectionnez la base `neondb` (ou le nom que vous avez choisi).
3. Copiez la **connection string** (par exemple `postgres://user:password@host.neon.tech/database?sslmode=require`).

### 3. Exécuter les migrations

Depuis le dossier `backend` :

```bash
# Installez les dépendances si ce n'est pas déjà fait
npm install

# Appliquez les migrations
npm run migrate
```

`migrate.js` exécute automatiquement tous les fichiers `.sql` du dossier `migrations/` dans l'ordre alphabétique.

> **Connexion SSL :** `db.js` active automatiquement `ssl: { rejectUnauthorized: false }` lorsque la connection string contient `neon.tech` ou que `NODE_ENV=production`. Cela est nécessaire pour se connecter à Neon.

## Déploiement sur Render

### Méthode via Blueprint (`render.yaml`)

Le fichier `render.yaml` à la racine du backend définit le service Render.

```yaml
services:
  - type: web
    name: livetalk-api
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: FRONTEND_URL
        sync: false
```

> **Monorepo :** si le backend se trouve dans un sous-dossier (`backend/`) au sein d'un dépôt plus grand, déplacez `render.yaml` à la racine du dépôt et ajoutez `rootDir: backend` au service.

### Méthode manuelle

1. Créez un **Web Service** sur Render.
2. Choisissez l'environnement **Node**.
3. Définissez :
   - **Build command** : `npm install`
   - **Start command** : `npm start`
4. Renseignez les variables d'environnement dans le dashboard :
   - `DATABASE_URL` (voir la connection string Neon)
   - `FRONTEND_URL` (URL du frontend Vercel, ex. `https://livetalk-frontend.vercel.app`)
   - `PORT` est géré automatiquement par Render ; aucune action requise.
5. Déployez. La route `GET /health` renvoie `{ status: "ok" }` et permet de vérifier que le service est démarré.

## Scripts utiles

```bash
npm run dev      # démarrage en développement avec nodemon
npm start        # démarrage en production
npm run migrate  # exécute toutes les migrations dans migrations/
```
