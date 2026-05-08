import type { SignedGuild } from '../types';
import './GuildList.css';
import GuildItem from './GuildItem';

interface GuildListProps {
  guilds: SignedGuild[];
  pendingGuildId?: string | null;
  isWalletConnected: boolean;
  onAttest: (guild: SignedGuild) => void;
  onCheck: (guild: SignedGuild) => void;
}

const GuildList = ({
  guilds,
  pendingGuildId,
  isWalletConnected,
  onAttest,
  onCheck,
}: GuildListProps) => {
  return (
    <div className="guild-list-container">
      <h2>You are part of {guilds.length} Discord Servers</h2>
      <div className="guild-list">
        {guilds.map((guild) => (
          <GuildItem
            key={guild.id}
            guild={guild}
            isPending={pendingGuildId === guild.id}
            isWalletConnected={isWalletConnected}
            onAttest={onAttest}
            onCheck={onCheck}
          />
        ))}
      </div>
    </div>
  );
};

export default GuildList;
