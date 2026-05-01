import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { useAccount } from 'wagmi';
import Header from './components/Header';
import Footer from './components/Footer';
import MainContent from './components/MainContent';
import { NetworkWarning } from './components/NetworkWarning';
import { ToastContainer } from './components/Toast';
import { SkipLink } from './components/SkipLink';
import { useVeraxSdk } from './hooks/useVeraxSdk';
import { useFetchGuilds } from './hooks/useFetchGuilds';
import { useAttestationManager } from './hooks/useAttestationManager';
import { useToast } from './hooks/useToast';
import type { Hex } from 'viem';
import type { SignedGuild } from './types';
import { getLocalStorageValue, STORAGE_KEYS } from './utils/storage';

function App() {
  const { address, chainId } = useAccount();
  const { veraxSdk } = useVeraxSdk(chainId, address);
  const { toasts, removeToast, showError } = useToast();

  // Get OAuth code from URL (only once on mount)
  const [oauthCode] = useState(() => {
    return new URLSearchParams(window.location.search).get('code');
  });

  const { isLoggedIn, isLoading, guilds, setIsLoading, setGuilds } = useFetchGuilds(
    veraxSdk,
    address,
    oauthCode,
    chainId,
  );

  const { txHash, attestationId, pendingGuildId, handleAttest, handleCheck } =
    useAttestationManager(veraxSdk, chainId, showError);

  useEffect(() => {
    if (getLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED) === 'true') {
      setIsLoading(true);
    }
  }, [setIsLoading]);

  const handleAttestAndUpdateGuilds = useCallback(
    async (guild: SignedGuild) => {
      await handleAttest(guild, (guildId: string, attestId: Hex) => {
        setGuilds((currentGuilds) =>
          currentGuilds.map((currentGuild) =>
            currentGuild.id === guildId
              ? { ...currentGuild, attestationId: attestId }
              : currentGuild,
          ),
        );
      });
    },
    [handleAttest, setGuilds],
  );

  return (
    <div className="app-container">
      <SkipLink />
      <Header />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <main id="main-content" className="main-wrapper">
        <NetworkWarning chainId={chainId} />
        <MainContent
          isLoggedIn={isLoggedIn}
          isLoading={isLoading}
          guilds={guilds}
          txHash={txHash}
          attestationId={attestationId}
          pendingGuildId={pendingGuildId}
          chainId={chainId}
          onAttest={handleAttestAndUpdateGuilds}
          onCheck={handleCheck}
        />
      </main>
      <Footer />
    </div>
  );
}

export default App;
