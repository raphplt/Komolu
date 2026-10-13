# Vérification de la V1

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

Playwright démarre Vite sur le port 5173 (ou réutilise un serveur existant hors CI). Chaque scénario utilise un contexte isolé, sans profil utilisateur. Les traces et captures d'échec se trouvent dans `test-results/`, le rapport HTML dans `playwright-report/` ; ces répertoires sont ignorés par Git.

Pour vérifier la distribution réellement servie avec Nginx et ses en-têtes :

```bash
docker compose up --build --detach --wait
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

`PLAYWRIGHT_BASE_URL` désactive le lancement de Vite. La CI exécute les deux suites, développement puis production, avant de publier le build sur Pages. Le runner sans périphérique sonore démarre PulseAudio avec une sortie virtuelle `module-null-sink` : Firefox dispose ainsi d’une vraie sortie système pour Web Audio, sans remplacer les API audio par des mocks. Les traces et captures sont conservées sept jours si la CI échoue.

## Couverture

Les **80 tests unitaires** couvrent la machine de minuterie (veille, sauts d'horloge, répétitions, profil figé), stockage atomique, limites, schéma strict, export filtré, fusion et restauration, invalidation des notes, quotas, inspection et détachement des médias, génération audio et cycles de lecture.

Les **26 scénarios navigateur**, exécutés sur **Chromium et Firefox** (52 exécutions), couvrent les sessions/rechargements/deux onglets, changement d'espace, tâches, notes, pensées, raccourcis, Studio et clavier, préférences, mobile, import/export avec médias et refus d'entrées invalides. Les contrôles axe automatisés couvrent les trois décors et les principaux panneaux ; le focus des dialogues et l'absence de débordement mobile sont aussi vérifiés.

Les tests de production surveillent erreurs JavaScript/console, violations de CSP et requêtes extérieures à l'origine. Une vidéo WebM fictive locale est importée, lue muette, pausée avec la réduction des mouvements puis retrouvée après reload. Les images PNG et sons WAV sont également décodés par les navigateurs dans les parcours de portabilité. Les fixtures sont fabriquées pour les tests, sans données personnelles.

Les captures de `docs/screenshots/` montrent l'application réelle avec tâches et notes fictives dans un contexte jetable. Elles ne sont ni des maquettes, ni la capture du navigateur personnel d'un utilisateur.

## Limites de ces preuves

- Chromium et Firefox tournent sous Linux, sans interface visible. Safari, iOS, Android réel et politiques audio mobiles ne sont pas certifiés par ces résultats.
- Le contrôle axe ne remplace pas une lecture humaine ni un parcours avec lecteur d'écran. Une préférence système de mouvement est respectée, mais tous les handicaps et dispositifs ne sont pas couverts.
- La génération et les cycles Web Audio sont testés ; la qualité d'écoute, les fondus et les boucles n'ont pas été évalués à l'oreille par un humain.
- Les tests simulent la veille et les sauts d'heure ; ils ne constituent pas un essai physique de plusieurs heures sur tous les systèmes. Les codecs disponibles dépendent du navigateur.
- Les plafonds d'import limitent la taille ; ils ne garantissent pas une mémoire suffisante sur tous les appareils. Les navigateurs peuvent évincer IndexedDB : une sauvegarde téléchargée reste nécessaire.
- Aucun audit externe, test d'intrusion ni bêta de 5–10 humains n'est présenté comme accompli. Une séance réelle et une bêta sont les prochaines validations produit.

Les résultats détaillés de livraison sont consignés dans le plan d'implémentation. La publication publique est une étape distincte : elle doit être suivie d'un contrôle HTTP et navigateur sur l'URL finale.
