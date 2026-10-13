# Architecture de Komolu

## Décisions

- Frontend statique React et TypeScript strict, construit par Vite, sans compte ni backend. CSS natif et SVG/CSS locaux : aucun CDN ni police distante. Le build utilise une base relative pour fonctionner sur un sous-chemin.
- IndexedDB via Dexie. La table `state` contient un document versionné `AppState` ; la table `media` contient les `Blob` locaux. Les espaces ne contiennent que leur configuration : tâches, notes et pensées sont exclusivement sous `privateData`.
- Les mutations passent par `mutateState` : transaction IndexedDB `rw`, lecture du document le plus récent, modification synchrone, écriture atomique. Les transactions de plusieurs onglets sont sérialisées par IndexedDB. `useLiveQuery` reflète leurs changements. Ne jamais attendre décodage média, fetch ou autre travail externe dans une transaction.
- Timer global unique, avec instantané immuable du profil au lancement. Changer d’espace pendant une session conserve cette session ; changer les réglages d’un profil ne modifie pas la session active.
- Une phase possède une échéance absolue. Les intervalles rafraîchissent seulement l’affichage et vérifient les transitions ; ils ne décrémentent pas un compteur ni ne persistent chaque seconde. Fin sans passage automatique : la phase suivante attend une action explicite. Fin avec passage automatique : reprise à partir des échéances passées, en respectant les répétitions. Une boucle infinie saute arithmétiquement les cycles entiers après une longue veille.
- Recul de l’horloge > 2 secondes pendant la page ouverte : comparaison horloge murale/monotone et pause avec avertissement. Au rechargement, le dernier instant connu détecte uniquement certains reculs. Une avancée de l’heure est traitée comme du temps écoulé ; après fermeture il est impossible de distinguer une veille d’un changement manuel d’heure sans serveur. Aucun engagement de précision absolue face à une horloge système modifiée.
- Web Audio initialisé après clic utilisateur. Les sons intégrés sont synthétisés localement et ne sollicitent aucun réseau. Le volume utilise une rampe pour atténuer les clics. Le son ne redémarre pas automatiquement après rechargement.

## Contrats de modules

- `src/core/model.ts` : types de données persistées, `SCHEMA_VERSION = 1`.
- `src/core/presets.ts` : `createInitialState`, `createWorkspace`, `defaultWidgets`, `uid`.
- `src/core/timer.ts` : fonctions pures `createTimer`, `transitionTimer`, `reconcileTimer`, `timerValue`, `formatDuration`, `validateProfile` et `TIMER_PROFILES`.
- `src/core/storage.ts` : `db`, `KomoluDatabase`, `initializeDatabase`, `mutateState`.
- `src/core/store.ts` : `useAppState() -> {state, error, clearError}`, `useNow`, `activeWorkspace`, `actions`. Les actions retournent une promesse ; les erreurs de stockage sont également affichables par le hook.
- Une `Workspace` contient un tableau `widgets` avec instances versionnées et layout `{x,y,w,h}` en unités de grille, profil audio et minuterie, et fond pouvant référencer un média local.

## Références officielles

Références vérifiées pendant la découverte du 13 octobre 2026 :

- [Vite : guide](https://vite.dev/guide/) et [déploiement statique](https://vite.dev/guide/static-deploy).
- [React : TypeScript](https://react.dev/learn/typescript).
- [Dexie : React](https://dexie.org/docs/Tutorial/React) et [transactions](https://dexie.org/docs/Dexie/Dexie.transaction()).
- [MDN : AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) et [GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode).

Les versions exactes résolues et leur intégrité sont dans `package-lock.json`.
