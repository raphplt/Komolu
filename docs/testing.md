# Vérification de la candidate V1

## Commandes reproductibles

Node 24.21.0 et les dépendances exactes du lockfile :

```bash
npm ci --include=dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium firefox
npm run test:e2e
```

Playwright démarre Vite sur le port 5173 (ou réutilise un serveur existant hors CI). Chaque scénario utilise un contexte isolé, sans profil utilisateur. Les navigateurs de test sont muets au niveau de leur sortie (Chromium `--mute-audio`, Firefox `media.volume_scale=0.0`) : les parcours audio continuent de fonctionner sans produire de son audible. Le script de captures lance également Chromium muet. Les traces et captures d'échec se trouvent dans `test-results/`, le rapport HTML dans `playwright-report/` ; ces répertoires sont ignorés par Git.

Pour vérifier la distribution réellement servie avec Nginx et ses en-têtes :

```bash
docker compose up --build --detach --wait
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

`PLAYWRIGHT_BASE_URL` désactive le lancement de Vite. La CI exécute les deux suites, développement puis production, avant de publier le build sur Pages. Le runner sans périphérique sonore démarre PulseAudio avec une sortie virtuelle `module-null-sink` : Firefox dispose ainsi d’une vraie sortie système pour Web Audio, sans remplacer les API audio par des mocks. Les traces et captures sont conservées sept jours si la CI échoue.

## Couverture

La livraison initiale `1.0.0` avait passé 88 tests unitaires et 26 scénarios navigateur sur Chromium et Firefox, soit 52 exécutions par cible. Ces résultats historiques ne prouvaient pas la réalisation complète de la fiche produit ; l’[audit](v1-audit.md) détaille les écarts.

La candidate `1.1.0-rc.1` ajoute notamment :

- migrations réelles de base et d’exports version 1, conservation des médias/données/session, validation des nouveaux champs et refus des versions inconnues ;
- collisions de widgets en cascade, manipulation au pointeur et au clavier, masquage/restauration et persistance des layouts ;
- fonds, palette indépendante, styles d’horloge, description facultative et Focus par espace ;
- session silencieuse sans périphérique audio, commandes de Focus quand le timer est masqué, catalogue et chargements audio ;
- vérifications complémentaires de responsive et zoom.

**Résultat final local du 13 octobre 2026 : 117 tests unitaires réussis ; 38 scénarios navigateur exécutés sur Chromium et Firefox, soit 76 exécutions en développement puis 76 sur le conteneur Nginx de production, toutes réussies sans retry.** Formatage, ESLint, TypeScript et build passent également. Les suites portent sur le code final de cette candidate, pas sur une addition de résultats partiels.

La [CI de publication](https://github.com/raphplt/Komolu/actions/workflows/ci.yml) rejoue les contrôles sur le commit poussé avant déploiement. Une vérification HTTP et navigateur sur l’URL publique reste distincte des résultats locaux.

Les parcours locaux de production surveillent erreurs JavaScript/console, violations de CSP et absence de requêtes extérieures à l’origine avant activation de la radio. Une vidéo WebM fictive locale est importée, lue muette, pausée avec la réduction des mouvements puis retrouvée après reload. Les images PNG et sons WAV sont également décodés par les navigateurs dans les parcours de portabilité. Les fixtures sont fabriquées pour les tests, sans données personnelles.

Les captures de `docs/screenshots/` montrent l'application réelle avec tâches et notes fictives dans un contexte jetable. Elles ne sont ni des maquettes, ni la capture du navigateur personnel d'un utilisateur.

## Limites de ces preuves

- Chromium et Firefox tournent sous Linux, sans interface visible. Safari, iOS, Android réel et politiques audio mobiles ne sont pas certifiés par ces résultats.
- Le contrôle axe ne remplace pas une lecture humaine ni un parcours avec lecteur d'écran. Une préférence système de mouvement est respectée, mais tous les handicaps et dispositifs ne sont pas couverts.
- Les générateurs de bruit, le chargement des enregistrements et les cycles Web Audio sont testés ; la qualité d'écoute, les fondus et les boucles n'ont pas été évalués à l'oreille par un humain.
- Les tests simulent la veille et les sauts d'heure ; ils ne constituent pas un essai physique de plusieurs heures sur tous les systèmes. Les codecs disponibles dépendent du navigateur.
- Les plafonds d'import limitent la taille ; ils ne garantissent pas une mémoire suffisante sur tous les appareils. Les navigateurs peuvent évincer IndexedDB : une sauvegarde téléchargée reste nécessaire.
- Aucun audit externe, test d'intrusion ni bêta de 5–10 humains n'est présenté comme accompli. Une séance réelle et une bêta sont les prochaines validations produit.

Les résultats détaillés de livraison sont consignés dans le plan d'implémentation. La publication publique est une étape distincte : elle doit être suivie d'un contrôle HTTP et navigateur sur l'URL finale.

## Validation produit encore ouverte (J7)

La candidate reste à faire essayer par 5 à 10 personnes, avec mesure du temps jusqu’à la première session, plusieurs sessions réelles, retours sur la composition d’espace et écoute des boucles. Safari/iOS, un lecteur d’écran et des appareils de puissance modeste doivent figurer parmi les essais. Une réussite technique ne ferme pas ces critères ; le statut « en validation » doit rester visible tant qu’ils ne sont pas satisfaits. Les autres écarts encore ouverts, dont le poster vidéo dédié et les points de documentation/gouvernance, restent suivis dans la matrice d’audit ; la réussite de cette suite ne vaut pas couverture complète de la fiche V1.

Pendant des vérifications parallèles, utilise un répertoire de sortie distinct par exécution (`npx playwright test --output=artifacts/e2e-mon-lot --reporter=line`) pour éviter qu’un lancement ne nettoie les traces d’un autre.

## Lot galerie, radio et corrections du 14 octobre 2026

La candidate `1.1.0-rc.2` ajoute la validation du catalogue de fonds et de ses exports, le chargement réel et le repli des images dans Chromium/Firefox, la navigation mobile et clavier, ainsi que le démarrage/reprise du minuteur entre deux rafraîchissements. Le badge de sauvegarde permanent est absent et la confirmation des notes disparaît après enregistrement sans perdre le contenu au rechargement.

Les tests radio unitaires et les parcours `e2e/radio.spec.ts` utilisent un transport simulé pour vérifier les transitions, erreurs, arrêt et préférences de façon déterministe. Ils ne prouvent pas la disponibilité ou le décodage d’un flux radio externe ; les vérifications des flux réels sont consignées séparément dans [Radio](radio.md). Tous les navigateurs restent muets.

**Résultat local du lot rc.2 : 136 tests unitaires réussis ; 90 exécutions navigateur sur Chromium et Firefox en développement, puis 28 exécutions ciblées sur Docker/Nginx (galerie, radio, minuterie, accessibilité et production), toutes réussies sans retry.** Formatage, ESLint, TypeScript et build passent. La première tentative de suite dev a été interrompue par l’arrêt du serveur partagé ; les 90 réussites proviennent d’une nouvelle exécution complète sur un serveur dédié. Les quatre stations ont également atteint `playing` dans Chromium sur Docker avec zéro erreur CSP/JavaScript, avant arrêt et fermeture du navigateur muet. La suite production complète reste exécutée par la CI de publication.
