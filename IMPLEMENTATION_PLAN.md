# Komolu — plan de livraison

Référence : fiche projet fournie le 13 octobre 2026. La réalisation reste une application statique, sans compte ni backend. Les validations humaines et la publication effective seront distinguées des résultats automatisés.

## Phase 0 — découverte

- Vérifier les API officielles React/Vite, IndexedDB/Dexie, Web Audio et Playwright.
- Dépôt initial vide ; aucun héritage technique. `@RTK.md` est référencé mais absent du dépôt et des répertoires parents inspectés.
- Consigner les versions réellement installées et les références dans `docs/architecture.md`.

## Phase 1 — boucle testable (0.1)

- Initialiser React, TypeScript strict, Vite, Vitest et IndexedDB.
- Créer modèles versionnés : espaces distincts des tâches, notes et pensées ; timer avec instant d'échéance et instantané du profil.
- Afficher une scène, un timer fonctionnel, une tâche et une ambiance synthétique.
- Vérifier démarrage, pause/reprise, reload et conservation des données avec tests unitaires et build.
- Sources à reproduire : guide Vite, API Dexie transaction, MDN AudioContext (références précises ajoutées après découverte).
- Interdits : backend anticipé, durée calculée en décrémentant un compteur, suppression de données privées lors d'un changement d'espace.

## Phase 2 — expérience quotidienne et Studio (0.5)

- Trois univers Minimal/Cozy/Deep Work ; scène originale locale sans dépendance réseau.
- Registre de widgets, Studio avec déplacement/redimensionnement et alternative clavier, disposition mobile lisible.
- Espaces : création, duplication, renommage, suppression confirmée, restauration.
- Timer : profils 25/5, 50/10, libre, séquences personnalisées, répétitions, passage automatique optionnel, son de fin optionnel.
- Tâches globales ordonnées et renommables, notes persistantes, capture rapide et boîte Pensées.
- Audio synthétique multipiste avec gains et master, mute et fondu ; imports personnels stockés localement.
- Fonds image/vidéo locaux avec limite, réglages et préférence de mouvement.
- Vérifier les flux complets au navigateur, incluant reload, clavier, mobile et changement de preset.
- Interdits : réseau pour médias par défaut, configuration bloquante, actions sans étiquettes accessibles.

## Phase 3 — portabilité et robustesse (0.8)

- Export personnel complet avec médias ; export d'espace explicitement filtré et dépourvu de contenu privé.
- Imports validés (version, taille, types), aperçu et choix de remplacement/fusion.
- Quotas, fichiers absents, erreurs de stockage ; coordination des onglets ; reprise après veille et saut d'horloge documentée.
- Tests Vitest et Playwright : timer, isolation espaces/données privées, layout persistant, sauvegarde/import, validation hostile.
- Vérifier typecheck, lint, tests, build et E2E ; revue indépendante et vérification des anti-patterns.

## Phase 4 — distribution V1

- Docker multi-stage et compose, CI, licence MIT, registre de médias originaux, documentation installation/contribution/confidentialité.
- Version de livraison et changelog ; captures de la version réellement exécutée.
- Vérifier installation reproductible, compilation de production, tests ; expliciter les plateformes non testées.
- La publication distante dépend d'un accès effectif à l'hébergement ; une bêta auprès de 5–10 humains ne sera jamais présentée comme réalisée automatiquement.

## Critère de clôture

L'application et ses sources sont utilisables localement et distribuables, les parcours essentiels passent, les limites connues et les étapes externes restantes sont documentées. Aucun critère non vérifié ne sera déclaré acquis.

## État de livraison — 13 octobre 2026

- **Phase 0 terminée** : fiche de vision conservée, choix et références documentés, absence de `RTK.md` consignée.
- **Phase 1 terminée** : première boucle de travail persistée et testable.
- **Phase 2 terminée** : trois décors, Studio, widgets, espaces, sessions, médias, Focus et données personnelles.
- **Phase 3 terminée** : portabilité et robustesse ; 80 tests unitaires et 48 exécutions Chromium/Firefox validaient le jalon 0.8.
- **Phase 4 réalisée localement** : version 1.0.0, formatage, CI/Pages, Docker reproductible Node 24.21.0 et Nginx 1.30.5 épinglés par digest, licence MIT et notices distribuées, documentation et cinq captures réelles. Le conteneur tourne sans root, en lecture seule, avec contrôle de santé sur le port 8080.

Vérifications finales : `format:check`, ESLint, TypeScript, 80 unités, build statique et audit npm (aucune vulnérabilité signalée). Les 52 exécutions E2E passent sur Vite (29 secondes), puis les 52 exécutions de production passent dans Chromium/Firefox derrière Nginx et sa CSP, incluant absence de requête extérieure, audio déclenché explicitement et vidéo locale. Les réponses HTTP vérifient HTML sans cache immuable, assets hachés immuables, MIME et licences présents. Les détails et limites figurent dans `docs/testing.md`.

**Publication encore à faire** : activer GitHub Pages avec source GitHub Actions, pousser la version, vérifier CI et site final, créer le tag/release avec archive statique. Aucun déploiement distant n'est présenté comme acquis à ce stade. Une bêta humaine, Safari/iOS réel, un lecteur d'écran et une écoute humaine restent à organiser ; la disponibilité juridique du nom n'est pas certifiée.
