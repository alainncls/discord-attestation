import { memo } from 'react';
import type { SignedGuild } from '../types';
import { CheckIcon } from './icons';
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
    <li className="guild-item">
      <span className="guild-name">{guild.name}</span>
      {guild.attestationId ? (
        <div className="guild-actions">
          <span className="guild-status">
            <CheckIcon size={16} aria-hidden="true" />
            Attested
          </span>
          <button
            type="button"
            className="btn btn-secondary guild-button"
            onClick={() => onCheck(guild)}
            aria-label={`View ${guild.name} attestation`}
          >
            View
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary guild-button"
          onClick={() => onAttest(guild)}
          disabled={isDisabled}
          aria-busy={isPending}
          aria-label={isPending ? `Attesting ${guild.name}` : `Attest ${guild.name}`}
        >
          {isPending ? 'Attesting…' : 'Attest'}
        </button>
      )}
    </li>
  );
};

export default memo(GuildItem);
