# Sécurité

La version 1.x est la branche actuellement maintenue. Il n'existe pas d'engagement de délai de correction ni d'audit de sécurité externe réalisé.

Pour signaler une vulnérabilité, utilise l'option **Report a vulnerability** de l'onglet Security du [dépôt](https://github.com/raphplt/Komolu/security) lorsqu'elle est disponible. Si ce canal privé n'est pas activé, ouvre une issue demandant un moyen de contact privé, sans publier de données sensibles ni de méthode d'exploitation détaillée. Aucune adresse de contact non vérifiée n'est fournie ici.

Indique la version, le navigateur, les conditions nécessaires et une reproduction minimale. Utilise uniquement des données fictives. Les sauvegardes personnelles contiennent les notes, tâches et médias en clair : ne les joins pas à une issue publique.

Les imports passent par un schéma strict, des plafonds et les décodeurs du navigateur avant une écriture atomique. Les formats SVG/HTML et URLs distantes ne sont pas admis. Cela ne remplace pas les protections du navigateur et ne garantit pas l'innocuité de tous les codecs. Garde ton navigateur à jour.

Les opérateurs doivent conserver HTTPS, surveiller les mises à jour npm et des images Docker et reconstruire la distribution. Le site ne gère ni comptes, ni API privée, ni secrets côté serveur. Les détails de confidentialité et des sauvegardes figurent dans le README et `docs/portability.md`.
