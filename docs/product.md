# Komolu — Fiche projet complète

**Plateforme de concentration cosy, personnalisable et open source**

> Document de cadrage — 13 octobre 2026  
> **Nom de travail retenu : Komolu**  
> Statut : spécification de référence pour initialiser le dépôt ; décisions techniques et identité visuelle à affiner  
> Publication : vérifier les marques et identifiants/domaines avant toute communication officielle

---

## 0. Résumé exécutif

**Komolu** est une application web libre, gratuite, local-first et sans compte obligatoire. Elle permet à chacun de **composer un environnement de concentration personnel** : fond visuel, ambiance sonore, widgets, horloge, minuterie flexible, petite liste de tâches, bloc-notes et capture rapide des idées. Elle ne gère **ni documents ni projets complexes**. Sa V1 doit fonctionner sans backend ; une V2 ajoute, de façon optionnelle, des salles de coworking synchronisées, un chat et de la voix.

Komolu est pensé d’abord comme un outil personnel réellement agréable, un projet portfolio solide et un bien commun réutilisable. L'objectif n'est pas la monétisation. Les critères de réussite sont la qualité d'usage, la sobriété, la simplicité de contribution, la portabilité des données et une installation reproductible.

**Nom du produit :** Komolu (écriture recommandée : `Komolu` en texte courant, `komolu` pour les éléments techniques).  
**Positionnement :** « Ton espace. Ton rythme. Ta concentration. »  
**Signature anglaise de travail :** « Your little place to focus. »  
**Promesse :** démarrer en quelques secondes, personnaliser en profondeur seulement si on le souhaite.  
**Non-objectifs :** gestion de projets, documents bureautiques, prise de notes avancée, analytics envahissantes, comptes obligatoires, fonctionnalités premium, publicités et dépendances propriétaires indispensables.

---

## 0.1 Nom, identité et voix de Komolu

### Nom retenu

- **Komolu** est le nom retenu pour l'application et pour le projet open source ; ce n'est pas le nom d'une fonctionnalité ou d'un thème.
- **Prononciation indicative :** « ko-mo-lou ». Sonorité ronde, douce, accueillante ; facile à dire et à retenir.
- **Écriture :** `Komolu` dans les interfaces et textes éditoriaux ; `komolu` pour le dépôt, les packages, les préfixes de fichiers et les commandes d'exemple.
- **Descriptif court :** « Un espace cosy pour se concentrer, entièrement personnalisable et open source. »
- **Pitch une phrase :** « Komolu est ton petit coin de concentration : tu choisis l'ambiance, disposes les widgets utiles, organises tes tâches et lances une session — sans compte ni distraction. »
- **Pitch anglais :** “Komolu is a cozy, open-source focus space with customizable backgrounds, widgets, ambient sounds, notes, tasks, and timers — self-hostable and account-free.”

### Personnalité de marque

| Axe | À privilégier | À éviter |
| --- | --- | --- |
| Ressenti | cosy, serein, intime, rassurant | austère, froid, corporate |
| Formes | arrondis doux, volumes simples, espacements généreux | cartes rigides, surcharge décorative |
| Couleurs | neutres chauds, accents sauge, caramel ou mauve doux | néon permanent, contraste agressif |
| Mouvement | transitions lentes, discrètes, désactivables | animations distractives ou indispensables |
| Ton | amical, direct, jamais culpabilisant | injonctions à performer, gamification anxiogène |
| Fonctionnement | mode Focus d'abord, personnalisation à la demande | configuration obligatoire avant usage |

L'identité doit rester belle et lisible **dans plusieurs ambiances** : le branding de Komolu est cohérent, mais n'impose pas une palette unique aux espaces personnels. Les presets sont des variations d'environnement, pas des marques distinctes.

### Terminologie UI

- **Espace** : environnement personnel sauvegardé (visuels + placement des widgets + réglages), pas un dossier de travail.
- **Studio** : écran/mode pour personnaliser un espace.
- **Focus** : mode de concentration débarrassé des commandes d'édition.
- **Session** : période de travail ou de pause suivie par le timer.
- **Ambiances** : sons et mélanges de sons ; éviter de nommer ce module uniquement « musique ».
- **Pensées** : captures rapides sans créer une application de notes complète.
- **Room** ou **Salle** (V2) : espace de coworking avec présence et activités facultativement partagées.

### Noms et éléments techniques proposés

| Élément | Convention proposée |
| --- | --- |
| Nom affiché | `Komolu` |
| Nom du dépôt | `komolu` (sous réserve de disponibilité) |
| Répertoire racine local | `komolu/` |
| Nom de package front | `@komolu/web` |
| Package partagé (plus tard si utile) | `@komolu/shared` |
| Titre de page initial | `Komolu — Your little place to focus` |
| Export de données personnelles | `komolu-backup-YYYY-MM-DD.zip` |
| Export de preset partageable | `komolu-space-<nom>.json` ou archive avec médias autorisés |
| Exemple d'image Docker | `ghcr.io/<organisation>/komolu` (placeholder, ne suppose pas une organisation existante) |

**Important :** le choix du nom n'atteste **pas** de la disponibilité juridique ou technique. Avant d'enregistrer un domaine, publier les réseaux ou dessiner une identité définitive, vérifier les marques pertinentes (notamment INPI/EUIPO), les identifiants de dépôt et les noms de domaine. Ne pas réserver artificiellement de liens ou de handles dans ce document.

---

## 1. Principes produit

1. **Focus first.** En mode travail, l'interface est silencieuse et discrète. Le système de personnalisation est séparé du mode concentration.
2. **Local-first.** Les données utilisateur sont créées et modifiées localement. Aucun serveur n'est nécessaire pour la V1.
3. **Sans friction.** Ouvrir l'application donne accès immédiatement à un espace prêt à l'emploi ; ne jamais imposer une phase de configuration.
4. **Autonomie.** Chaque utilisateur peut exporter ses données et reconstruire son espace sur une autre instance, sans dépendre de l'hébergeur public.
5. **Composabilité.** Les widgets, scènes et presets sont modulaires et versionnés.
6. **Sobriété et performance.** Le produit doit rester agréable sur un ordinateur portable moyen, y compris avec animation désactivée.
7. **Vrai open source.** Le code serveur futur, les scripts de déploiement, la documentation et les médias distribués respectent les licences applicables.
8. **Confidentialité.** Aucune télémétrie invasive. Les notes et tâches privées ne partent pas vers une room sans consentement explicite.

### Utilisateurs prioritaires

- Développeur : travaille en sessions longues, veut un fond discret, du bruit brun et une tâche active.
- Étudiant : veut un Pomodoro, une ambiance de bibliothèque et une liste de petites actions.
- Créatif : veut une session libre, des sons et une capture d'idées immédiate.
- Personne en télétravail : veut un rituel d'entrée au travail et une présence de groupe facultative, plus tard.

### Parcours d'usage cible

**Première ouverture** : un preset par défaut apparaît → bouton « Démarrer » → session de 25 min → tâche facultative. Aucun compte ni modal bloquante.

**Personnalisation** : ouvrir Studio → changer de scène → ajouter/déplacer/configurer des widgets → ajuster le mixeur sonore → enregistrer comme preset → lancer Focus.

**Session** : choisir ou saisir une tâche → démarrer le timer → le décor et les sons restent actifs → une pensée survient → raccourci de capture rapide → retour immédiat à la session → pause contrôlée en fin de cycle.

**Migration** : exporter les réglages, tâches et notes → importer sur une nouvelle installation → retrouver son espace. Distinguer impérativement export des *données personnelles* et partage d'un *thème anonymisé*.

---

## 2. Plan des versions

| Version | Mission | Critère de sortie |
| --- | --- | --- |
| V0.1 — Vertical slice | Construire une boucle de travail complète | Un fond, une horloge, une tâche, un timer et un son fonctionnent de bout en bout |
| V0.3 — Studio | Rendre l'espace composable | Ajouter, masquer, déplacer et redimensionner des widgets, puis sauvegarder un layout |
| V0.5 — Alpha | Rendre la V1 utilisable quotidiennement | Plusieurs presets, séquences Pomodoro, notes, tâches et mixeur |
| V0.8 — Hardening | Rendre le produit robuste | Import/export, tests, accessibilité, responsive raisonnable, compatibilité navigateurs |
| V1.0 — Release | Mettre à disposition le produit librement | Site public, build statique, Docker, documentation, licence et données maîtrisées |
| V1.5 — Ecosystem | Faciliter la réutilisation | Partage de presets, marque blanche, configuration d'instance et PWA si non livrée en V1 |
| V2.0 — Shared focus | Travailler à plusieurs sans se distraire | Rooms invitées, présence, timer commun, chat, puis vocal et tâches partagées |

**Règle de gouvernance :** on n'introduit pas de backend en V1 pour anticiper une V2 hypothétique. Prévoir uniquement des limites de modules et des interfaces extensibles.

---

## 3. Cahier des charges V1 — fonctionnalités et comportements

### 3.1 Espaces et presets

Un **espace** (ou preset) est une configuration d'expérience, pas un dossier/projet :

- nom, description facultative, identifiant local ;
- fond, effets et palette ;
- liste et positions des widgets ;
- style d'horloge ;
- profil de minuterie ;
- profil de mixeur audio ;
- préférences d'affichage et mode focus.

Opérations : créer depuis modèle, dupliquer, renommer, changer, supprimer avec confirmation, importer/exporter.

**Règle fondamentale :** tâches, notes et capture rapide vivent dans des données utilisateur séparées. Changer de preset ne doit jamais les effacer ni les remplacer. V1 : liste de tâches globale unique ; pas de listes par espace ni de « projets » déguisés.

Créer au moins trois presets intégrés : Minimal, Cozy et Deep Work. Ils sont utilisables immédiatement et différents par leur densité visuelle, pas seulement leur photographie.

### 3.2 Fond visuel

- Fond uni, dégradé, image, GIF si pertinent, vidéo muette en boucle.
- Catalogue limité de médias intégrés sous licences vérifiées.
- Upload local d'une image ou d'une vidéo ; affichage sans téléversement serveur.
- Réglages : assombrissement, léger flou, voile de couleur, cadrage (`cover`/position), éventuellement zoom très lent.
- Contrôle « Réduire les mouvements » respectant `prefers-reduced-motion` ; arrêt des vidéos en arrière-plan selon la politique définie.
- Fallback si média absent/corrompu ; limitations de taille et messages de stockage.
- Éviter le chargement par défaut de très grosses vidéos ; sélectionner des formats adaptés et un poster statique.

**À exclure V1 :** recherche de vidéos externes, flux YouTube intégrés, fond 3D lourd, marketplace de scènes.

### 3.3 Widgets et Studio

Widgets natifs V1 : horloge, timer, tâches, bloc-notes, commandes audio, texte/titre décoratif optionnel en toute fin de V1.

Chaque widget suit un contrat : `id`, `type`, `layout`, `visible`, `style`, `settings`, `version`. Un registre associe un type à un composant, un schéma de validation et des valeurs par défaut.

- Mode **Studio** : poignées de déplacement/redimensionnement, panneau de propriétés et bibliothèque de widgets.
- Mode **Focus** : aucune poignée d'édition, aucun panneau envahissant ; actions nécessaires toujours accessibles.
- Masquage, duplication lorsqu'elle est logique (ex. horloge), restauration de configuration initiale.
- Positions enregistrées par breakpoint ou composition mobile simplifiée ; pas de widgets inaccessibles après redimensionnement de fenêtre.
- Contrastes, navigation clavier et alternatives aux interactions purement « drag and drop ».

**Attention :** la tentation de créer un constructeur de pages complet est une dérive de périmètre. Un widget natif et des réglages limités suffisent pour V1.

### 3.4 Horloge

- Formats numériques 12/24 h, secondes optionnelles, date optionnelle ; style analogique simple.
- Fuseau du système par défaut ; choix explicite d'un fuseau optionnel.
- Taille, typographie, couleur, ombre et alignement.
- Possibilité de masquer complètement l'horloge.

### 3.5 Timer / Pomodoro

- Profils par défaut : 25/5 ; 50/10 ; session libre.
- Séquences personnalisées de phases travail/pause : ex. 30/10/45/15, en boucle ou avec nombre de répétitions.
- Démarrer, mettre en pause, reprendre, arrêter, passer à la phase suivante ; reprise non ambiguë après rechargement.
- Option passage automatique à la phase suivante, désactivable.
- Son ou notification de fin facultatifs et désactivables.
- Associer une tâche active à une session ; le timer ne modifie pas le statut de la tâche sans action explicite.

**Fiabilité :** ne jamais faire dépendre la durée totale d'une succession de `setInterval`. Enregistrer l'état de session, la durée et une échéance temporelle, puis recalculer le temps restant à partir de l'horloge à chaque rendu/reprise. Traiter les changements d'heure machine, mises en veille, changement d'onglet et rechargement. Tester les politiques des navigateurs en arrière-plan. Synchronisation entre onglets via BroadcastChannel ou stratégie d'onglet actif unique, pour éviter des états contradictoires.

### 3.6 Tâches

- Saisie en une ligne, liste compacte, coche/décoche, renommage, suppression, ordre manuel.
- Sélection d'une tâche active ; si un timer est actif, afficher cette tâche à proximité.
- Possibilité d'afficher/masquer les tâches terminées.
- Compteur simple ; pas de dates de livraison, sous-tâches profondes, kanban, labels ou priorités sophistiquées.
- Les tâches ne sont **pas** une sous-partie des presets et ne sont **jamais** partagées automatiquement dans une room.

### 3.7 Notes et capture de pensée

- Un bloc-notes rapide, texte brut ou Markdown extrêmement léger, sauvegarde locale automatique avec debounce.
- Capture rapide via raccourci : saisir → valider → retourner au focus sans navigation complexe.
- Captures stockées dans une boîte « Pensées » simple, consultable plus tard. On peut supprimer, copier ou transférer une capture vers les tâches.
- Pas de pages multiples, dossiers, historique de versions complexe ou éditeur WYSIWYG.

### 3.8 Audio ambiant

- Sons de base, sous licences de redistribution vérifiées : pluie, tonnerre, vent, feu, forêt, café, vagues, bruit blanc/brun (synthèse possible pour certains bruits).
- Plusieurs pistes simultanées ; volume individuel et volume maître.
- Boucles sans clic audible, fondus d'entrée/sortie, pause générale et arrêt.
- Présets de mix sauvegardés et associés à un espace ; pouvoir muter sans perdre les volumes.
- Différencier ambiance sonore intégrée et import personnel (stockage local, pas d'upload serveur).
- Le moteur audio peut utiliser `HTMLAudioElement` avec gains/mix Web Audio API ; débloquer le contexte à la suite d'une interaction utilisateur, conformément aux restrictions d'autoplay.
- Gestion de la latence de chargement et des fichiers manquants.

### 3.9 Mode Focus, plein écran, raccourcis

- Mode Focus : barre d'outils minimale, édition désactivée, possibilité de masquer des widgets individuellement.
- Plein écran natif optionnel, sortie évidente ; ne jamais forcer le plein écran.
- Raccourcis possibles : `Space` pour lecture/pause seulement hors saisie de texte ; `N` pour note rapide hors champ ; `F` pour Focus ; `Esc` pour fermer les panneaux. Documenter et permettre de désactiver les raccourcis conflictuels.
- Tester saisie clavier, lecteur d'écran, focus visible et navigation sans souris.

### 3.10 Stockage, export, vie privée

- IndexedDB pour données structurées et médias Blob ; outil d'abstraction possible : Dexie.
- Un schéma de données versionné et des migrations testées.
- Sauvegarde automatique à chaque changement pertinent.
- Export utilisateur complet (`.zip` contenant JSON manifest + médias locaux) ou JSON seul lorsque possible.
- Export d'espace partageable **sans** tâches, notes, pensées, données privées ni chemins locaux ; médias intégrés référencés par ID/licence ou embarqués quand autorisés.
- Import : validation de schéma, version, tailles, type MIME, limites de décompression, preview avant écrasement et mode fusion/remplacement clairement indiqué.
- Bouton effacer les données locales avec avertissement et confirmation ; ne pas laisser croire que les données IndexedDB sont des sauvegardes durables.
- Pas d'analytics sans décision explicite ; aucun partage réseau des données personnelles en V1.

**Limite explicite :** un compte absent signifie aussi pas de synchronisation inter-appareils automatique. Les données dépendent du profil et de l'origine du navigateur, sauf export/import.

---

## 4. Architecture proposée

### 4.1 Stack recommandée

| Domaine | Choix V1 | Raison |
| --- | --- | --- |
| Front | React + TypeScript + Vite | Application cliente, build statique, peu d'infrastructure |
| UI | Tailwind CSS + composants accessibles (Radix/shadcn si utiles) | Personnalisation et contrôle de l'interface |
| État éphémère | Zustand ou contextes dédiés | États des panneaux/lecture ; rester sobre |
| Données durables | IndexedDB avec Dexie (ou wrapper minimal) | Transactions, versionnement et médias locaux |
| Widgets | `react-grid-layout` v2, après prototype | Drag/resize et layouts responsives sérialisables |
| Audio | Web Audio API et éléments audio selon besoin | Gains par piste, mix, lecture locale |
| Validation | Zod (ou équivalent) | Import/export/configuration typés |
| Tests | Vitest + Testing Library + Playwright | Unités, composants, E2E |
| Qualité | ESLint + Prettier + TypeScript strict | Maintenance communautaire |
| Packaging | Build statique, Nginx ou Caddy via Docker | Auto-hébergement simple |
| PWA | Optionnelle en V1, prioritaire en V1.5 | Offline et installation sur bureau |

**Pas de Next.js obligatoire** : la V1 n'a ni SSR indispensable, ni endpoints serveur. Vite évite une complexité inutile. Ne pas installer de framework backend « pour plus tard ».

### 4.2 Domaines métier

```text
App Shell / navigation
├── Workspace & preset manager
├── Studio editor / layout engine
├── Widget registry
│   ├── Clock widget
│   ├── Timer widget
│   ├── Tasks widget
│   ├── Notes widget
│   └── Audio widget
├── Background manager
├── Audio engine
├── Focus session state machine
├── User data (tasks, notes, thoughts)
├── Persistence / migrations
├── Import-export / validation
└── Runtime configuration (self-hosting / branding)
```

Séparer la logique timer de son widget : plusieurs widgets ou vues doivent lire **la même** session. Idem pour le mixeur audio et les tâches.

### 4.3 Modèle de données simplifié

```ts
type WorkspacePreset = {
  id: string;
  name: string;
  schemaVersion: number;
  background: BackgroundConfig;
  theme: ThemeConfig;
  widgets: WidgetInstance[];
  timerProfileId: string;
  audioMixId: string;
};

type WidgetInstance = {
  id: string;
  type: 'clock' | 'timer' | 'tasks' | 'notes' | 'audio';
  visible: boolean;
  layouts: Record<string, { x: number; y: number; w: number; h: number }>;
  settings: Record<string, unknown>; // validate using widget-specific schemas
};

type Task = {
  id: string;
  text: string;
  completed: boolean;
  order: number;
  createdAt: string;
};

type TimerPhase = {
  id: string;
  kind: 'work' | 'short_break' | 'long_break' | 'custom';
  label: string;
  durationSeconds: number;
};

type TimerProfile = {
  id: string;
  name: string;
  phases: TimerPhase[];
  repeatCount: number | null; // null = unlimited
  autoAdvance: boolean;
};

type FocusSession = {
  id: string;
  profileSnapshot: TimerProfile;
  phaseIndex: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
  remainingAtPauseSeconds?: number;
  targetEndAt?: string;
  taskId?: string | null;
  updatedAt: string;
};
```

Les données `UserData` (tâches, notes, pensées) doivent être totalement distinctes des `WorkspacePreset` (thèmes et layouts). Le `profileSnapshot` empêche qu'une édition de profil ne modifie silencieusement une session déjà commencée.

### 4.4 Organisation de dépôt (monorepo léger)

```text
komolu/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── workspace/
│       │   │   ├── widgets/
│       │   │   ├── timer/
│       │   │   ├── tasks/
│       │   │   ├── notes/
│       │   │   ├── audio/
│       │   │   ├── backgrounds/
│       │   │   └── import-export/
│       │   ├── storage/
│       │   └── theme/
│       └── public/
├── packages/
│   └── shared/              # schemas/config if useful; keep optional initially
├── deploy/
│   ├── Dockerfile
│   ├── compose.yaml
│   └── nginx.conf
├── docs/
│   ├── product.md
│   ├── architecture.md
│   ├── self-hosting.md
│   ├── presets.md
│   ├── contributing.md
│   └── adr/
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── SECURITY.md
```

Le monorepo peut commencer sans `packages/` et sans API ; on l'étend seulement quand une duplication réelle apparaît. Éviter le sur-engineering.

### 4.5 Déploiements à supporter

**Mode A — Instance publique** : mêmes fichiers statiques, déployés sur un hébergement de site statique. Sans compte ni backend, les données restent dans le navigateur.

**Mode B — Auto-hébergement V1** : image Docker contenant le build statique servi par Nginx/Caddy ; démarrage documenté par `docker compose up -d`. Aucun PostgreSQL, Redis ou volume de données utilisateur requis. Un éventuel volume ne concerne que la configuration admin/médias fournis par l'hébergeur.

**Mode C — Marque blanche (V1.5)** : fichier de configuration validé, lu au chargement, paramétrant nom, logo, favicon, palette, presets initiaux, fonds et fonctionnalités activées. Éviter l'obligation de recompiler pour changer le nom ou logo. Préciser que le branding d'instance est indépendant des personnalisations locales de l'utilisateur.

**Mode D — Collaboration V2** : le frontend statique reste utilisable seul ; un service temps réel supplémentaire s'active via configuration d'instance. N'imposez pas la V2 aux petits auto-hébergeurs.

**Nota** : Docker n'est pas nécessaire pour *utiliser* la V1. Il sert à *héberger* l'application chez soi. La V1 doit aussi rester accessible via URL simple.

### 4.6 Identité d'instance et mode marque blanche

**Par défaut**, l'application est présentée sous le nom **Komolu**. Un hébergeur pourra éventuellement personnaliser sa propre instance sans forker le code et sans reconstruire le frontend (objectif V1.5 ; configuration minimale envisageable plus tôt).

Proposition de contrat d'exemple, **non implémenté** :

```json
{
  "appName": "Komolu",
  "tagline": "Your little place to focus.",
  "logoUrl": "/branding/komolu-logo.svg",
  "faviconUrl": "/branding/favicon.svg",
  "defaultSpaceId": "minimal",
  "features": {
    "collaboration": false
  }
}
```

- Charger ce fichier au démarrage, le valider et appliquer des valeurs de secours si une clé manque.
- Éviter que le branding d'instance écrase les préférences personnelles de style d'un utilisateur.
- Le nom de l'application et son identité de référence restent **Komolu** dans la documentation du projet source, même si une instance s'affiche sous une autre marque.
- La configuration marque blanche ne doit jamais servir à masquer les obligations de licence, attributions ou mentions légales applicables.
- Ne pas promettre cette personnalisation sans recompilation comme livrée en V1 tant que son implémentation n'est pas décidée.

---

## 5. Direction UX / UI

### 5.1 Trois couches

1. **Canvas** : fond, ambiance, espace visuel.
2. **Widgets** : éléments utiles flottants, indépendants, peu nombreux par défaut.
3. **Controls** : barre de contrôle discrète, Studio, réglages et outils d'import/export.

### 5.2 Deux modes

- **Studio** : on construit son espace. Poignées de widgets visibles, grille d'alignement légère, panneau de réglages.
- **Focus** : on travaille. Les éléments d'édition s'effacent ; seules les actions utiles subsistent.

### 5.3 Écran d'accueil idéal

- L'application s'ouvre directement sur le dernier espace utilisé ; première visite sur « Minimal ».
- Une petite barre accessible discrètement pour Studio, changer de preset, play/pause timer, audio, plein écran.
- Le widget principal se situe au centre ou dans la zone préférée de l'utilisateur.
- Pas de page marketing entre l'utilisateur et son espace.

### 5.4 Direction artistique

L'univers **Komolu** doit évoquer un petit cocon de concentration : coins arrondis, chaleur visuelle, typographie accueillante, espaces respirants. Le mot « cosy » décrit l'impression générale, pas une obligation de forcer tous les utilisateurs à choisir un décor chaleureux.

Préférer une identité **calme, éditoriale et soignée** à un dashboard SaaS standard. Couches translucides mesurées, typographie lisible, ombres douces, animations non intrusives. Proposer autant de styles sobres que de styles cozy. Toujours préserver la lisibilité sur fonds animés via overlays contrôlables.

### 5.5 Responsive et accessibilité

- Desktop-first (usage primaire) ; fonctionnement mobile raisonnable avec disposition simplifiée, sans promesse de Studio complet sur petit écran au premier jour.
- Contrastes vérifiés, tailles accessibles, libellés explicites, focus clavier, ARIA adapté.
- `prefers-reduced-motion` respecté ; timer ne dépend jamais de l'animation visuelle.
- Tester écran 1366×768, 1920×1080, tablette et téléphone ; navigations avec zoom 200 %.

---

## 6. V1.5 — Portabilité et écosystème

- Export/import de **presets anonymisés** avec aperçu avant adoption.
- Format JSON documenté et versionné ; schéma public ; migrations.
- Génération d'un lien de partage possible si un service facultatif de publication est ajouté ; **ne pas** supposer que tous les médias locaux sont publiables.
- Documentation pour intégrer ses propres fonds/sons avec attribution claire.
- White-label : branding, paramètres de l'instance, presets par défaut ; aucune suppression forcée de mentions légales ou d'obligations de licence.
- PWA installable et cache offline fiable, sans mettre en cache indéfiniment tous les médias lourds.
- Extension à des widgets communautaires **seulement** après avoir fixé un modèle de sécurité ; ne pas exécuter arbitrairement du JavaScript tiers en V1.5.

---

## 7. V2 — Coworking facultatif

### 7.1 Objectif

**Travailler ensemble sans déranger.** La collaboration doit favoriser la présence et la motivation, pas reproduire Discord au milieu de l'écran.

### 7.2 Salles et identité

- Room privée par lien d'invitation à expiration configurable et identifiant non prédictible.
- Room publique : phase ultérieure de V2, après résolution de la modération/anti-abus.
- Invité sans compte : pseudonyme et identité de session éphémère.
- Hôte avec privilèges limités : démarrer/arrêter timer commun, expulser, rendre privé, contrôler les paramètres partagés.
- Séparer les réglages **personnels** (fonds/sons/notes) de l'état **commun** (participants, timer de la salle, chat et tâches explicitement partagées).
- Définir TTL et suppression automatique des rooms inactives, ainsi que la politique de conservation des messages.

### 7.3 Modules V2 dans l'ordre

1. **Presence** : pseudonyme, avatar minimal, statut Focus / Pause / Disponible, nombre de personnes.
2. **Shared timer** : serveur autoritaire pour l'heure de début et de fin ; clients affichent le décompte sans dériver.
3. **Chat** : compact, notifications coupées en Focus, messages limités, spam contrôlé.
4. **Shared tasks** : liste **séparée** des tâches privées ; rejoindre la liste via action explicite.
5. **Voice** : rejoindre explicitement, mute par défaut optionnel, indicateur micro toujours visible, aucun enregistrement par défaut.
6. **Public discovery** : annuaire/rooms publiques seulement si modération et sécurité sont prêtes.

### 7.4 Architecture de collaboration

- Service serveur optionnel en TypeScript, WebSocket (ex. Fastify/WS ou NestJS gateway selon préférence d'équipe).
- Le serveur est autoritaire pour les états de salle et le timer partagé.
- Pour une petite liste de tâches partagée : opérations atomiques versionnées sur serveur suffisent au début. Introduire Yjs/CRDT si besoin démontré d'édition concurrente/offline ou de fusion fine, plutôt que d'emblée.
- Pour le vocal : WebRTC avec signalisation ; STUN et TURN (par exemple coturn) nécessaires pour fiabilité à travers les réseaux/NAT. Le vocal n'est **pas** sans infrastructure dans tous les environnements.
- Déploiement de référence `docker compose` avec frontend + API temps réel, TURN si vocal activé. Base SQLite envisageable pour installation simple ; base externe seulement si la charge la justifie.
- TLS et WSS requis en production, gestion CORS/origins, limites de taille/rate limiting, tokens d'invitation sécurisés, prévention XSS chat, suppression de salles, minimisation des logs.

### 7.5 Anti-distractions V2

- Quand la salle est en mode Focus, afficher seulement une présence discrète.
- Couper sonneries et badges de chat par défaut pendant le travail.
- Vocal optionnel ; contrôles clairs de mise en sourdine.
- Un participant peut garder ses propres sons et fond, même si le timer est collectif.

---

## 8. Risques et réponses

| Risque | Conséquence | Réponse |
| --- | --- | --- |
| Studio trop ambitieux | Devient un constructeur de dashboard interminable | Seulement 5 widgets natifs V1 ; grilles et propriétés bornées |
| Trop de thèmes, pas assez d'usage | Le produit devient une galerie plutôt qu'un outil | Tester le parcours « ouvrir → tâche → focus » dès V0.1 |
| Décompte incorrect en arrière-plan | Sessions faussées | Échéances horodatées et tests sleep/tab/reload |
| Audio autoplay bloqué | Sons silencieux au chargement | Bouton explicite « Activer les sons » et gestion AudioContext |
| Médias très lourds | Chargement lent, batterie | Posters, limites, codecs, reduced motion et fallback |
| Données IndexedDB perdues | Perte de tâches/notes | Exports lisibles, incitation discrète aux sauvegardes, `storage.persist()` quand pris en charge |
| Partage de thème divulgue des notes | Fuite de données | Schémas d'export distincts, anonymisation et tests |
| Ressources sous droits restrictifs | Projet non redistribuable | Registre des médias/licences + assets originaux ou libres |
| Rooms publiques détournées | Spam/abus | Ne pas ouvrir avant reporting, modération et rate limits |
| Vocal ne fonctionne pas sur certains réseaux | Frustration | TURN documenté, tests ICE, fallback texte |
| Effet « SaaS dashboard » | Identité peu marquante | Mode Focus d'abord, Studio en second |
| Widgets tiers malveillants | XSS/fuites | Pas d'extensions arbitraires exécutables dans les premières versions |

---

## 9. Roadmap concrète en 8 jalons (sans dates artificielles)

### J0 — Fondation produit et dépôt

- [x] Retenir **Komolu** comme nom de projet et de produit ; conserver son positionnement « espace cosy pour se concentrer ».
- [ ] Vérifier et réserver les identifiants/domaine appropriés et contrôler les éventuels conflits de marque avant communication officielle.
- [ ] Valider une signature courte et un premier logo/logomark sans bloquer le développement.
- [ ] Figer non-objectifs et liste V1.
- [ ] Créer README court, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md` et backlog public.
- [ ] Initialiser Vite + React + TS strict + Tailwind, CI lint/typecheck/test/build.
- [ ] Définir la palette et les règles d'interface de **Komolu**, puis les 3 presets intégrés.

**Sortie :** le dépôt `komolu` (ou une variante disponible) est clonable, la commande `pnpm dev` fonctionne et une preview affiche clairement le nom Komolu.

### J1 — Vertical slice « je peux travailler »

- [ ] Canvas avec fond intégré + fallback.
- [ ] Horloge simple.
- [ ] Timer 25/5 fiable avec phases et pause/reprise.
- [ ] Ajout/coche d'une tâche.
- [ ] Une piste audio + commandes.
- [ ] Persistance locale de base.

**Sortie :** vraie session de 25 minutes réalisable sans bug majeur.

### J2 — Studio et registre des widgets

- [ ] Contrat de widget et registre.
- [ ] Activer Studio/Focus.
- [ ] Drag, resize, ajout, masquage, réglages.
- [ ] Sauver/restaurer les layouts.
- [ ] Gestion responsive minimale et navigation clavier.

**Sortie :** le dernier layout est retrouvé identiquement après rechargement.

### J3 — Profondeur de personnalisation

- [ ] Fonds images et vidéos importables.
- [ ] Cadrage, voile, luminosité, effets bornés.
- [ ] Horloge paramétrable ; thèmes de widgets.
- [ ] Plusieurs espaces ; création, duplication et suppression.
- [ ] Paramètres audio et timer par preset.

**Sortie :** deux espaces vraiment différents, alternables en un clic, sans perte de données utilisateur.

### J4 — Outils Focus complets

- [ ] Moteur de séquences Pomodoro personnalisées.
- [ ] Association d'une tâche active.
- [ ] Bloc-notes persistant.
- [ ] Capture rapide des idées et raccourcis.
- [ ] Sons multiples avec volumes indépendants et transitions.
- [ ] Notifications/son de fin activables.

**Sortie :** on peut travailler plusieurs jours sans ouvrir d'autre outil de concentration.

### J5 — Portabilité et robustesse

- [ ] Import/export avec validation, migrations et aperçu.
- [ ] Séparer export « données perso » et export « preset partageable ».
- [ ] Gérer fichiers absents, quotas de stockage, erreurs audio/vidéo.
- [ ] Tester reload, onglets multiples, mise en veille, timezone et rafraîchissement.
- [ ] Tester accessibilité et reduced motion.
- [ ] Playwright sur les principaux parcours.

**Sortie :** importer un export sur une installation vierge reproduit l'expérience prévue.

### J6 — Distribution open source

- [ ] Build statique reproductible.
- [ ] `Dockerfile` multi-stage et `compose.yaml` de référence.
- [ ] Configuration runtime avec valeurs par défaut de **Komolu** (nom/logo/favicon) et possibilité de les surcharger pour une instance.
- [ ] Docs installation, développement, fonctionnement local et limitations.
- [ ] Releases versionnées et changelog.
- [ ] Audit licences médias, dépendances, attributions, sécurité.

**Sortie :** un tiers peut déployer seul via `docker compose up -d` à partir de la procédure officielle.

### J7 — Bêta et V1.0

- [ ] Faire tester par 5 à 10 personnes différentes avec des environnements variés.
- [ ] Observer le temps jusqu'à la première session et les bugs bloquants.
- [ ] Corriger en priorité lisibilité, pertes de données, timers et audio.
- [ ] Rédiger page de présentation de **Komolu** + captures + courte vidéo démo.
- [ ] Tagger `v1.0.0` et publier le site public.

**Sortie :** stabilité et usage réel, pas seulement une belle démo.

---

## 10. Backlog priorisé

### P0 — Indispensable pour V1

- Session de focus fiable ; séquences personnalisables.
- Presets et layouts persistants ; Studio/Focus.
- Horloge, tâches, notes, capture rapide.
- Fond média + son multi-pistes.
- Import/export sûr ; pas de fuite des données privées via thèmes.
- Application utilisable sans compte et sans backend.
- Docker, README, licence, documentation self-host.

### P1 — Très utile, mais reportable si retard

- Réglages fins de styles et overlays supplémentaires.
- Raccourcis personnalisables (quelques raccourcis fixes suffisent au début).
- PWA/offline avancé.
- Thèmes communautaires importables en un clic.
- Personnalisation de branding sans recompilation.

### P2 — Après V1

- Statistiques de sessions, historiques et graphiques.
- Import depuis outils de tâches tiers.
- Synchronisation multi-appareils.
- Marketplace ou exécution de widgets tiers.
- Rooms et tout système temps réel.

### Hors périmètre

- Dossiers/projets, WYSIWYG et documents.
- Calendrier complet, kanban et organisation d'équipe.
- Assistant IA ou abonnement.
- Réseau social, feeds, gamification poussée.
- Visioconférence imposée.

---

## 11. Tests et définition de « terminé »

### Automatisés

- Tests unitaires : transitions de timer, durée des phases, pauses, calculs d'échéance, suppression de tâches et migrations.
- Tests de données : export/import aller-retour, validation JSON/ZIP, absence de tâches et notes dans un preset partageable.
- Tests de composants : visibilité de widgets, réglages horloge, sauvegarde notes.
- E2E : première ouverture → ajout tâche → focus → pause → reload → reprise ; Studio → déplacement → reload ; export → reset → import.
- CI : `lint`, `typecheck`, `test`, `build`, puis E2E sur branches protégées.

### Manuels

- Chrome/Chromium, Firefox, Safari récents ; desktop Linux/Windows/macOS quand possible.
- Test basse puissance, réseau coupé après chargement, onglet caché, veille prolongée, multimédia bloqué.
- Zoom et clavier, préférence reduced-motion, volume initial nul.
- Installation Docker depuis une machine vierge / environnement éphémère.

### Critères d'acceptation V1

1. Sans inscription, l'utilisateur arrive sur un espace utilisable et peut lancer une session de concentration.
2. L'utilisateur peut personnaliser fond, widgets, horloge, Pomodoro et mix sonore, puis retrouver exactement ces réglages après rechargement.
3. La minuterie ne dérive pas significativement en arrière-plan et récupère un état cohérent après mise en veille/rechargement.
4. Changer de preset n'efface ni notes ni tâches.
5. L'utilisateur peut exporter/importer toutes ses données et partager un preset sans données privées.
6. La V1 est utilisable sur une instance publique ou Docker, sans API propriétaire ni base de données serveur.
7. Les licences du code et des ressources distribuées sont explicitement documentées.
8. Les problèmes majeurs de lisibilité, accessibilité et performance sont traités.

---

## 12. Open source et contribution

### Licence

- **MIT** : option simple et permissive favorisant réutilisation, intégrations et marque blanche ; autorise également la création de versions fermées.
- **AGPL-3.0** : option forte si l'objectif est que les modifications distribuées via service réseau restent disponibles sous les obligations de cette licence ; les implications pour contributions et compatibilité de dépendances doivent être comprises avant adoption.
- **Recommandation initiale :** choisir en conscience et fixer avant les contributions externes ; ne pas juxtaposer arbitrairement plusieurs licences. Pour un projet « réutilisable hyper simplement », MIT est un candidat naturel, sauf si la réciprocité est une priorité supérieure.

### Médias

Séparer la licence du code de celle des sons/images/vidéos. Conserver un `ASSETS_LICENSES.md` précisant l'auteur, la source, la licence, les obligations et les modifications de chaque média. Ne jamais présumer qu'un wallpaper trouvé en ligne est redistribuable. Préférer médias produits pour le projet ou CC0/équivalent lorsque vérifié.

### Expérience de contribution

- Projet **Komolu** public dès la première alpha ; issues étiquetées `good first issue`, `bug`, `feature`, `design`, `documentation`.
- Templates pour demande de widget, rapport de bug et proposition de thème.
- `CONTRIBUTING.md` avec setup en une commande, convention de modules, tests et bonnes pratiques.
- Roadmap publique sans promesse de délai ; exemples de thèmes et captures avant/après.
- Process simple pour accepter des médias avec licence contrôlée.

### Indicateurs utiles (sans instrumentation intrusive)

- Retours qualitatifs : « as-tu réussi à faire une session sans friction ? » ; fréquence de réutilisation auto-déclarée.
- Issues de pertes de données, bugs de timer et bugs audio = priorité absolue.
- Installations auto-hébergées partagées volontairement, PR et contributions externes, stabilité de build.
- On peut faire de la bêta sans mesurer les utilisateurs individuellement.

---

## 12.1 Présentation de Komolu pour le README

Proposition d'introduction courte à copier/adapter au début du `README.md` :

```markdown
# Komolu

Your little place to focus.

Komolu is a free, open-source, self-hostable focus space.
Customize your environment with backgrounds, widgets, ambient sounds,
timers, tasks, and quick notes — with no account required.

- 🎨 Make your space your own
- ⏱️ Focus with flexible timers
- 🌧️ Mix cozy ambient sounds
- 📝 Keep just the essentials
- 🏠 Self-host or use a public instance

> Collaborative focus rooms are planned for a future version.
```

Le README final devra préciser la licence effectivement choisie, les instructions de développement, le déploiement Docker, la gestion locale des données et les attributions des médias. Ne pas présenter des fonctionnalités V2 comme déjà livrées.

---

## 13. Premières issues GitHub à créer

1. `docs: define vision, non-goals and release criteria`
2. `chore: bootstrap React/TypeScript/Vite app and CI`
3. `feat: implement canvas and background fallback`
4. `feat: create persisted focus timer state machine`
5. `feat: implement basic task list`
6. `feat: implement audio engine with one sound`
7. `feat: introduce versioned IndexedDB storage`
8. `feat: add Studio and Focus modes`
9. `feat: create widget registry and layout persistence`
10. `feat: support workspace presets`
11. `feat: add notes and quick capture`
12. `feat: build multi-track sound mixer`
13. `feat: export/import private data and sanitized presets`
14. `test: cover timer background and reload scenarios`
15. `chore: add Docker image and self-hosting docs`
16. `docs: audit asset licenses and publish attribution`

**Proposition de premier sprint :** livrer les issues 2, 3, 4, 5 et 6 dans cet ordre, avec une interface déjà esthétique, mais sans construire le Studio. Tester une vraie session. Cela prévient le risque de passer des semaines à personnaliser un outil de focus qui ne permet pas encore de travailler.

---

## 14. Décisions à consigner dans des ADR

- ADR-001 — V1 local-first et sans backend obligatoire.
- ADR-002 — Mode Studio distinct du mode Focus.
- ADR-003 — Séparation presets vs données personnelles.
- ADR-004 — Timer horodaté plutôt que dépendant de `setInterval`.
- ADR-005 — Licence code et registre licences médias.
- ADR-006 — Frontend statique et Docker simple.
- ADR-007 — Services collaboratifs optionnels en V2.
- ADR-008 — Politique des imports/exports et validation de contenu.
- ADR-009 — Convention de nommage Komolu, branding d'instance et règles de marque blanche.

---

## 15. Ce qu'il faut *vraiment* faire en premier

**Étape 1 :** créer 2 ou 3 directions visuelles de la même interface (Minimal / Cozy / Deep Work) pour valider la promesse esthétique ; ne pas réaliser un design system exhaustif.

**Étape 2 :** implémenter une tranche verticale : fond, timer, tâche et un bruit d'ambiance ; utiliser cette version pour une séance réelle de travail. Ajuster les interactions avant de multiplier les widgets.

**Étape 3 :** formaliser le modèle de preset et la séparation des données privées ; seulement ensuite introduire Studio, import/export et personnalisation profonde.

**Étape 4 :** solidifier la V1 et documenter le déploiement. Une application simple, fiable et libre vaut mieux qu'un constructeur spectaculaire mais fragile.

---

## 16. Sources techniques consultées

- React Grid Layout : https://github.com/react-grid-layout/react-grid-layout
- MDN — Autoplay & Web Audio : https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- MDN — Page Visibility API : https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN — Storage quotas / persistence : https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Vite — Static deployment : https://vite.dev/guide/static-deploy
- Yjs — Overview : https://docs.yjs.dev/
- Yjs — Awareness : https://docs.yjs.dev/api/about-awareness
- WebRTC — TURN server : https://webrtc.org/getting-started/turn-server

**À noter** : ce document est un plan, pas un résultat de benchmark de performance, ni une preuve de compatibilité exhaustive des bibliothèques dans l'environnement cible. Vérifier les versions et leurs licences lors de l'implémentation.
