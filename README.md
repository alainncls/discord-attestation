# Discord Attestation

[![Netlify Status](https://api.netlify.com/api/v1/badges/48ce283b-7559-462d-8208-a6870f72a9c4/deploy-status)](https://app.netlify.com/sites/discord-attestation/deploys)

An application that allows users to create on-chain attestations of their Discord server memberships using
the [Verax Attestation Registry](https://www.ver.ax/) on [Linea](https://linea.build).

## 🌐 Live Demo

Visit [discord.alainnicolas.fr](https://discord.alainnicolas.fr/) to try the application.

## ✨ Features

- Connect your Web3 wallet
- Authenticate with Discord
- Generate on-chain attestations of your server memberships
- Verify attestations through Verax Protocol
- Full Linea network integration

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- A Web3 wallet (MetaMask recommended 🦊)
- Discord account

### Installation

1. Clone the repository:

```bash
git clone https://github.com/alainncls/discord-attestation.git
cd discord-attestation
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm run dev
```

## 🔗 Contract Deployments

### Linea Sepolia

- Portal: [
  `0x07601016572ee88c1c71fa64edfca767b02ec07b`](https://explorer.ver.ax/linea-sepolia/portals/0x07601016572ee88c1c71fa64edfca767b02ec07b)

### Linea Mainnet

- Portal: [
  `0x`](https://explorer.ver.ax/linea/portals/0x)

## 🛠 Tech Stack

- Frontend: React, TypeScript, Vite
- Smart Contracts: Solidity
- Authentication: Discord OAuth2
- Blockchain: Linea Network
- Attestation Protocol: Verax

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
