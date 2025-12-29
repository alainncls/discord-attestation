import type { Hex } from 'viem';
import { linea } from 'wagmi/chains';
import './TransactionStatus.css';

interface TransactionStatusProps {
  txHash?: Hex;
  attestationId?: Hex;
  chainId?: number;
  truncateHexString: (hexString: string) => string;
}

const TransactionStatus = ({
  txHash,
  attestationId,
  chainId,
  truncateHexString,
}: TransactionStatusProps) => {
  if (!txHash) return null;

  const explorerBaseUrl =
    chainId === linea.id ? 'https://lineascan.build/tx/' : 'https://sepolia.lineascan.build/tx/';

  const veraxBaseUrl =
    chainId === linea.id
      ? 'https://explorer.ver.ax/linea/attestations/'
      : 'https://explorer.ver.ax/linea-sepolia/attestations/';

  return (
    <div className="transaction-status" role="status" aria-live="polite">
      <div className="message">
        Transaction Hash:{' '}
        <a href={`${explorerBaseUrl}${txHash}`} target="_blank" rel="noopener noreferrer">
          {truncateHexString(txHash)}
        </a>
      </div>

      {!attestationId && (
        <div className="message pending" aria-busy="true">
          Transaction pending...
        </div>
      )}

      {attestationId && (
        <div className="message success">
          Attestation ID:{' '}
          <a href={`${veraxBaseUrl}${attestationId}`} target="_blank" rel="noopener noreferrer">
            {truncateHexString(attestationId)}
          </a>
        </div>
      )}
    </div>
  );
};

export default TransactionStatus;
