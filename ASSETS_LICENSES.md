# Licences des ressources

Le code et les ressources originales de Komolu sont distribués sous [MIT](LICENSE), copyright 2026 Komolu contributors. Les dépendances gardent leurs licences respectives. Le nom Komolu reste un nom de travail : aucune garantie de disponibilité de marque ou de domaine n'est donnée.

| Ressource distribuée                           | Origine / auteur                                                                | Licence et modifications                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Scènes Minimal, Cozy et Deep Work              | Créations SVG/CSS pour Komolu, `src/components/Scene.tsx` et `src/styles.css`   | MIT ; aucun fond photographique tiers                                                                        |
| Textures bruit brun, pluie, vent, feu, vagues  | Synthèse originale Komolu dans `src/core/audio.ts`                              | MIT ; aucun enregistrement ni échantillon tiers                                                              |
| Son de fin de phase                            | Synthèse originale Komolu dans `src/core/audio.ts`                              | MIT                                                                                                          |
| Interface, textes et captures de démonstration | Komolu contributors                                                             | MIT ; captures de l'application avec données fictives                                                        |
| Icônes de l'interface                          | [Lucide](https://github.com/lucide-icons/lucide), paquet `lucide-react` 0.468.0 | ISC ; contient des portions [Feather](https://github.com/feathericons/feather) sous MIT ; notices conservées |
| Vidéo de test `e2e/fixtures/quiet-sage.webm`   | Création FFmpeg, fond uni sauge silencieux, 64 × 64 pixels / 2 secondes         | MIT ; fixture originale, hors build de production                                                            |
| Favicon feuille `public/favicon.svg`           | Création vectorielle originale Komolu                                           | MIT                                                                                                          |
| Typographie                                    | Polices déjà présentes sur le système du visiteur                               | Aucun fichier de police distribué ni chargé à distance                                                       |

Les images, vidéos et sons importés par un utilisateur restent dans son navigateur et ne font pas partie de cette distribution. L'export d'espace retire systématiquement ces médias. Une sauvegarde personnelle les contient : leur réutilisation relève des droits de leur propriétaire.

Les textes complets des licences React, React DOM, Scheduler, Dexie, Dexie React Hooks et Lucide, ainsi que le NOTICE Dexie et la licence MIT Feather, sont livrés dans [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt). Ils sont copiés à la racine du build statique. `node scripts/notices.mjs` les régénère depuis les dépendances installées ; relire et committer les notices lors de chaque mise à jour. Le fichier Feather est conservé depuis la [source officielle](https://github.com/feathericons/feather/blob/main/LICENSE).

Les images Docker Node et Nginx sont des dépendances de construction/distribution distinctes ; elles conservent leurs propres composants et notices. Le conteneur final inclut Nginx et les fichiers statiques, pas Node ni les outils de développement.
