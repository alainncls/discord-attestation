import React, { useEffect, useState } from 'react';
import GuildList from './components/GuildList.tsx';
import LoginWithDiscord from './components/LoginWithDiscord.tsx';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import ConnectButton from './components/ConnectButton.tsx';
import './App.css';
import { VeraxSdk } from '@verax-attestation-registry/verax-sdk';
import { Hex } from 'viem';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'viem/actions';
import { wagmiConfig } from './wagmiConfig.ts';
import { add } from 'date-fns';
import Spinner from './components/Spinner.tsx';
import { DecodedPayload, SignedGuild } from './types';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [guilds, setGuilds] = useState<SignedGuild[]>([]);
  const [signedSubject, setSignedSubject] = useState<Hex>();
  const [veraxSdk, setVeraxSdk] = useState<VeraxSdk>();
  const [txHash, setTxHash] = useState<Hex>();
  const [attestationId, setAttestationId] = useState<Hex>();

  const { address, chainId, isConnected } = useAccount();

  const schemaId =
    '0xa8d6aefe759739c13a4151523a525bfe88b7dae97bdd5de50dab89cb247690d4';
  const portalId = '0x4DA1fD9BF47c73Aa7002F155048a8ba7898C960C';

  useEffect(() => {
    if (chainId && address) {
      const sdkConf =
        chainId === 59144
          ? VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND
          : VeraxSdk.DEFAULT_LINEA_SEPOLIA_FRONTEND;
      const sdk = new VeraxSdk(sdkConf, address);
      setVeraxSdk(sdk);
    }
  }, [chainId, address]);

  useEffect(() => {
    if (localStorage.getItem('discord_oauth_started') === 'true') {
      setIsLoading(true);
    }
  }, []);


  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    const fetchAttestedGuilds = async (signedGuilds: SignedGuild[]): Promise<SignedGuild[]> => {

      if (!veraxSdk) {
        return signedGuilds;
      }

      const attestedGuilds = await veraxSdk.attestation.findBy(1000, 0, {
        schema: schemaId,
        portal: portalId.toLowerCase(),
        subject: address,
      });

      console.log('attestedGuilds', attestedGuilds);

      const updatedGuilds: SignedGuild[] = signedGuilds.map((guild) => {
        const attestedGuild = attestedGuilds.find((attestedGuild) => {
          console.log('(attestedGuild.decodedPayload as DecodedPayload[])[0].guildId', (attestedGuild.decodedPayload as DecodedPayload[])[0].guildId);
          return (attestedGuild.decodedPayload as DecodedPayload[])[0].guildId === guild.id;
        });
        console.log('attestedGuild', attestedGuild);

        return attestedGuild ? {
          ...guild,
          attestationId: attestedGuild.id,
        } : guild;
      });

      console.log('updatedGuilds', updatedGuilds);

      return updatedGuilds;
    };

    const fetchGuilds = async () => {
      // Clear the flag in localStorage
      localStorage.removeItem('discord_oauth_started');
      // Call the Netlify function to exchange the code for a token and fetch the guilds
      const res = await fetch(
        `https://discord.alainnicolas.fr/.netlify/functions/api?code=${code}&isDev=${import.meta.env.MODE === 'development'}&subject=${address}`,
      );

      const data = await res.json();

      if (data.error) {
        console.error('Error fetching guilds:', data.error);
      } else if (data.message) {
        console.error('Error fetching guilds:', data.message);
      } else {
        setIsLoggedIn(true);
        setGuilds(await fetchAttestedGuilds(data.signedGuilds));
        setSignedSubject(data.subjectSignature);
      }
      setIsLoading(false);
    };

    if (isLoading && code) {
      fetchGuilds();
    }
  }, [address, isLoading, veraxSdk]);

  const issueAttestation = async (signedGuild: SignedGuild) => {
    if (address && veraxSdk && signedSubject) {
      try {
        let receipt = await veraxSdk.portal.attest(
          portalId,
          {
            schemaId,
            expirationDate: Math.floor(
              add(new Date(), { months: 1 }).getTime() / 1000,
            ),
            subject: address,
            attestationData: [
              {
                guildId: signedGuild.id,
              },
            ],
          },
          [signedSubject, signedGuild.signature],
          false,
          100000000000000n,
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
        if (e instanceof Error) {
          alert(`Oops, something went wrong: ${e.message}`);
        }
      }
    }
  };

  const handleAttest = async (signedGuild: SignedGuild) => {
    if (isConnected) {
      setTxHash(undefined);
      setAttestationId(undefined);
      await issueAttestation(signedGuild);
    }
  };

  const handleCheck = async (signedGuild: SignedGuild) => {
    if (signedGuild.attestationId) {
      window.open(`https://explorer.ver.ax/linea${chainId === 59144 ? '' : '-sepolia'}/attestations/${signedGuild.attestationId}`, '_blank');
    }
  };

  const truncateHexString = (hexString: string) => {
    return `${hexString.slice(0, 7)}...${hexString.slice(hexString.length - 5, hexString.length)}`;
  };

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
