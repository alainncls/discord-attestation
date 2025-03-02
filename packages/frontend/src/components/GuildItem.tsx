import { SignedGuild } from '../types';
import { useAccount } from 'wagmi';
import LogoVerax from '../assets/logo-verax.svg';
import './GuildItem.css';

interface GuildItemProps {
  guild: SignedGuild;
  onAttest: (guild: SignedGuild) => void;
  onCheck: (guild: SignedGuild) => void;
}

const GuildItem = ({ guild, onAttest, onCheck }: GuildItemProps) => {
  const { isConnected } = useAccount();

  return (
    <div className="guild-item">
      <div className="guild-name">{guild.name}</div>
      {guild.attestationId ? (
        <button className="btn btn-small btn-empty verax-button" onClick={() => onCheck(guild)}>
          <img src={LogoVerax} alt="Logo Verax" height={16} className="attested" /> Check on Verax
        </button>
      ) : (
        <button
          className={`btn btn-small verax-button ${isConnected ? '' : 'btn-disabled'}`}
          onClick={() => onAttest(guild)}
          disabled={!isConnected}
        >
          <img src={LogoVerax} alt="Logo Verax" height={16} /> Attest on Verax
        </button>
      )}
    </div>
  );
};

export default GuildItem; 