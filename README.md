# Discord Attestation

[![Netlify Status](https://api.netlify.com/api/v1/badges/48ce283b-7559-462d-8208-a6870f72a9c4/deploy-status)](https://app.netlify.com/sites/discord-attestation/deploys)

An application that allows users to create on-chain attestations of their Discord server memberships using
the [Verax Attestation Registry](https://www.ver.ax/) on [Linea](https://linea.build).

## 🌐 Live Demo

Visit [discord.alainnicolas.fr](https://discord.alainnicolas.fr/) to try the application.

## ✨ Features

- Connect your wallet
- Authenticate with Discord
- Generate on-chain attestations of your server memberships
- Check attestations on the Verax Explorer
- Leveraging the Linea network to host the attestations

## 🚀 Getting Started

### Prerequisites

- Node.js (v23.7.0 or higher)
- pnpm package manager (v9.14.0 or higher)
- A wallet (MetaMask recommended 🦊)
- A Discord account

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

## 🔗 Verax Deployments

### Linea Sepolia

[
`0xd0fb47ea3960d15425137b2ff83955c3beb6a85c`](https://explorer.ver.ax/linea-sepolia/portals/0xd0fb47ea3960d15425137b2ff83955c3beb6a85c)

### Linea Mainnet

[`0x`](https://explorer.ver.ax/linea/portals/0x)

### Schema

[
`0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6`](https://explorer.ver.ax/linea/schemas/0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6)

## 🛠 Tech Stack

- Frontend: React, TypeScript, Vite
- Smart Contracts: Solidity
- Authentication: Discord OAuth2
- Blockchain: Linea Network
- Attestation Protocol: Verax

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
