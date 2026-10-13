# Médias et sons locaux

Komolu ne charge aucun média distant. Les cinq ambiances intégrées sont des textures synthétiques originales : bruit brun, pluie, vent, feu et vagues. Elles ne prétendent pas être des enregistrements de terrain. Aucun échantillon sonore tiers n’est redistribué.

## Stockage et formats

Les imports sont des `Blob` IndexedDB (`MediaRecord` dans `core/model.ts`). Une référence dans un espace ne copie pas le fichier. La médiathèque du Studio permet de réutiliser un fond ou de supprimer un média ; la suppression détache atomiquement ses références dans tous les espaces. Retirer une piste du mix conserve le fichier dans la médiathèque.

Limites : 50 Mio par fichier, 150 Mio pour la médiathèque, 20 mégapixels par image, 8,5 mégapixels par vidéo (4K), 120 secondes et 2 canaux par son personnel. Trois sons personnels au maximum dans un espace via l’interface. Les sons décodés du mix sont limités à 64 Mio ; les décodages se font en série. Une allocation temporaire du nouveau son peut s’ajouter aux pistes existantes pendant son décodage. Les fichiers audio sont préalablement inspectés via leurs métadonnées puis décodés à 44,1 kHz pour vérifier leur compatibilité. Les sons en lecture sont rééchantillonnés à la fréquence du contexte audio.

Formats autorisés : JPEG, PNG, WebP, AVIF ; MP4, WebM, OGG vidéo ; MP3, WAV, OGG, WebM, MP4/AAC et FLAC audio. La compatibilité des codecs dépend du navigateur. SVG, HTML et formats arbitraires sont refusés. Les métadonnées sont inspectées avant sauvegarde avec un délai maximal de 15 secondes ; les fichiers corrompus ou incompatibles produisent un message. Les dimensions sont vérifiées via le décodeur du navigateur : cette protection ne constitue pas un bac à sable indépendant pour des codecs malveillants.

Les URL `blob:` sont révoquées après inspection ou démontage du fond. Aucun encodage base64 n’est utilisé pour l’affichage normal. En cas de fichier absent/illisible, le décor intégré reste visible. Le fond utilise `cover`, un cadrage paramétrable, un voile coloré léger, un assombrissement et un flou bornés. Les vidéos sont muettes ; elles se mettent en pause lorsque l’onglet est masqué, lorsque la préférence système demande de réduire les mouvements ou lorsque cette option est active dans Komolu. Une image fixe du flux reste affichée lorsque disponible.

## Cycle audio

`useAudio(profile)` instancie un moteur par application et expose `playing`, `loading`, `error`, `play`, `pause`, `stop`, `clearError`. La configuration seule ne crée aucun AudioContext. L’utilisateur clique sur Écouter pour activer le contexte ; un rechargement ne redémarre jamais le son. Un changement d’espace remplace le mix si les sons étaient déjà activés.

Chaque piste possède son propre gain, puis passe dans un gain maître et un compresseur limitant les crêtes. Mute conserve les volumes. Les transitions utilisent des rampes et les boucles reçoivent une courte atténuation à leur jonction. Pause suspend le contexte après le fondu ; Arrêter libère les sources et leurs buffers ; le démontage ferme le contexte. Des identifiants de révision invalident les décodages devenus obsolètes après pause, arrêt, changement de profil ou démontage.

Le son de fin est distinct des ambiances. `armCompletionSound()` doit être appelé depuis un geste explicite (Démarrer/Reprendre), et `useCompletionSound(timer, enabled)` observe les nouvelles fins de phase. Le profil doit activer `sound`. Le premier état chargé n’est jamais joué ; une revendication atomique `timer.lastSoundKey` dans IndexedDB choisit un seul onglet parmi ceux autorisés à émettre le son. Une fin ancienne n’est pas rejouée après rechargement. Pas de notification système ni de demande de permission.

## Contrats d’interface

- `AudioPanel` reçoit `{ workspace, audio }` ; les modifications sont persistées sur l’identifiant d’espace capturé.
- `Background` reçoit `{ workspace, reducedMotion, children }`. Les enfants sont le décor original de secours.
- `BackgroundSettings` reçoit `{ workspace }` et inclut import, effets et gestion de médiathèque.
- `inspectMedia(blob, kind)` peut être réutilisé avant une transaction d’import de sauvegarde ; ne jamais décoder un média dans une transaction IndexedDB.
- `saveMedia(record, database?)` applique limites et cohérence du Blob dans une transaction sérialisée.

Références : [MDN AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode), [MDN GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode), [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData), consultées le 13 octobre 2026. Les tests unitaires couvrent admission, dimensions, taille décodée, quota concurrent, détachement des références, génération bornée, absence d’autoplay, mute, suspension et décodages obsolètes. La restitution sonore réelle et la compatibilité Safari restent à valider sur ces environnements.
