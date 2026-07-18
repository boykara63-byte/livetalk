# Serveur TURN LiveTalk (coturn)

Ce dossier contient la configuration prête à l'emploi pour déployer un serveur TURN coturn sur un VPS, afin d'améliorer la connectivité WebRTC sur les réseaux mobiles (NAT, pare-feu).

> **Note :** ce serveur n'est pas déployé automatiquement. Les étapes ci-dessous doivent être exécutées manuellement sur un VPS.

## Choix du VPS

- Hébergeurs recommandés : **Contabo** ou **OVH**.
- Région recommandée : **Europe** (Frankfurt, Paris, Amsterdam). L'Europe reste la zone géographique la plus proche et offrant les meilleures latences pour l'Afrique de l'Ouest compte tenu des options VPS abordables disponibles.
- Assurez-vous que le forfait inclut suffisamment de bande passante sortante pour relayer du trafic média UDP.

## Prérequis

- Un VPS sous Linux (Ubuntu 22.04/24.04 LTS recommandé).
- Docker et Docker Compose installés.

```bash
# Exemple d'installation rapide sur Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Déconnectez-vous puis reconnectez-vous pour que le groupe soit pris en compte.
docker compose version
```

## Déploiement

1. **Copier les fichiers sur le VPS**

   Copiez `docker-compose.yml` et `turnserver.conf` à la racine du dossier de déploiement, par exemple `/opt/livetalk-turn/` :

   ```bash
   mkdir -p /opt/livetalk-turn
   cd /opt/livetalk-turn
   # scp ou rsync depuis votre machine locale
   ```

2. **Configurer l'adresse publique du VPS**

   Remplacez `<YOUR_VPS_PUBLIC_IP>` dans `turnserver.conf` par l'IP publique du VPS :

   ```bash
   sed -i 's/<YOUR_VPS_PUBLIC_IP>/XX.XX.XX.XX/g' turnserver.conf
   ```

3. **Configurer les identifiants TURN**

   Remplacez `YOUR_TURN_USERNAME` et `YOUR_TURN_CREDENTIAL` par une valeur forte. Ces valeurs seront ensuite reportées dans les variables d'environnement du frontend (`VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`).

4. **Ouvrir les ports au pare-feu**

   | Port | Protocole | Description |
   |------|-----------|-------------|
   | 3478 | TCP / UDP | TURN standard |
   | 5349 | TCP / UDP | TURNS (TLS) |
   | 10000-20000 | UDP | Plage de relais média |

   Exemple avec `ufw` :

   ```bash
   sudo ufw allow 3478/tcp
   sudo ufw allow 3478/udp
   sudo ufw allow 5349/tcp
   sudo ufw allow 5349/udp
   sudo ufw allow 10000:20000/udp
   ```

   N'oubliez pas d'ouvrir ces ports également dans le pare-feu du fournisseur cloud (security group / firewall cloud).

5. **Démarrer le serveur**

   ```bash
   docker compose up -d
   ```

   Vérifier les logs :

   ```bash
   docker logs -f livetalk-turn
   ```

6. **(Optionnel) Activer TURNS avec des certificats TLS**

   Pour sécuriser le port 5349, placez vos certificats sur le VPS et décommentez/modifiez les lignes `cert` et `pkey` dans `turnserver.conf`, puis redémarrez :

   ```bash
   docker compose restart
   ```

## Intégration côté frontend

Une fois le serveur TURN déployé, configurez les variables d'environnement du frontend :

```env
VITE_TURN_URL=turn:<YOUR_VPS_PUBLIC_IP>:3478
VITE_TURN_USERNAME=YOUR_TURN_USERNAME
VITE_TURN_CREDENTIAL=YOUR_TURN_CREDENTIAL
```

Pour TURNS (TLS) :

```env
VITE_TURN_URL=turns:<YOUR_VPS_PUBLIC_IP>:5349
```
