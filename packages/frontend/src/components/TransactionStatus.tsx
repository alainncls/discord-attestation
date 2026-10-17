import type { Hex } from 'viem';
import { linea } from 'wagmi/chains';
import { truncateHexString } from '../utils/helpers';
import './TransactionStatus.css';

interface TransactionStatusProps {
  txHash?: Hex;
  attestationId?: Hex;
  chainId?: number;
}

const TransactionStatus = ({ txHash, attestationId, chainId }: TransactionStatusProps) => {
  if (!txHash) return null;

  const explorerBaseUrl =
    chainId === linea.id ? 'https://lineascan.build/tx/' : 'https://sepolia.lineascan.build/tx/';

  const veraxBaseUrl =
    chainId === linea.id
      ? 'https://explorer.ver.ax/linea/attestations/'
      : 'https://explorer.ver.ax/linea-sepolia/attestations/';

  return (
    <dl className="transaction-status" role="status" aria-live="polite">
      <div>
        <dt>Transaction</dt>
        <dd>
          <a href={`${explorerBaseUrl}${txHash}`} target="_blank" rel="noopener noreferrer">
            {truncateHexString(txHash)}
          </a>
        </dd>
      </div>
      <div>
        <dt>Attestation</dt>
        <dd aria-busy={!attestationId}>
          {attestationId ? (
            <a href={`${veraxBaseUrl}${attestationId}`} target="_blank" rel="noopener noreferrer">
              {truncateHexString(attestationId)}
            </a>
          ) : (
            <span className="transaction-pending">Confirming…</span>
          )}
        </dd>
      </div>
    </dl>
  );
};

export default TransactionStatus;
