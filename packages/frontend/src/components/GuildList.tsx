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
    <section className="guilds" aria-labelledby="guilds-title">
      <div className="guilds-header">
        <h2 id="guilds-title">Your servers</h2>
        <span className="guilds-count">{guilds.length}</span>
      </div>
      <ul className="guild-list">
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
      </ul>
    </section>
  );
};

export default GuildList;
