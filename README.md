# Plateforme locale Microsoft 365, Entra et Exchange

Consultez [ARCHITECTURE.md](ARCHITECTURE.md) pour l’organisation du code et les vérifications.

Simulation locale des centres d’administration Microsoft 365, Microsoft Entra, Exchange et SharePoint. Les données sont fictives et les modifications restent dans le navigateur. La reproduction est inachevée ; de nombreuses pages, actions et différences visuelles restent à vérifier.

Ouvrez `index.html` directement ou utilisez Node.js 18+ : `npm run dev`, puis ouvrez l’adresse locale affichée. `node tests/smoke.js` exécute les tests de simulation et `npm run test:delivery` vérifie la copie statique.

Cette copie publique anonymise les données et logos d’entreprise. Les outils SharePoint séparés, projets de design, journaux, dépendances, archives et exercices ne font pas partie de cette publication.
