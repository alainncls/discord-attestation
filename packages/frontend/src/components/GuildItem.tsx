import { memo } from 'react';
import type { SignedGuild } from '../types';
import LogoVerax from '../assets/logo-verax.svg';
import './GuildItem.css';

interface GuildItemProps {
  guild: SignedGuild;
  isPending?: boolean;
  isWalletConnected: boolean;
  onAttest: (guild: SignedGuild) => void;
  onCheck: (guild: SignedGuild) => void;
}

const GuildItem = ({ guild, isPending, isWalletConnected, onAttest, onCheck }: GuildItemProps) => {
  const isDisabled = !isWalletConnected || Boolean(isPending);

  return (
    <div className="guild-item">
      <div className="guild-name">{guild.name}</div>
      {guild.attestationId ? (
        <button
          type="button"
          className="btn btn-small btn-empty verax-button"
          onClick={() => onCheck(guild)}
          aria-label={`Check attestation for ${guild.name} on Verax`}
        >
          <img src={LogoVerax} alt="" height={16} className="attested" aria-hidden="true" />
          <span>Check on Verax</span>
        </button>
      ) : (
        <button
          type="button"
          className={`btn btn-small verax-button ${isDisabled ? 'btn-disabled' : ''}`}
          onClick={() => onAttest(guild)}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-busy={isPending}
          aria-label={isPending ? `Attesting ${guild.name}...` : `Attest ${guild.name} on Verax`}
        >
          {isPending ? (
            <span>Attesting...</span>
          ) : (
            <>
              <img src={LogoVerax} alt="" height={16} aria-hidden="true" />
              <span>Attest on Verax</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default memo(GuildItem);
