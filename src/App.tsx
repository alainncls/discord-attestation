import React, {useEffect, useState} from 'react';
import GuildList from "./components/GuildList.tsx";
import LoginWithDiscord from "./components/LoginWithDiscord.tsx";
import Header from "./components/Header.tsx";
import Footer from "./components/Footer.tsx";
import ConnectButton from "./components/ConnectButton.tsx";
import './App.css';
import LogoVerax from "./assets/logo-verax.svg";
import {VeraxSdk} from "@verax-attestation-registry/verax-sdk";
import {Hex} from "viem";
import {useAccount} from "wagmi";
import {waitForTransactionReceipt} from "viem/actions";
import {wagmiConfig} from "./wagmiConfig.ts";

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [guilds, setGuilds] = useState([]);
    const [veraxSdk, setVeraxSdk] = useState<VeraxSdk>();
    const [txHash, setTxHash] = useState<Hex>();
    const [attestationId, setAttestationId] = useState<Hex>();

    const {address, chainId} = useAccount();

    const schemaId = "0x59ffe1d5bdbd99d418fc1dba03b136176ca52da322cab38fed6f29c2ca29bd71"
    const portalId = "0x2fafe2c217be096e09b64c49825fe46b7c3e33b2"

    useEffect(() => {
        if (chainId && address) {
            const sdkConf =
                chainId === 59144 ? VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND : VeraxSdk.DEFAULT_LINEA_SEPOLIA_FRONTEND;
            const sdk = new VeraxSdk(sdkConf, address);
            setVeraxSdk(sdk);
        }
    }, [chainId, address]);

    useEffect(() => {
        // Check if the OAuth flow has completed
        const oauthStarted = localStorage.getItem('discord_oauth_started');
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (oauthStarted && code) {
            // Clear the flag in localStorage
            localStorage.removeItem('discord_oauth_started');

            // Call the Netlify function to exchange the code for a token and fetch the guilds
            fetch('https://discord-attestation.netlify.app/.netlify/functions/api?code=' + code)
                .then(response => response.json())
                .then(data => {
                    console.log('data', data)
                    if (data.error) {
                        console.error('Error fetching guilds:', data.error);
                    } else {
                        setIsLoggedIn(true);
                        setGuilds(data);
                    }
                })
                .catch(error => console.error('Error:', error));
        }
    }, []);

    const issueAttestation = async () => {
        if (address && veraxSdk) {
            try {
                let receipt = await veraxSdk.portal.attest(
                    portalId,
                    {
                        schemaId,
                        expirationDate: Math.floor(Date.now() / 1000) + 2592000,
                        subject: address,
                        attestationData: [{
                            commitHash: 'test',
                            repoUrl: 'test',
                        }],
                    },
                    [],
                );
                if (receipt.transactionHash) {
                    setTxHash(receipt.transactionHash)
                    receipt = await waitForTransactionReceipt(wagmiConfig.getClient(), {
                        hash: receipt.transactionHash,
                    });
                    setAttestationId(receipt.logs?.[0].topics[1])
                } else {
                    alert(`Oops, something went wrong!`);
                }
            } catch (e) {
                console.log(e);
                if (e instanceof Error) {
                    alert(`Oops, something went wrong: ${e.message}`);
                }
            }
        }
    };

    const handleAttest = async () => {
        setTxHash(undefined);
        setAttestationId(undefined);
        await issueAttestation();
    };

    const truncateHexString = (hexString: string) => {
        return `${hexString.slice(0, 7)}...${hexString.slice(hexString.length - 5, hexString.length)}`
    }

    return (
        <>
            <Header/>
            <div className="main-container">
                <ConnectButton/>
                {isLoggedIn ? (
                    <>
                        <button className="btn" onClick={handleAttest}>
                            <img src={LogoVerax} alt={'Logo Verax'} height={24}/> Attest
                        </button>
                        {txHash && <div className={'message'}>Transaction Hash: <a
                          href={`${chainId === 59144 ? 'https://lineascan.build/tx/' : 'https://sepolia.lineascan.build/tx/'}${txHash}`}
                          target="_blank" rel="noopener noreferrer">{truncateHexString(txHash)}</a></div>}
                        {txHash && !attestationId && <div className={'message pending'}>Transaction pending...</div>}
                        {attestationId && <div className={'message success'}>Attestation ID: <a
                          href={`${chainId === 59144 ? 'https://explorer.ver.ax/linea/attestations/' : 'https://explorer.ver.ax/linea-sepolia/attestations/'}${attestationId}`}
                          target="_blank" rel="noopener noreferrer">{truncateHexString(attestationId)}</a></div>}
                        <GuildList guilds={guilds}/>
                    </>
                ) : (
                    <LoginWithDiscord/>
                )}
            </div>
            <Footer/>
        </>
    );
};

export default App;
