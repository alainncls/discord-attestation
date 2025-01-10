import React, { useCallback, useEffect, useState } from 'react';
import GuildList from './components/GuildList';
import LoginWithDiscord from './components/LoginWithDiscord';
import Header from './components/Header';
import Footer from './components/Footer';
import ConnectButton from './components/ConnectButton';
import './App.css';
import { Abi, Hex } from 'viem';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'viem/actions';
import { wagmiConfig } from './wagmiConfig';
import { add } from 'date-fns';
import Spinner from './components/Spinner';
import { SignedGuild } from './types';
import { useVeraxSdk } from './hooks/useVeraxSdk';
import { useFetchGuilds } from './hooks/useFetchGuilds';
import { PORTAL_ID, SCHEMA_ID } from './utils/constants';
import { abi as discordPortalAbi } from '../../contracts/artifacts/src/DiscordPortal.sol/DiscordPortal.json';

const App: React.FC = () => {
  const { address, chainId, isConnected } = useAccount();
  const { veraxSdk } = useVeraxSdk(chainId, address);
  const { isLoggedIn, isLoading, guilds, setIsLoading } = useFetchGuilds(
    veraxSdk,
    address,
    new URLSearchParams(window.location.search).get('code')
  );
  const [txHash, setTxHash] = useState<Hex>();
  const [attestationId, setAttestationId] = useState<Hex>();

  useEffect(() => {
    if (localStorage.getItem('discord_oauth_started') === 'true') {
      setIsLoading(true);
    }
  }, [setIsLoading]);

  const issueAttestation = useCallback(
    async (signedGuild: SignedGuild) => {
      if (address && veraxSdk) {
        try {
          let receipt = await veraxSdk.portal.attestV2(
            PORTAL_ID,
            {
              schemaId: SCHEMA_ID,
              expirationDate: Math.floor(add(new Date(), { months: 1 }).getTime() / 1000),
              subject: address,
              attestationData: [{ guildId: signedGuild.id }],
            },
            [signedGuild.signature],
            false,
            100000000000000n,
            discordPortalAbi as Abi
          );
          if (receipt.transactionHash) {
            setTxHash(receipt.transactionHash);
            receipt = await waitForTransactionReceipt(wagmiConfig.getClient(), {
              hash: receipt.transactionHash,
            });
            setAttestationId(receipt.logs?.[0].topics[1]);
          } else {
            alert(`Oops, something went wrong!`);
          }
        } catch (e) {
          if (e instanceof Error) alert(`Oops, something went wrong: ${e.message}`);
        }
      }
    },
    [address, veraxSdk]
  );

  const handleAttest = useCallback(
    async (signedGuild: SignedGuild) => {
      if (isConnected) {
        setTxHash(undefined);
        setAttestationId(undefined);
        await issueAttestation(signedGuild);
      }
    },
    [isConnected, issueAttestation]
  );

  const handleCheck = useCallback(
    (signedGuild: SignedGuild) => {
      if (signedGuild.attestationId) {
        window.open(
          `https://explorer.ver.ax/linea${chainId === 59144 ? '' : '-sepolia'}/attestations/${signedGuild.attestationId}`,
          '_blank'
        );
      }
    },
    [chainId]
  );

  const truncateHexString = (hexString: string) =>
    `${hexString.slice(0, 7)}...${hexString.slice(hexString.length - 5)}`;

  return (
    <>
      <Header />
      <div className="main-container">
        <ConnectButton />
        {isLoading && <Spinner />}
        {!isLoggedIn && !isLoading && <LoginWithDiscord />}
        {isLoggedIn && guilds.length > 0 && (
          <>
            {txHash && (
              <div className={'message'}>
                Transaction Hash:{' '}
                <a
                  href={`${chainId === 59144 ? 'https://lineascan.build/tx/' : 'https://sepolia.lineascan.build/tx/'}${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {truncateHexString(txHash)}
                </a>
              </div>
            )}
            {txHash && !attestationId && (
              <div className={'message pending'}>Transaction pending...</div>
            )}
            {attestationId && (
              <div className={'message success'}>
                Attestation ID:{' '}
                <a
                  href={`${chainId === 59144 ? 'https://explorer.ver.ax/linea/attestations/' : 'https://explorer.ver.ax/linea-sepolia/attestations/'}${attestationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {truncateHexString(attestationId)}
                </a>
              </div>
            )}
            <GuildList guilds={guilds} onAttest={handleAttest} onCheck={handleCheck} />
          </>
        )}
      </div>
      <Footer />
    </>
  );
};

export default App;
