# Licences des ressources

Le code et les ressources originales de Komolu sont distribués sous [MIT](LICENSE), copyright 2026 Komolu contributors. Les dépendances gardent leurs licences respectives. Le nom Komolu reste un nom de travail : aucune garantie de disponibilité de marque ou de domaine n'est donnée.

| Ressource distribuée                           | Origine / auteur                                                                | Licence et modifications                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Scènes Minimal, Cozy et Deep Work              | Créations SVG/CSS pour Komolu, `src/components/Scene.tsx` et `src/styles.css`   | MIT ; aucun fond photographique tiers                                                                        |
| Bruits brun et blanc                           | Synthèse originale Komolu dans `src/core/audio.ts`                              | MIT ; génération locale de bruit                                                                             |
| Son de fin de phase                            | Synthèse originale Komolu dans `src/core/audio.ts`                              | MIT                                                                                                          |
| Interface, textes et captures de démonstration | Komolu contributors                                                             | MIT ; captures de l'application avec données fictives                                                        |
| Icônes de l'interface                          | [Lucide](https://github.com/lucide-icons/lucide), paquet `lucide-react` 0.468.0 | ISC ; contient des portions [Feather](https://github.com/feathericons/feather) sous MIT ; notices conservées |
| Vidéo de test `e2e/fixtures/quiet-sage.webm`   | Création FFmpeg, fond uni sauge silencieux, 64 × 64 pixels / 2 secondes         | MIT ; fixture originale, hors build de production                                                            |
| Favicon feuille `public/favicon.svg`           | Création vectorielle originale Komolu                                           | MIT                                                                                                          |
| Typographie                                    | Polices déjà présentes sur le système du visiteur                               | Aucun fichier de police distribué ni chargé à distance                                                       |

Les images, vidéos et sons importés par un utilisateur restent dans son navigateur et ne font pas partie de cette distribution. L'export d'espace retire systématiquement ces médias. Une sauvegarde personnelle les contient : leur réutilisation relève des droits de leur propriétaire.

Les textes complets des licences React, React DOM, Scheduler, Dexie, Dexie React Hooks et Lucide, ainsi que le NOTICE Dexie et la licence MIT Feather, sont livrés dans [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt). Ils sont copiés à la racine du build statique. `node scripts/notices.mjs` les régénère depuis les dépendances installées ; relire et committer les notices lors de chaque mise à jour. Le fichier Feather est conservé depuis la [source officielle](https://github.com/feathericons/feather/blob/main/LICENSE).

Les images Docker Node et Nginx sont des dépendances de construction/distribution distinctes ; elles conservent leurs propres composants et notices. Le conteneur final inclut Nginx et les fichiers statiques, pas Node ni les outils de développement.

## Enregistrements des ambiances

Les sept fichiers `public/audio/*.flac` sont dérivés des previews MP3 publics de Freesound. Les pages des sept fichiers précis affichent CC0 1.0, vérifiées le 13 octobre 2026. Les originaux complets nécessitent un compte et n’ont pas été récupérés.

| Ambiance | Auteur et fichier source                                                                                                         | Licence                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| rain     | [Soft rain.WAV by barkenov](https://freesound.org/people/barkenov/sounds/640655/) — barkenov                                     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| fire     | [Fireplace (light).WAV by Makape](https://freesound.org/people/Makape/sounds/414117/) — Makape                                   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| forest   | [forest_birds.wav by ktokrzysiek](https://freesound.org/people/ktokrzysiek/sounds/392603/) — ktokrzysiek                         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| waves    | [Ocean Waves.wav by Noted451](https://freesound.org/people/Noted451/sounds/531015/) — Noted451                                   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| cafe     | [coffee shop ambience by waweee](https://freesound.org/people/waweee/sounds/370973/) — waweee                                    | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| wind     | [wind in the trees from cover by strangy](https://freesound.org/people/strangy/sounds/176253/) — strangy                         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| thunder  | [230823 Thunder, dry distant rolling, R-07 EM272s, Stratford 12pm by TRP](https://freesound.org/people/TRP/sounds/717890/) — TRP | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Modifications : extrait de 22 s, rééchantillonnage stéréo 32 kHz, retrait DC, recouvrement égal-puissance de 2 s, limitation douce des crêtes, niveau RMS −22 dBFS, FLAC 16 bits de 20 s. [Crédits distribués](public/audio/CREDITS.txt), [manifest et empreintes SHA-256](public/audio/manifest.json), [recette de préparation](scripts/audio/README.md). La source café contient un fond de conversations : l’absence de paroles intelligibles nécessite une validation à l’écoute ; elle n’est pas déduite de la langue parlée.
