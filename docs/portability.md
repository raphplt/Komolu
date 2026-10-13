# Sauvegardes, partage et restauration

Komolu conserve les données uniquement dans IndexedDB sur l’origine du navigateur. Un export téléchargé est une sauvegarde ; IndexedDB ne protège pas contre l’effacement du navigateur. Aucun compte, service distant ou téléchargement de contenu extérieur n’intervient.

## Deux formats JSON versionnés

- `komolu-backup-YYYY-MM-DD.json` : `{format:"komolu-backup",version:2,exportedAt,state,media}`. Contient toutes les données privées et tous les médias locaux, même inutilisés. Chaque média est un objet `{id,name,mimeType,kind,size,createdAt,data}` dont `data` est le contenu binaire encodé en base64. Le fichier doit être conservé à l’abri ; il n’est pas chiffré.
- `komolu-space-<nom>.json` : `{format:"komolu-space",version:2,exportedAt,workspace}`. Configuration de l’espace actif uniquement. Projection explicite des propriétés autorisées ; aucune tâche, note, pensée, préférence globale personnelle ni session en cours. La palette et le mode Focus de cet espace sont inclus. Tous les médias locaux sont retirés : ni fichier, ni identifiant, ni nom, ni piste audio associée. Un fond image/vidéo local retourne au décor intégré correspondant ; les fonds unis et dégradés sont conservés. Le nom et la description de l’espace, les libellés de minuterie et les noms des sons intégrés sont intentionnellement partagés : ils sont à relire avant diffusion.

Le JSON unique facilite l’inspection et évite extraction ZIP et bombes de décompression. Le surcoût base64 est d’environ un tiers. Le format et le schéma de données sont en version 2. Les anciens fichiers version 1 sont d’abord validés selon leur contrat historique, puis migrés et validés en version 2 avant l’aperçu. Les versions inconnues sont refusées avec un message explicite.

## Vérification avant écriture

Fichier limité à 220 Mio avant lecture ; 50 Mio par média, 150 Mio pour la médiathèque finale. Taille base64, taille déclarée et octets décodés doivent correspondre. Les mêmes restrictions MIME, pixels, durée audio et décodage que l’import média classique sont appliquées avant toute transaction d’écriture. Les formats SVG et les URLs distantes ne sont pas admis. L’aperçu n’écrit rien.

Les objets sont stricts à tous les niveaux : champs inconnus refusés, widgets/version/options connus, nombres finis et bornés, grille sur 12 colonnes, couleur hexadécimale, cadrages autorisés, fuseau vérifié par `Intl`, types booléens exacts. Limites : 100 espaces, 50 widgets et pistes par espace, 20 phases par profil, 10 000 tâches, 10 000 pensées, 500 médias, 100 000 caractères de notes, 500 par tâche, 5 000 par pensée. Identifiants uniques dans leur collection et références présentes avec le bon type de média. La session doit référencer une phase et une tâche valides et avoir des échéances cohérentes avec son statut et son profil. Les clés de prototype sont refusées. Les textes sont affichés par React sans interprétation HTML.

Les contrôles de médias décodent les contenus et peuvent prendre quelques secondes ; les plafonds ne garantissent pas une mémoire suffisante sur tous les appareils. Si le navigateur manque de mémoire, la préparation n’a encore modifié aucune donnée.

## Politiques de restauration

L’import présente le type, le nombre d’espaces, tâches, pensées et médias, le volume des médias et la longueur des notes. L’utilisateur choisit ensuite :

- **Ajouter** une sauvegarde : copie chaque espace/tâche/pensée/média avec de nouveaux identifiants, remappe toutes les références média et les identifiants de widgets, pistes et profils. Conserve l’espace actif, les préférences, la tâche active et la session actuels ; la session sauvegardée n’est pas importée dans ce mode. Ajoute les notes sous `— Notes importées —` sans écraser les notes existantes. Si une limite finale serait dépassée, toute la fusion est refusée, sans troncature.
- **Remplacer** : demande une confirmation explicite, puis remplace ensemble données et médiathèque. La session sauvegardée en cours est restaurée en pause au temps de son export ; le temps écoulé depuis le téléchargement n’est pas déduit. Aucun audio ne redémarre automatiquement. Les sessions déjà pausées, en attente ou terminées gardent leur état.
- Un **espace partageable** est toujours ajouté à la collection et activé. Il ne remplace jamais les données personnelles. Une session en cours reste indépendante de cet espace.
- **Effacer les données locales** nécessite de saisir exactement `EFFACER`. Réinitialise en une transaction données, médiathèque et trois ambiances de départ.

Les identifiants de génération des notes (`dataEpoch`) sont renouvelés au remplacement, à la fusion personnelle et à la remise à zéro ; un ancien brouillon provenant d’un autre onglet ne peut pas ressusciter les notes antérieures. L’export et les imports attendent la sauvegarde des brouillons du présent onglet ; une remise à zéro les annule seulement après réussite. Les autres onglets affichent les nouvelles données par `liveQuery`.

## Atomicité et erreurs

L’export capture état et médias dans une seule transaction en lecture, puis sérialise les blobs hors transaction. Un autre onglet peut continuer à travailler : le fichier représente un instantané cohérent.

La préparation décode et contrôle tous les médias hors transaction. Un jeton interne associe l’aperçu à son instantané validé ; une modification ultérieure de l’objet d’aperçu ne peut modifier le contenu importé. L’application effectue une transaction unique couvrant état et médias. En cas de quota insuffisant, erreur ou dépassement des limites de fusion, toutes les écritures sont annulées. Le contenu local reste disponible. Le bouton d’annulation de l’aperçu n’applique aucune écriture.

Contrats : `src/core/schema.ts` valide les formats ; `src/core/portability.ts` expose `exportBackup`, `exportSpace`, `prepareImport`, `readImport`, `applyImport`, `resetLocalData` et `downloadPortable`. Les tests utilisent une fonction de contrôle média injectée pour les transactions IndexedDB simulées ; les tests navigateur vérifient le décodage réel PNG/WAV et les téléchargements.

## Mise à jour depuis 1.0.0

La base IndexedDB passe de version 1 à 2 dans une transaction. Les données personnelles, médias et session sont conservés ; la palette reprend celle de l’ancien décor et le Focus global devient le Focus de l’espace actif. Les nouvelles pistes natives sont ajoutées désactivées aux mixes existants sans remplacer leurs volumes. Les descriptions générées par les anciens modèles sont retirées ; les descriptions personnalisées sont conservées.

Conserve une sauvegarde avant la mise à jour. L’application 1.0.0 ne sait pas ouvrir une base version 2 ni importer un export version 2. Un retour à 1.0.0 nécessite une installation sur une origine distincte avec la sauvegarde version 1 correspondante ; ne supprime pas les données actuelles pour tester un retour en arrière.
