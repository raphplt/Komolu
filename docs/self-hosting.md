# Auto-hébergement

Komolu est un site statique. La version `1.1.0-rc.2` est une candidate de reprise de la V1, en validation. Les données personnelles vivent dans IndexedDB sur le navigateur de chaque utilisateur. Sauvegarder le conteneur ne sauvegarde donc aucune tâche, note ou média utilisateur.

## Docker Compose

Prérequis : Docker Engine et Docker Compose récents, connexion Internet pour télécharger les images et dépendances au premier build.

```bash
git clone https://github.com/raphplt/Komolu.git
cd Komolu
docker compose up --build --detach --wait
docker compose ps
```

L'application répond sur [http://127.0.0.1:8080](http://127.0.0.1:8080). Le service est limité à la boucle locale par défaut. Si le port est déjà occupé, change uniquement le port hôte dans `compose.yaml`, par exemple `127.0.0.1:8081:8080`. Cette nouvelle origine possède un autre stockage : utilise export/import pour déplacer les données.

Le build utilise Node 24.21.0 et `npm ci --include=dev`, puis copie `dist/` dans Nginx 1.30.5. Les images sont épinglées par digest dans le Dockerfile pour figer leurs contenus ; leurs mises à jour de sécurité doivent être examinées puis leurs digests renouvelés. La bibliothèque npm est figée par `package-lock.json`.

Le conteneur final tourne sous l'utilisateur `nginx`, sans privilèges supplémentaires, système de fichiers en lecture seule et espace temporaire en mémoire de 16 Mio. Aucun volume de données ni secret nécessaire. Le contrôle de santé vérifie la page toutes les 30 secondes. Les logs HTTP sont disponibles avec `docker compose logs --tail 100`.

```bash
# Après mise à jour des sources
git pull --ff-only
docker compose up --build --detach --wait

# Arrêter cette installation
docker compose down
```

Le conteneur ne stocke pas les données personnelles. Lors de la prochaine ouverture, l’application peut toutefois migrer les données du navigateur : cette candidate passe du schéma 1 au schéma 2. Télécharge une sauvegarde avant la mise à jour. Revenir au tag 1.0.0 ne rétrograde pas IndexedDB : utilise une origine distincte et une sauvegarde version 1 pour tester cette ancienne version. [Migration et compatibilité](portability.md).

## Salles de coworking (V2 facultative)

Le service de salles en temps réel est optionnel (ADR-007). Pour l’activer sur votre instance Docker :

```bash
docker compose --profile rooms up --build --detach --wait
```

Le service démarre sur le port `8787` (`127.0.0.1:8787:8787`).
Le fichier de configuration client `komolu.json` (situé à la racine de la distribution statique) permet d'activer la collaboration et de pointer vers le service :

```json
{
  "collaboration": {
    "enabled": true,
    "url": "rooms"
  }
}
```

Variables d’environnement configurables pour le service `rooms` :

- `PORT` (défaut : `8787`)
- `HOST` (défaut : `0.0.0.0`)
- `KOMOLU_MAX_ROOMS` (défaut : `500`)
- `KOMOLU_MAX_MEMBERS` (défaut : `16`)
- `KOMOLU_ROOMS_PER_HOUR` (défaut : `10` créations par heure par adresse IP)
- `KOMOLU_ALLOWED_ORIGINS` (liste d’origines autorisées séparées par des virgules, ex: `https://komolu.mon-domaine.fr`)
- `KOMOLU_TRUST_PROXY` (`true` si placé derrière un reverse proxy de confiance)

Le service est conçu sans état persistant : aucun message, pseudonyme ou adresse n’est écrit sur disque ni conservé dans les journaux. Dès qu'une salle se vide, elle est immédiatement oubliée.

## Exposer sur Internet

HTTPS est nécessaire hors localhost (notamment pour `crypto.randomUUID` et le presse-papiers) : une URL HTTP sur une adresse LAN ne constitue pas une installation prise en charge. Utilise un domaine et un reverse proxy HTTPS devant `127.0.0.1:8080`. Le proxy doit pouvoir joindre la boucle locale de l'hôte ; un proxy lui-même conteneurisé doit plutôt partager un réseau Docker avec Komolu et joindre son port interne 8080. Ne publie pas le serveur de développement Vite en production.

Nginx fournit une CSP, `nosniff`, `Referrer-Policy: no-referrer` et refuse l'affichage en iframe. Les styles inline sont autorisés pour les réglages React ; les médias `blob:` locaux sont autorisés. `media-src` autorise également les hôtes des quatre radios et leurs relais ; aucun domaine radio n’est autorisé pour les scripts ou requêtes applicatives. Une station qui change d’hôte de diffusion peut nécessiter une mise à jour de cette liste. Les fichiers versionnés sous `/assets/` sont mis en cache pour un an ; le HTML et les notices demandent une revalidation. Le HTTPS/HSTS se configure au niveau du reverse proxy. GitHub Pages n'utilise pas ce Nginx et ne reçoit donc pas ces en-têtes personnalisés.

## Hébergement statique et sous-chemin

```bash
npm ci --include=dev
npm run build
```

Sers **le contenu de `dist/`** par HTTP(S), pas le dépôt source et pas `file://`. La base Vite `./` rend les assets relatifs : la racine ou un sous-chemin comme `/Komolu/` fonctionnent. Garde la barre oblique finale du répertoire. L'application n'utilise pas de routes client nécessitant une réécriture SPA ; les fichiers absents peuvent répondre 404.

Le ZIP de release statique contient les mêmes fichiers, y compris le répertoire `audio/` et ses attributions. Garde ce répertoire : les sept enregistrements sont chargés à la demande sur la même origine. Il ne contient pas de données personnelles. `npm run preview` permet une vérification locale mais n'est pas destiné à être le serveur de production.

## GitHub Pages

Le workflow `.github/workflows/ci.yml` contrôle le format, ESLint, TypeScript, les unités et les parcours Chromium/Firefox ; il reconstruit Docker et rejoue les parcours contre Nginx. Les pull requests exécutent ces contrôles sans publier. Seuls un push sur `main` ou une exécution manuelle sur `main` peuvent publier après réussite.

Avant la première publication, un administrateur doit choisir **Settings → Pages → Source: GitHub Actions**. Le job `deploy` utilise l'environnement `github-pages` et seul ce job dispose de `pages: write` et `id-token: write`. Les actions sont épinglées à un commit. L'instance [https://raphplt.github.io/Komolu/](https://raphplt.github.io/Komolu/) est publiée depuis le 13 octobre 2026. Après chaque mise à jour, vérifier son accès et une session réelle.

Référence : [Vite — déploiement statique](https://vite.dev/guide/static-deploy), consultée le 13 octobre 2026.

## Limites

Il n'existe ni API de santé des données, ni restauration côté serveur, ni synchronisation. La minuterie et les données d’une application déjà chargée peuvent continuer sans réseau, mais aucun service worker ne garantit un nouveau chargement hors ligne. Un enregistrement audio qui n’a pas encore été chargé peut rester indisponible sans réseau ; les bruits synthétiques et médias personnels déjà accessibles restent locaux. La radio demande une connexion continue à une station externe. Le mode privé du navigateur peut effacer son stockage en fin de session. Les réglages et médias restent propres à chaque origine.
