import React, {useEffect, useState} from 'react';
import GuildList from "./components/GuildList.tsx";
import LoginWithDiscord from "./components/LoginWithDiscord.tsx";
import Header from "./components/Header.tsx";
import Footer from "./components/Footer.tsx";

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

    useEffect(() => {
        // Check if the OAuth flow has completed
        const oauthStarted = localStorage.getItem('discord_oauth_started');
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (oauthStarted && code) {
            // Clear the flag in localStorage
            localStorage.removeItem('discord_oauth_started');

            // Call the Netlify function to exchange the code for a token and fetch the guilds
            fetch('/.netlify/functions/api?code=' + code)
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error('Error fetching guilds:', data.error);
                    } else {
                        setIsLoggedIn(true);
                        // Optionally, store the guilds data in state or localStorage
                    }
                })
                .catch(error => console.error('Error:', error));
        }
    }, []);

    return (
        <>
            <Header/>
            <h1>Discord Attestation</h1>
            {isLoggedIn ? (
                <GuildList/>
            ) : (
                <LoginWithDiscord/>
            )}
            <Footer/>
        </>
    );
};

export default App;
