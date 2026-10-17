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
      <div className="network-warning-text">
        <strong>Wrong network</strong>
        <p>Switch to a Linea network.</p>
      </div>
      <div className="network-warning-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => switchChain({ chainId: linea.id })}
          disabled={isPending}
        >
          Linea
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => switchChain({ chainId: lineaSepolia.id })}
          disabled={isPending}
        >
          Linea Sepolia
        </button>
      </div>
    </div>
  );
}
