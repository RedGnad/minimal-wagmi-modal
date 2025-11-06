# Sherlock – Auth Web3 (Monad Testnet)

Application React Router avec intégration wagmi (v2) pour connexion wallet EVM + flux de signature (préparation SIWE) sur le réseau Monad Testnet.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Démarrage

### Installation

Installer les dépendances :

```bash
npm install
# If install fails with ENOSPC (disk full), free up space and retry
```

### Développement

Lancer le serveur de développement :

```bash
npm run dev
```

Accessible sur `http://localhost:5173`.

### Connexion Wallet (wagmi)

Route `/login` : modal de connexion multi-wallet (Injected, MetaMask, WalletConnect si ID configuré) + signature SIWE locale (message dynamique + nonce).

Installer les libs si manquantes :

```bash
npm install wagmi viem @tanstack/react-query
```

Puis ouvrir `/login` après lancement.

Pour un modal pré-construit plus riche : RainbowKit ou Web3Modal (nécessite WalletConnect projectId).

Variables d'environnement (voir `.env.example`) :

```
VITE_MONAD_RPC_URL=URL_RPC_MONAD_TESTNET
VITE_WALLETCONNECT_ID=OPTIONNEL_PROJECT_ID
VITE_SIWE_DOMAIN=localhost:5173
VITE_SIWE_EXP_MINUTES=5
```

Copier `.env.example` vers `.env` et ajuster.

Flux actuel (local) :
1. L'utilisateur ouvre `/login` et connecte un wallet.
2. Auto-switch (ou prompt) vers Monad Testnet si pas déjà dessus.
3. Génération d'un nonce + message SIWE côté client (pas encore vérifié serveur).
4. Signature personnelle demandée (non-dismissable tant que pas signée ou disconnect).
5. Vérification locale (recover) ; stockage signature dans `localStorage`.
6. À remplacer en production par une session serveur (cookie httpOnly) après vérification SIWE.

À faire côté backend pour production :
- Endpoint `POST /api/auth/nonce` : génère nonce unique + expiration.
- Endpoint `POST /api/auth/verify` : vérifie signature SIWE (adresse, domaine, chainId, nonce non réutilisé). Retourne session (cookie ou token).
- Invalidation du nonce après usage (anti-replay).
- Stockage serveur (en mémoire, Redis ou DB) des nonces : {nonce, address, expiresAt, used}.
- Validation stricte du domaine attendu (`VITE_SIWE_DOMAIN`), de la chaîne (10143), et du timestamp.

Sécurité recommandée :
- Utiliser cookie httpOnly + SameSite=Lax + Secure en prod HTTPS.
- Rate limit sur endpoints auth.
- Ne jamais faire confiance au `localStorage` pour l'auth réelle.
- Contrôler la longueur max du message signé.

Améliorations possibles :
- Gestion d'erreurs affichées (toast) lors du switch réseau ou signature rejetée.
- Ajout d'un endpoint `/api/auth/session` pour vérifier la session persistante.
- Test unitaire de vérification SIWE (adresse récupérée vs attendue).
- Log d'audit des tentatives de signature.

## Build Production

Create a production build:

```bash
npm run build
```

## Déploiement

### Docker

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### Déploiement personnalisé

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Construit avec ❤️ et React Router + wagmi.

## Résumé rapide

- Réseau forcé : Monad Testnet
- Modal signature non-dismissable (sécurité UX)
- Message SIWE dynamique mais validation encore locale
- Prochaine étape essentielle : endpoints backend (nonce + verify + session)
