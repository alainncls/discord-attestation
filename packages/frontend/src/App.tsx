import { useEffect } from 'react';
import './App.css';
import { useAccount } from 'wagmi';
import Header from './components/Header';
import Footer from './components/Footer';
import MainContent from './components/MainContent';
import { useVeraxSdk } from './hooks/useVeraxSdk';
import { useFetchGuilds } from './hooks/useFetchGuilds';
import { useAttestationManager } from './hooks/useAttestationManager';

function App() {
  const { address, chainId } = useAccount();
  const { veraxSdk } = useVeraxSdk(chainId, address);
  const { isLoggedIn, isLoading, guilds, setIsLoading } = useFetchGuilds(
    veraxSdk,
    address,
    new URLSearchParams(window.location.search).get('code'),
    chainId
  );
  
  const { txHash, attestationId, handleAttest, handleCheck } = useAttestationManager(
    veraxSdk,
    chainId
  );

  useEffect(() => {
    if (localStorage.getItem('discord_oauth_started') === 'true') {
      setIsLoading(true);
    }
  }, [setIsLoading]);

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
        onAttest={handleAttest}
        onCheck={handleCheck}
      />
      <Footer />
    </div>
  );
}

export default App;
