import {useEffect, useState} from 'react';
import axios from 'axios';

const GuildList = () => {
    const [guilds, setGuilds] = useState([]);

    useEffect(() => {
        const fetchGuilds = async () => {
            try {
                const response = await axios.get('/.netlify/functions/api');
                setGuilds(response.data);
            } catch (error) {
                console.error('Error fetching guilds:', error);
            }
        };

        fetchGuilds();
    }, []);

    return (
        <div>
            <h1>Your Discord Servers</h1>
            <ul>
                {guilds.map((guild: { id: string, name: string }) => (
                    <li key={guild.id}>{guild.name}</li>
                ))}
            </ul>
        </div>
    );
};

export default GuildList;
