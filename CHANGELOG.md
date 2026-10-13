# Changelog

## 1.1.0-rc.1 — 2026-10-13 · candidate en validation

Reprise de la V1 après [audit de la livraison initiale](docs/v1-audit.md). Le numéro `1.0.0` reste historique ; il ne constituait pas une preuve de réalisation complète de la fiche produit.

- Interface épurée : titres utiles, états de minuterie factuels, descriptions d’espace facultatives et éditables.
- Focus mémorisé par espace ; commandes compactes pour session, ambiances, pensées, changement d’espace et sortie.
- Studio : résolution des collisions au déplacement/redimensionnement/ajout, tailles minimales, widget audio compact, couleur et ombre d’horloge.
- Fond uni ou dégradé, changement de scène dans un espace existant, palette indépendante et intensité du voile.
- Catalogue de neuf sons : sept enregistrements redistribuables et deux bruits synthétiques, mixes initiaux distincts et gestion des erreurs de chargement.
- Schéma 2 : migration de la base IndexedDB et des anciens exports, préservation des données personnelles, médias et session ; refus des versions inconnues.
- Vérifications ajoutées pour migrations, collisions, personnalisation, Focus et absence de sortie audio pendant une session silencieuse.

La validation d’intégration de cette candidate est suivie dans [docs/testing.md](docs/testing.md). J7 (bêta avec 5 à 10 personnes), Safari/iOS, lecteur d’écran et écoute humaine restent ouverts. Aucun de ces essais n’est remplacé par les tests automatisés. La candidate ne clôt pas tous les écarts V1 : le poster vidéo dédié, le registre de widgets et les points de documentation/gouvernance indiqués dans la matrice d’audit restent ouverts.

## 1.0.0 — 2026-10-13

Première distribution publique, statique et auto-hébergeable. Sa couverture de la fiche V1 était partielle ; voir l’audit ci-dessus. [Instance publique](https://raphplt.github.io/Komolu/) publiée le 13 octobre 2026.

- Docker multi-stage Node/Nginx, exécution non privilégiée et lecture seule, contrôle de santé.
- CI : formatage, lint, TypeScript, tests unitaires, Chromium et Firefox, parcours sur Nginx, puis GitHub Pages.
- Sources formatées, licence MIT, notices complètes des dépendances et registre de ressources originales.
- Sortie audio indisponible : chargement borné à huit secondes, erreur explicite et possibilité de réessayer.
- Documentation de développement, auto-hébergement, confidentialité, contribution et tests ; captures des trois décors, du Studio et du mobile.

La bêta humaine, Safari/iOS et l'écoute réelle des ambiances ne sont pas encore validés. PWA, synchronisation, salles, chat/voix et marque blanche à l'exécution restent hors V1.

## 0.8.0 — 2026-10-13

- Sauvegarde JSON complète avec médias et partage d'espace sans contenu privé.
- Validation stricte, aperçu, fusion/remplacement et réinitialisation atomiques.
- Limites cohérentes entre création et import ; protections contre quotas, médias invalides et import modifié après aperçu.
- Coordination multi-onglets et invalidation des brouillons de notes après restauration.
- 80 tests unitaires et 48 parcours Chromium/Firefox validés à ce jalon.

## 0.5.0 — 2026-10-13

- Décors Minimal, Cozy, Deep Work et gestion d'espaces.
- Studio avec déplacement/redimensionnement et alternative clavier.
- Tâches, notes, pensées, horloges configurables, Focus et raccourcis.
- Séquences de minuterie, répétitions, transitions optionnelles et son de fin.
- Cinq textures audio originales, mixeur et médias personnels locaux.

## 0.1.0 — 2026-10-13

- Première boucle utilisable : décor, minuterie, tâche, ambiance synthétique.
- React, TypeScript, Vite et IndexedDB ; minuterie persistée par échéance.
