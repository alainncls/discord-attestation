import {SignedGuild} from "../types";
import './GuildList.css'
import LogoVerax from "../assets/logo-verax.svg";
import {useAccount} from "wagmi";

interface GuildListProps {
    guilds: SignedGuild[];
    onAttest: (guild: SignedGuild) => void;
}

const GuildList = ({guilds, onAttest}: GuildListProps) => {
    const {isConnected} = useAccount();

    return (
        <div className={'guild-list-container'}>
            <h1>You are part of {guilds.length} Discord Servers:</h1>
            <ul>
                {guilds.map((guild: SignedGuild) => (
                    <div key={`${guild.id}`} className="guild-item">
                        <li>{guild.name}</li>
                        <button className={`btn btn-small ${isConnected ? '' : 'btn-disabled'}`}
                                onClick={() => onAttest(guild)}>
                            <img src={LogoVerax} alt={'Logo Verax'} height={16}/> Attest
                        </button>
                    </div>
                ))}
            </ul>
        </div>
    );
};

export default GuildList;
