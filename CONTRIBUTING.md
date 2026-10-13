# Contribuer à Komolu

Merci de garder l'expérience simple : un espace personnel de concentration, sans compte obligatoire ni backend en V1. Les propositions produit sont bienvenues dans les issues. Signale en priorité toute perte de données ou erreur de minuterie.

## Installation

Node 24.21.0, npm et Git :

```bash
npm ci --include=dev
npm run dev
```

Les contributeurs utilisant nvm peuvent commencer par `nvm use`. Pour les tests navigateur : `npx playwright install --with-deps chromium firefox`.

## Avant une pull request

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Décris le problème, le comportement obtenu et la validation effectuée. Pour une modification visuelle, joins une capture avec des données fictives. Ajoute un test utile lorsqu'un comportement ou une régression le justifie. La CI vérifie aussi le conteneur de production.

## Conventions

- TypeScript strict ; logique métier pure dans `src/core`, rendu dans `src/components`, cycles audio dans `src/hooks`.
- Toute mutation persistée passe par une transaction ; ne décode jamais un média au milieu d'une transaction IndexedDB.
- Espaces et données privées sont séparés. Une nouvelle option partageable doit être ajoutée explicitement à la projection d'export et au schéma strict.
- Minuterie fondée sur des échéances ; les intervalles ne décrémentent pas un compteur.
- Préserve les noms accessibles, le focus clavier, la présentation mobile et les préférences de mouvement. Une commande par glisser-déposer doit proposer une alternative clavier.
- Aucun média distant par défaut, aucune télémétrie ajoutée implicitement. Documente les licences des nouveaux assets dans `ASSETS_LICENSES.md`.
- Après mise à jour d'une dépendance de production, régénère `node scripts/notices.mjs` et vérifie ses licences, y compris transitives.

La [fiche produit](docs/product.md) est le document de vision d'origine, pas une liste de fonctionnalités déjà livrées. Le [README](README.md), le [changelog](CHANGELOG.md) et les [contrats actuels](docs/architecture.md) décrivent l'implémentation.

En proposant une contribution, tu acceptes qu'elle soit distribuée sous la [licence MIT du projet](LICENSE). Inclure des contenus tiers nécessite d'en indiquer la source et une licence compatible. Voir aussi le [code de conduite](CODE_OF_CONDUCT.md).
