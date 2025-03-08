import { SignedGuild } from '../types';
import './GuildList.css';
import GuildItem from './GuildItem';

interface GuildListProps {
  guilds: SignedGuild[];
  pendingGuildId?: string | null;
  onAttest: (guild: SignedGuild) => void;
  onCheck: (guild: SignedGuild) => void;
}

const GuildList = ({ guilds, pendingGuildId, onAttest, onCheck }: GuildListProps) => {
  return (
    <div className="guild-list-container">
      <h1>You are part of {guilds.length} Discord Servers</h1>
      <div className="guild-list">
        {guilds.map((guild) => (
          <GuildItem
            key={guild.id}
            guild={guild}
            isPending={pendingGuildId === guild.id}
            onAttest={onAttest}
            onCheck={onCheck}
          />
        ))}
      </div>
    </div>
  );
};

export default GuildList;
