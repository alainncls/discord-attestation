import { useSwitchChain } from 'wagmi';
import { linea, lineaSepolia } from 'wagmi/chains';
import './NetworkWarning.css';

interface NetworkWarningProps {
  chainId?: number;
}

export function NetworkWarning({ chainId }: NetworkWarningProps) {
  const { switchChain, isPending } = useSwitchChain();

  const isValidNetwork = chainId === linea.id || chainId === lineaSepolia.id;

  if (!chainId || isValidNetwork) {
    return null;
  }

  return (
    <div className="network-warning" role="alert">
      <div className="network-warning-content">
        <span className="network-warning-icon">⚠️</span>
        <div className="network-warning-text">
          <strong>Wrong Network</strong>
          <p>Please switch to Linea Mainnet or Linea Sepolia to use this app.</p>
        </div>
        <div className="network-warning-actions">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => switchChain({ chainId: linea.id })}
            disabled={isPending}
          >
            {isPending ? 'Switching...' : 'Switch to Linea'}
          </button>
          <button
            type="button"
            className="btn btn-small btn-empty"
            onClick={() => switchChain({ chainId: lineaSepolia.id })}
            disabled={isPending}
          >
            Linea Sepolia
          </button>
        </div>
      </div>
    </div>
  );
}
