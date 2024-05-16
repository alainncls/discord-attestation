import {Guild} from "../types";
import './GuildList.css'
import LogoVerax from "../assets/logo-verax.svg";
import {useAccount} from "wagmi";

interface GuildListProps {
    guilds: Guild[];
    onAttest: (guildId: string) => void;
}

const GuildList = ({guilds, onAttest}: GuildListProps) => {
    const {isConnected} = useAccount();

    return (
        <div className={'guild-list-container'}>
            <h1>You are part of {guilds.length} Discord Servers:</h1>
            <ul>
                {guilds.map((guild: { id: string, name: string }) => (
                    <div key={`${guild.id}`} className="guild-item">
                        <li >{guild.name}</li>
                        <button  className={`btn btn-small ${isConnected ? '' : 'btn-disabled'}`}
                                onClick={() => onAttest(guild.id)}>
                            <img  src={LogoVerax} alt={'Logo Verax'} height={16}/> Attest
                        </button>
                    </div>
                ))}
            </ul>
        </div>
    );
};

export default GuildList;
