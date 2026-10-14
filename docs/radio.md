# Radio

Quatre stations en ligne, indépendantes des ambiances. Le bouton Radio reste disponible dans le dock et en mode Focus. Chaque station démarre seulement après un clic sur **Écouter**. Changer de station arrête le flux ; fermer le panneau laisse la lecture en cours, avec un témoin dans le dock et un arrêt toujours accessible en rouvrant Radio.

## Sources et portée

Catalogue vérifié le 14 octobre 2026. Les flux sont lus directement chez leur diffuseur ; Komolu ne copie, ne réhéberge, ne revend et ne permet de télécharger aucun morceau. Les stations conservent leurs droits et leur programmation. Le catalogue ne constitue pas une licence de réutilisation musicale dans une vidéo ou une diffusion publique.

| Station                     | Style                  | Source officielle de l’adresse                                                                                                               |
| --------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Chillhop, FluxFM            | Lofi / hip-hop         | [FluxFM : flux pour lecteurs externes](https://www.fluxfm.de/flux-musik-streams)                                                             |
| Radio Swiss Classic         | Classique / orchestral | [Radio Swiss Classic : réception Internet](https://www.radioswissclassic.ch/de/empfang/internet)                                             |
| neoFM, FluxFM               | Néoclassique / piano   | [FluxFM : flux pour lecteurs externes](https://www.fluxfm.de/flux-musik-streams), [présentation neoFM](https://www.fluxfm.de/channels/neofm) |
| Electronic Chillout, FluxFM | Chill / ambient        | [FluxFM : flux pour lecteurs externes](https://www.fluxfm.de/flux-musik-streams)                                                             |

FluxFM publie explicitement ses adresses `externalembedflxhp` pour lecteurs externes. Radio Swiss Classic publie le lien MP3 HTTPS pour écoute depuis d’autres lecteurs. La variante officielle retenue comporte des annonces en allemand. Les liens vers les sites des stations figurent dans le lecteur. Aucun logo de station ou texte promotionnel n’est reproduit. SomaFM a été écarté : ses conditions interdisent explicitement les intégrations tierces. Les résultats Directory n’ont pas fourni de service approprié ; les sources officielles ont été consultées directement.

## Réseau et stockage

Il n’y a aucune requête radio au chargement, à l’ouverture du panneau ou au simple choix d’une station. Après Écouter, le diffuseur et ses relais reçoivent l’adresse IP et les informations HTTP habituelles. Les stations peuvent diffuser de la publicité ; la disponibilité dépend du réseau et du diffuseur. Aucun script publicitaire, iframe, API de métadonnées ou suivi de morceaux n’est ajouté à Komolu.

Les redirections observées passent par `channels.fluxfm.de`, `streams.fluxfm.de`, `fluxfm.streamabc.net`, `stream-router.radiosphere.io`, les sous-domaines de `streams.radiosphere.io`, `stream.srg-ssr.ch` et les nœuds de `srg-ssr.ch`. La CSP Nginx les autorise uniquement comme médias ; ni `connect-src` ni `script-src` ne sont élargis.

Seuls l’identifiant de station et le volume sont mémorisés dans `localStorage` (`komolu-radio-v1`). Ces préférences facultatives ne sont pas exportées dans les sauvegardes. La remise à zéro ou le remplacement des données arrête la lecture et remet les préférences radio à leurs valeurs initiales. Aucune donnée privée n’est envoyée aux stations.

## Validation

- Contrôleur : nettoyage de source à l’arrêt, refus des événements tardifs, interruption au changement de station, volume borné, restauration sans lecture, erreur/retry, mise en tampon bornée même lors d’événements répétés.
- Scénarios navigateur déterministes : aucun réseau avant lecture, choix + volume conservés après rechargement sans autoplay, commandes en Focus, fermeture du panneau, erreur/réessai/annulation.
- Vérification réseau réelle : les quatre flux ont atteint l’état `playing` sur Chromium et Firefox, puis ont été arrêtés. Une vérification supplémentaire sur Docker/Nginx a confirmé les quatre stations dans Chromium, sans violation de CSP ni erreur JavaScript et sans requête radio avant lecture. Toutes ces vérifications utilisent une sortie audio muette. Elles prouvent le décodage et le démarrage technique ; aucune qualité d’écoute subjective n’est revendiquée.

Les flux restent externes et peuvent changer d’adresse ou devenir indisponibles. Le message d’erreur permet un réessai manuel ou le choix d’une autre station, sans reconnexion automatique ni lecteur caché tiers.
