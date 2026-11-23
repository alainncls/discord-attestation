import type { SignedGuild } from '../types';
import GuildList from './GuildList';
import { Intro } from './Intro';
import LoginWithDiscord from './LoginWithDiscord';
import Spinner from './Spinner';
import TransactionStatus from './TransactionStatus';
import type { Hex } from 'viem';
import type { Address } from 'viem';
import './MainContent.css';

interface MainContentProps {
  isLoggedIn: boolean;
  isLoading: boolean;
  guilds: SignedGuild[];
  txHash?: Hex | undefined;
  attestationId?: Hex | undefined;
  pendingGuildId?: string | null | undefined;
  chainId?: number | undefined;
  walletAddress?: Address | undefined;
  walletChainId?: number | undefined;
  isWalletConnected: boolean;
  onAttest: (guild: SignedGuild) => void;
  onCheck: (guild: SignedGuild) => void;
}

const MainContent = ({
  isLoggedIn,
  isLoading,
  guilds,
  txHash,
  attestationId,
  pendingGuildId,
  chainId,
  walletAddress,
  walletChainId,
  isWalletConnected,
  onAttest,
  onCheck,
}: MainContentProps) => {
  if (isLoading) {
    return (
      <div className="main-state">
        <Spinner />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <Intro />
        <LoginWithDiscord address={walletAddress} chainId={walletChainId} />
      </>
    );
  }

  if (guilds.length === 0) {
    return (
      <p className="main-state" role="status">
        No servers found.
      </p>
    );
  }

  return (
    <>
      <TransactionStatus txHash={txHash} attestationId={attestationId} chainId={chainId} />
      <GuildList
        guilds={guilds}
        pendingGuildId={pendingGuildId}
        isWalletConnected={isWalletConnected}
        onAttest={onAttest}
        onCheck={onCheck}
      />
    </>
  );
};

export default MainContent;
