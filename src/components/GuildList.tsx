import {Guild} from "../types";
import './GuildList.css'

interface GuildListProps {
    guilds: Guild[];
}

const GuildList = ({guilds}: GuildListProps) => {
    return (
        <div className={'guild-list-container'}>
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
