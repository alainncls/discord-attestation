# Discord Attestation

[![Netlify Status](https://api.netlify.com/api/v1/badges/48ce283b-7559-462d-8208-a6870f72a9c4/deploy-status)](https://app.netlify.com/sites/discord-attestation/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node.js](https://img.shields.io/badge/node-22.21.1-green)
![pnpm](https://img.shields.io/badge/pnpm-10.26.2-orange)

An application that allows users to create on-chain attestations of their Discord server memberships using
the [Verax Attestation Registry](https://www.ver.ax/) on [Linea](https://linea.build).

## 🌐 Live Demo

Visit [discord.alainnicolas.fr](https://discord.alainnicolas.fr/) to try the application.

## ✨ Features

- Connect your wallet via WalletConnect/Reown
- Authenticate with Discord OAuth2
- Generate on-chain attestations of your server memberships
- Check attestations on the Verax Explorer
- Support for Linea Mainnet and Linea Sepolia

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   User                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                │                                    │
                │ 1. Connect Wallet                  │ 2. Discord OAuth2
                ▼                                    ▼
┌─────────────────────────────┐      ┌─────────────────────────────────────────┐
│       Frontend (React)       │      │           Discord API                   │
│  - Reown AppKit (Wallet)     │      │  - OAuth2 token exchange                │
│  - wagmi/viem                │      │  - Get user guilds                      │
└─────────────────────────────┘      └─────────────────────────────────────────┘
                │                                    │
                │ 3. Request guilds + signatures     │
                ▼                                    │
┌─────────────────────────────┐                      │
│   Netlify Functions (API)    │◄────────────────────┘
│  - Exchange OAuth code       │
│  - Fetch user guilds         │
│  - Sign guilds (EIP-712)     │
└─────────────────────────────┘
                │
                │ 4. Return signed guilds
                ▼
┌─────────────────────────────┐
│       Frontend (React)       │
│  - Display guilds            │
│  - Create attestation tx     │
└─────────────────────────────┘
                │
                │ 5. Submit attestation
                ▼
┌─────────────────────────────┐      ┌─────────────────────────────────────────┐
│   DiscordPortal (Solidity)   │─────▶│        Verax Attestation Registry       │
│  - Verify EIP-712 signature  │      │  - Store attestation on-chain           │
│  - Validate schema & fee     │      │  - Query via Verax Explorer             │
└─────────────────────────────┘      └─────────────────────────────────────────┘
```

## 📁 Project Structure

This is a pnpm monorepo with 3 packages:

```
packages/
├── contracts/     # Solidity smart contract (DiscordPortal)
│   ├── src/       # Contract source code
│   └── scripts/   # Deployment scripts
├── frontend/      # React application (Vite)
│   ├── src/       # React components, hooks, utils
│   └── public/    # Static assets
└── functions/     # Netlify Functions (serverless backend)
    ├── api.ts     # Main API endpoint
    └── lib/       # Shared types and constants
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22.21.1 (use `nvm use` with `.nvmrc`)
- [pnpm](https://pnpm.io/) v10.26.2
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) for local development
- A wallet (MetaMask recommended 🦊)
- A Discord account
- Accounts on:
    - [Reown Cloud](https://cloud.reown.com/) (for WalletConnect project ID)
    - [Infura](https://infura.io/) (for RPC endpoints)
    - [Discord Developer Portal](https://discord.com/developers/applications) (for OAuth2)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/alainncls/discord-attestation.git
cd discord-attestation
```

2. Use the correct Node.js version:

```bash
nvm use
```

3. Install dependencies:

```bash
pnpm install
```

4. Configure environment variables (see [Environment Variables](#-environment-variables))

5. Start the development server:

```bash
# Option 1: Frontend only (no backend)
pnpm dev

# Option 2: Full stack with Netlify CLI (recommended)
netlify dev
```

## 🔑 Environment Variables

Copy the `.env.example` files and fill in your values:

### Frontend (`packages/frontend/.env`)

| Variable                        | Description                    | Where to get it                         |
|---------------------------------|--------------------------------|-----------------------------------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect/Reown project ID | [Reown Cloud](https://cloud.reown.com/) |
| `VITE_INFURA_API_KEY`           | Infura API key for RPC         | [Infura Dashboard](https://infura.io/)  |

### Netlify Functions (`packages/functions/.env`)

| Variable                 | Description                    | Where to get it                                                         |
|--------------------------|--------------------------------|-------------------------------------------------------------------------|
| `VITE_DISCORD_CLIENT_ID` | Discord OAuth2 Client ID       | [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_SECRET`  | Discord OAuth2 Client Secret   | Same as above                                                           |
| `VITE_REDIRECT_URL`      | OAuth2 redirect URL            | Your app URL (e.g., `https://discord.alainnicolas.fr`)                  |
| `SIGNER_PRIVATE_KEY`     | Private key for signing guilds | Your wallet (must match `SIGNER_ADDRESS` in contract)                   |

### Contracts (`packages/contracts/.env`)

| Variable            | Description                | Where to get it                        |
|---------------------|----------------------------|----------------------------------------|
| `PRIVATE_KEY`       | Private key for deployment | Your deployer wallet                   |
| `INFURA_KEY`        | Infura API key             | [Infura Dashboard](https://infura.io/) |
| `ETHERSCAN_API_KEY` | Lineascan API key          | [Lineascan](https://lineascan.build/)  |
| `ROUTER_ADDRESS`    | Verax Router address       | See [Verax docs](https://docs.ver.ax/) |

## 🎮 Discord OAuth2 Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "OAuth2" → "General"
4. Copy the **Client ID** and **Client Secret**
5. Add redirect URIs:
    - Development: `http://localhost:5173`
    - Production: `https://your-domain.com`
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: `identify`, `guilds`

## 📜 Available Scripts

From the root of the monorepo:

| Script           | Description                     |
|------------------|---------------------------------|
| `pnpm dev`       | Start frontend dev server       |
| `pnpm build`     | Build all packages              |
| `pnpm lint`      | Run ESLint + Prettier + Solhint |
| `pnpm lint:fix`  | Auto-fix linting issues         |
| `pnpm test`      | Run tests (contracts)           |
| `pnpm typecheck` | TypeScript type checking        |

### Package-specific scripts

```bash
# Compile smart contracts
pnpm --filter @discord-attestation/contracts compile

# Run contract tests
pnpm --filter @discord-attestation/contracts test

# Deploy contracts (requires .env)
pnpm --filter @discord-attestation/contracts deploy linea-sepolia
pnpm --filter @discord-attestation/contracts deploy linea

# Run Netlify Functions locally
pnpm --filter @discord-attestation/functions dev
```

## 🔐 Security

### Smart Contract Security

- **EIP-712 Signatures**: Guild attestations are signed using typed structured data (EIP-712) to prevent forgery
- **Signer Verification**: The contract verifies signatures against a hardcoded `SIGNER_ADDRESS` (
  `0x6aDD17d22E8753869a3B9E83068Be1f16202046E`)
- **Attestation Fee**: A fee of `0.0001 ETH` is required per attestation (configurable by owner)
- **Owner-only Operations**: Revocation and replacement of attestations are restricted to the portal owner

### Backend Security

- The `SIGNER_PRIVATE_KEY` should **never** be committed to version control
- In production, use Netlify environment variables
- The signer's public address must match `SIGNER_ADDRESS` in the contract

## 🔗 Verax Deployments

### Linea Sepolia (Testnet)

[
`0xd0fb47ea3960d15425137b2ff83955c3beb6a85c`](https://explorer.ver.ax/linea-sepolia/portals/0xd0fb47ea3960d15425137b2ff83955c3beb6a85c)

### Linea Mainnet

[
`0x407e280281b812adef69a91230659c9d738d82cb`](https://explorer.ver.ax/linea/portals/0x407e280281b812adef69a91230659c9d738d82cb)

### Schema

[
`0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6`](https://explorer.ver.ax/linea/schemas/0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6)

## 🛠 Tech Stack

| Layer               | Technologies                           |
|---------------------|----------------------------------------|
| **Frontend**        | React 19, TypeScript, Vite             |
| **Wallet**          | Reown AppKit, wagmi v2, viem v2        |
| **Backend**         | Netlify Functions, Node.js             |
| **Smart Contracts** | Solidity 0.8.21, Hardhat, OpenZeppelin |
| **Authentication**  | Discord OAuth2                         |
| **Blockchain**      | Linea Network (Mainnet + Sepolia)      |
| **Attestation**     | Verax Attestation Registry             |

## 📦 Deploying Smart Contracts

1. Configure `packages/contracts/.env` with required variables

2. Get the Verax Router address for your target network:
    - Linea Sepolia: `0x736c78b2f2cBf4F921E8551b2acB6A5Edc9177D5`
    - Linea Mainnet: `0x4d3a380A03f3a18A5dC44b01119839D8674a552E`

3. Deploy and register the portal:

```bash
cd packages/contracts
pnpm deploy linea-sepolia  # or: pnpm deploy linea
```

The script will:

- Deploy the `DiscordPortal` contract
- Verify it on Lineascan
- Register it in the Verax Portal Registry

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
