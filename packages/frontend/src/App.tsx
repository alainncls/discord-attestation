import { useEffect, useMemo } from 'react';
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

function App() {
  const { address, chainId } = useAccount();
  const { veraxSdk } = useVeraxSdk(chainId, address);
  const { toasts, removeToast, showError } = useToast();

  // Get OAuth code from URL (only once on mount)
  const oauthCode = useMemo(() => {
    return new URLSearchParams(window.location.search).get('code');
  }, []);

  const { isLoggedIn, isLoading, guilds, setIsLoading, setGuilds } = useFetchGuilds(
    veraxSdk,
    address,
    oauthCode,
    chainId,
  );

  const { txHash, attestationId, pendingGuildId, handleAttest, handleCheck } =
    useAttestationManager(veraxSdk, chainId, showError);

  useEffect(() => {
    if (localStorage.getItem('discord_oauth_started') === 'true') {
      setIsLoading(true);
    }
  }, [setIsLoading]);

  const handleAttestAndUpdateGuilds = async (guild: SignedGuild) => {
    await handleAttest(guild, (guildId: string, attestId: Hex) => {
      const updatedGuilds = guilds.map((g) =>
        g.id === guildId ? { ...g, attestationId: attestId } : g,
      );
      setGuilds(updatedGuilds);
    });
  };

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
