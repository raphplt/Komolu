# Reprise de la V1 après revue du périmètre

Le 13 octobre 2026, le retour utilisateur remet en cause la qualification de « V1 terminée ». La référence reste `docs/product.md`, et non le plan de livraison réduit établi pendant la première implémentation. Les remarques sur les textes et la pluie sont des exemples, pas une réduction de la portée de cette revue.

## Phase 0 — constats et contrats

Audit indépendant de l'ensemble de la spécification, du code et des parcours Studio. Les preuves sont consignées dans `v1-audit.md`. Les primitives existantes restent la référence d'implémentation : transactions de `core/storage.ts`, validation stricte de `core/schema.ts`, `actions.workspace` dans `core/store.ts`, gains et annulation dans `core/audio.ts`, cycle de médias dans `components/Background.tsx`.

Écarts identifiés : catalogue sonore incomplet et essentiellement constitué de bruit filtré ; absence de fonds unis/dégradés et de choix de décor dans un espace existant ; palette liée au décor ; réglages d'horloge incomplets ; Focus global et trop chargé ; collisions et tailles incohérentes dans Studio ; textes décoratifs répétitifs ; absence de migration éprouvée. La bêta humaine de J7 n'a pas eu lieu.

## Phase 1 — données et personnalisation

- Introduire une version 2 explicite avec migration des données et imports version 1, validés avant transformation. Préserver tâches, notes, pensées, session, identifiants et médias.
- Séparer palette et décor, ajouter fonds uni/dégradé, intensité du voile, choix de scènes intégrées, Focus par espace et couleur/ombre d'horloge.
- Réutiliser le rendu et les actions transactionnelles actuels ; valeurs bornées, aucune chaîne CSS exécutable ou URL distante dans les réglages.
- Vérifier migration de vraie base v1, aller-retour export/import, absence de perte de personnalisation, média et session ; reload des nouveaux réglages.

## Phase 2 — Studio et sobriété

- Remplacer les slogans par les seuls noms, états et aides utiles ; conserver les avertissements nécessaires.
- Réduire Focus aux commandes utiles pendant une session.
- Extraire un placement déterministe testable à partir du prédicat d'intersection existant ; appliquer les tailles minimales et éviter les chevauchements lors des actions Studio.
- Vérifier clavier et pointeur, ajout Ambiances, duplication d'horloge, reload, téléphone et zoom ; inspecter les captures réelles.

## Phase 3 — ambiances

- Compléter le catalogue demandé : pluie, tonnerre, vent, feu, forêt, café, vagues, bruit blanc et brun.
- Employer des enregistrements redistribuables avec provenance vérifiée pour les environnements naturels ; garder la synthèse pour les bruits blanc/brun.
- Charger les fichiers depuis la même origine à la demande, préserver l'activation explicite et les protections d'annulation/erreur. Budget mémoire borné, aucune piste activée ignorée silencieusement.
- Préparer les boucles avec recouvrement ; documenter transformations et licences. Ne pas présenter des tests numériques comme une validation d'écoute humaine.
- Vérifier décodage, limites, bouclage, parcours réel audio et absence de requêtes vers un tiers.

## Phase 4 — vérification et livraison honnête

- Confronter à nouveau le résultat à toute la matrice de spécification.
- Exécuter format, lint, types, unités et parcours Chromium/Firefox sur développement et distribution ; mettre à jour tests uniquement pour les changements intentionnels de contrat et d'interface.
- Documenter les éléments effectivement corrigés et les critères externes non réalisés. Ne pas réécrire le tag historique 1.0.0 ni déclarer la bêta, Safari/iOS, le lecteur d'écran ou l'écoute humaine validés.
- Publier le correctif fonctionnel seulement après vérification ; garder une distinction entre couverture du cahier des charges et validation produit en usage réel.
- Numéro de reprise : `1.1.0-rc.1`, explicitement en validation. Le tag historique `1.0.0` reste une trace de la livraison initiale ; son existence ne vaut pas clôture des critères J7.
