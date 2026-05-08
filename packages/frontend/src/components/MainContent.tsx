import type { SignedGuild } from '../types';
import GuildList from './GuildList';
import LoginWithDiscord from './LoginWithDiscord';
import Spinner from './Spinner';
import TransactionStatus from './TransactionStatus';
import ConnectButton from './ConnectButton';
import type { Hex } from 'viem';
import './MainContent.css';

interface MainContentProps {
  isLoggedIn: boolean;
  isLoading: boolean;
  guilds: SignedGuild[];
  txHash?: Hex;
  attestationId?: Hex;
  pendingGuildId?: string | null;
  chainId?: number;
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
  isWalletConnected,
  onAttest,
  onCheck,
}: MainContentProps) => {
  return (
    <div className="main-content">
      <ConnectButton />

      {isLoading && (
        <div className="centered-content">
          <Spinner />
        </div>
      )}

      {!isLoggedIn && !isLoading && (
        <div className="centered-content">
          <LoginWithDiscord />
        </div>
      )}

      {isLoggedIn && guilds.length > 0 && (
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
      )}

      {isLoggedIn && guilds.length === 0 && !isLoading && (
        <div className="centered-content" role="status">
          No Discord servers are available for attestation.
        </div>
      )}
    </div>
  );
};

export default MainContent;
