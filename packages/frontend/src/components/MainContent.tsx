import { SignedGuild } from '../types';
import GuildList from './GuildList';
import LoginWithDiscord from './LoginWithDiscord';
import Spinner from './Spinner';
import TransactionStatus from './TransactionStatus';
import ConnectButton from './ConnectButton';
import { truncateHexString } from '../utils/helpers';
import { Hex } from 'viem';
import './MainContent.css';

interface MainContentProps {
  isLoggedIn: boolean;
  isLoading: boolean;
  guilds: SignedGuild[];
  txHash?: Hex;
  attestationId?: Hex;
  pendingGuildId?: string | null;
  chainId?: number;
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
                       onAttest,
                       onCheck,
                     }: MainContentProps) => {
  return (
    <div className="main-content">
      <ConnectButton />

      {isLoading && <Spinner />}

      {!isLoggedIn && !isLoading && (
        <div className="centered-content">
          <LoginWithDiscord />
        </div>
      )}

      {isLoggedIn && guilds.length > 0 && (
        <>
          <TransactionStatus
            txHash={txHash}
            attestationId={attestationId}
            chainId={chainId}
            truncateHexString={truncateHexString}
          />
          <GuildList 
            guilds={guilds} 
            pendingGuildId={pendingGuildId}
            onAttest={onAttest} 
            onCheck={onCheck} 
          />
        </>
      )}
    </div>
  );
};

export default MainContent;
