import { useEffect } from 'react';
import './App.css';
import { useAccount, useSwitchChain } from 'wagmi';
import Header from './components/Header';
import Footer from './components/Footer';
import MainContent from './components/MainContent';
import { useVeraxSdk } from './hooks/useVeraxSdk';
import { useFetchGuilds } from './hooks/useFetchGuilds';
import { useAttestationManager } from './hooks/useAttestationManager';
import { linea, lineaSepolia } from 'wagmi/chains';
import { Hex } from 'viem';
import { SignedGuild } from './types';

function App() {
  const { address, chainId } = useAccount();
  const { veraxSdk } = useVeraxSdk(chainId, address);
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (chainId !== lineaSepolia.id && chainId !== linea.id) {
      switchChain({ chainId: linea.id });
    }
  }, [chainId, switchChain]);

  const { isLoggedIn, isLoading, guilds, setIsLoading, setGuilds } = useFetchGuilds(
    veraxSdk,
    address,
    new URLSearchParams(window.location.search).get('code'),
    chainId,
  );

  const { txHash, attestationId, handleAttest, handleCheck } = useAttestationManager(
    veraxSdk,
    chainId,
  );

  useEffect(() => {
    if (localStorage.getItem('discord_oauth_started') === 'true') {
      setIsLoading(true);
    }
  }, [setIsLoading]);

  const handleAttestAndUpdateGuilds = async (guild: SignedGuild) => {
    await handleAttest(guild, (guildId: string, attestId: Hex) => {
      const updatedGuilds = guilds.map(currentGuild =>
        currentGuild.id === guildId ? { ...currentGuild, attestationId: attestId } : currentGuild,
      );
      setGuilds(updatedGuilds);
    });
  };

  return (
    <div className="app-container">
      <Header />
      <MainContent
        isLoggedIn={isLoggedIn}
        isLoading={isLoading}
        guilds={guilds}
        txHash={txHash}
        attestationId={attestationId}
        chainId={chainId}
        onAttest={handleAttestAndUpdateGuilds}
        onCheck={handleCheck}
      />
      <Footer />
    </div>
  );
}

export default App;
