# Komolu

Un espace de concentration personnalisable : minuterie, tâches, notes, galerie de fonds, ambiances et radio. Libre, local et sans compte.

![Komolu, ambiance Minimal](docs/screenshots/minimal.png)

**1.1.0-rc.2 — candidate en validation** · [Dernière archive publiée (rc.1)](https://github.com/raphplt/Komolu/releases/tag/v1.1.0-rc.1) · [Code source](https://github.com/raphplt/Komolu) · [Installation Docker](docs/self-hosting.md) · [Contribuer](CONTRIBUTING.md)

**[Ouvrir Komolu](https://raphplt.github.io/Komolu/)** — instance publique via GitHub Pages.

La livraison `1.0.0` couvrait les principaux modules, mais pas toute la profondeur ni les critères de sortie de la fiche V1. Cette candidate apporte les corrections détaillées dans l’audit ; elle ne clôt pas tous les critères V1. La bêta humaine demandée en J7 reste à réaliser. [Audit détaillé](docs/v1-audit.md) · [Plan de reprise](docs/v1-completion-plan.md).

## Un espace prêt à utiliser

- Trois décors originaux : **Minimal**, **Cozy** et **Deep Work**. Crée, duplique et renomme tes propres espaces.
- **Studio** : déplace, redimensionne et masque les widgets à la souris ou au clavier, avec résolution des chevauchements. Choisis un décor intégré, un fond uni, un dégradé ou un média local ; règle la palette indépendamment, le voile et l’horloge (format, fuseau, couleur, ombre).
- **Galerie de fonds** : paysages, intérieurs chaleureux et appartements anime, avec aperçus et filtres. Images servies par Komolu, sans service d’images tiers ; import personnel toujours disponible. [Catalogue et provenance](docs/wallpapers.md).
- **Radio** : Chillhop, Radio Swiss Classic, neoFM et Electronic Chillout. Lecture sur demande, arrêt et volume indépendants des ambiances ; aucune station ne démarre au chargement.
- **Minuterie** : 25/5, 50/10, durée libre ou séquence personnalisée ; pause, reprise, répétitions et son de fin facultatif. La session survit au rechargement.
- **Tâches, notes et pensées** : données personnelles communes à tous les espaces, sauvegardées dans ce navigateur.
- **Ambiances** : pluie, tonnerre, vent, feu, forêt, café et vagues enregistrés, avec bruit blanc/brun synthétiques. Mixeur, volumes, mixes propres à chaque espace et sons personnels. Les fichiers redistribuables et leurs attributions accompagnent l’application.
- **Focus** mémorisé par espace, commandes compactes, plein écran, mouvements réduits et raccourcis désactivables. L’interface privilégie les libellés utiles.
- **Sauvegarde complète** et **partage d'espace** : deux exports distincts ; un espace partagé n'emporte ni tâches, ni notes, ni pensées, ni médias personnels.

[Galerie](docs/screenshots/gallery.png) · [Fond anime](docs/screenshots/anime.png) · [Radio sur mobile](docs/screenshots/radio-mobile.png) · [Cozy](docs/screenshots/cozy.png) · [Deep Work](docs/screenshots/deep.png) · [Studio](docs/screenshots/studio.png) · [Focus](docs/screenshots/focus.png) · [Mobile](docs/screenshots/mobile.png)

## Démarrer en développement

Node **24.21.0** (voir `.nvmrc`) et npm. Depuis le dépôt :

```bash
nvm use
npm ci --include=dev
npm run dev
```

Ouvre [localhost:5173](http://localhost:5173). `nvm` est facultatif si Node 24 est déjà installé. Le serveur de développement écoute sur toutes les interfaces ; utilise `npm run dev -- --host 127.0.0.1` pour le limiter à ta machine.

| Commande                                  | Usage                                 |
| ----------------------------------------- | ------------------------------------- |
| `npm run dev`                             | Développement avec rechargement       |
| `npm run build`                           | TypeScript + production dans `dist/`  |
| `npm run preview`                         | Prévisualisation locale du build      |
| `npm run lint` / `npm run typecheck`      | Analyse statique                      |
| `npm run format` / `npm run format:check` | Mise en forme / vérification Prettier |
| `npm test`                                | Tests unitaires                       |
| `npm run test:e2e`                        | Parcours Chromium et Firefox          |
| `npm run test:e2e:ui`                     | Explorateur Playwright                |

Avant les tests navigateur : `npx playwright install --with-deps chromium firefox`. Les détails et limites sont dans [docs/testing.md](docs/testing.md).

## Auto-héberger

Avec Docker et Docker Compose :

```bash
docker compose up --build --detach --wait
```

Ouvre [127.0.0.1:8080](http://127.0.0.1:8080). Aucun compte, base de données ou volume utilisateur à configurer : le conteneur sert uniquement les fichiers statiques. Pour l'exposer sur Internet, place un reverse proxy HTTPS devant ce port. [Guide complet](docs/self-hosting.md).

## Tes données restent dans ton navigateur

Komolu ne contient ni analytics ni télémétrie. Les fonds et ambiances intégrés viennent du même hébergement que l’application. La radio est facultative : cliquer sur Écouter contacte la station et son hébergeur, qui reçoivent les informations habituelles d’une connexion HTTP (dont l’adresse IP). Elle nécessite Internet et peut diffuser des publicités. L'hébergeur sert les fichiers et peut disposer de journaux HTTP ordinaires ; tes notes et médias ne lui sont pas envoyés. IndexedDB conserve les données par **origine** (protocole + hôte + port) et profil de navigateur. Changer d'instance, de navigateur ou de port crée un autre stockage. Effacer les données du navigateur peut tout supprimer.

**Télécharge régulièrement une sauvegarde** depuis Préférences → Sauvegarde et données. Le fichier JSON contient données et médias, n'est pas chiffré et peut devenir volumineux (base64). Limites : 50 Mio par média, 150 Mio de médias au total, 220 Mio par fichier d'import ; sons personnels limités à 120 secondes et 2 canaux. Les détails de validation, fusion et remplacement sont dans [Portabilité](docs/portability.md) et [Médias](docs/media.md).

Raccourcis hors champ de saisie : **Espace** démarre/met en pause, **N** capture une pensée, **F** bascule Focus, **Échap** ferme un panneau. Ils se désactivent dans Préférences.

## Périmètre et suite

Cette candidate est une application statique en français. Les imports et le stockage passent au schéma 2 avec migration des données 1.0.0 ; exporte une sauvegarde avant de mettre à jour une installation existante. PWA et installation hors ligne, synchronisation entre appareils, salles de coworking, chat, voix et configuration de marque à l'exécution sont reportés. Aucun backend n'est anticipé. Les tests automatisés ne remplacent pas une bêta humaine ; Safari/iOS, les lecteurs d’écran et l’écoute réelle des ambiances restent à valider.

Le poster vidéo dédié, la centralisation complète du registre de widgets et des points de documentation/gouvernance restent également ouverts : ADR individuels, backlog d’issues, démo vidéo et protection de branche. L’[audit](docs/v1-audit.md) conserve la matrice des écarts. Les résultats techniques vérifiés et leurs limites figurent dans [Vérification](docs/testing.md).

[Architecture](docs/architecture.md) · [Plan de livraison](IMPLEMENTATION_PLAN.md) · [Changelog](CHANGELOG.md) · [Fiche de vision originale](docs/product.md)

## Licence

[MIT](LICENSE), © 2026 Komolu contributors. [Licences des ressources](ASSETS_LICENSES.md) et [notices des dépendances](public/THIRD_PARTY_NOTICES.txt). Komolu est un nom de travail ; sa disponibilité juridique n'est pas garantie.
