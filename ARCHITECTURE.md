# Organisation du simulateur

L’application fonctionne directement depuis `index.html`, y compris avec une URL `file://`. Les scripts sont chargés dans cet ordre :

1. `data.js` fournit les données initiales et les catalogues fictifs.
2. `icons.js` fournit `window.M365Icon`, utilisé pour produire les pictogrammes SVG communs.
3. `app.js` gère l’état en mémoire, le stockage local, la navigation, le rendu et les actions des centres Microsoft 365, Entra et Exchange.

`styles.css` contient les styles de ces centres. La console SharePoint locale se trouve dans `contoso-sharepoint/` et possède ses propres scripts et styles. Les deux interfaces utilisent le stockage local du navigateur ; leurs données sont simulées.

## Livraison et vérification

`scripts/build.cjs` indique explicitement les fichiers à copier dans `dist/`. Tout nouveau script chargé par `index.html` doit y être ajouté ainsi que dans les harnais de test concernés. `scripts/dev-server.cjs` utilise cette même liste pour servir les fichiers.

- `node tests/smoke.js` exerce les parcours principaux dans un environnement DOM simulé.
- `node tests/roles-group.js` et `node tests/entra-groups-regression.js` vérifient notamment les rôles et groupes.
- `node tests/entra-agents.test.cjs` et `node tests/cross-sync.test.cjs` couvrent des parcours ciblés.
- `npm run test:delivery` vérifie la préparation et la distribution statiques ; la commande écrit dans `dist/`.

Ces tests ne remplacent pas une comparaison visuelle dans un navigateur. Le suivi de la fidélité et des écarts connus figure dans `INVENTAIRE_PORTAILS.md`.

## Évolution de la structure

`app.js` reste volumineux et mélange encore plusieurs responsabilités. Les prochaines extractions doivent suivre des limites fonctionnelles identifiables : composants communs, navigation et stockage, puis chaque centre et ses parcours. Pour chaque extraction, conserver l’ordre de chargement, le fonctionnement en `file://`, les données enregistrées et les routes existantes ; adapter les harnais et la liste de livraison, puis vérifier les parcours concernés. Les blocs qui dépendent de l’état partagé ou sont modifiés simultanément demandent une coordination avant déplacement.
