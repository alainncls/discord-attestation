import { Hex } from 'viem';
import './TransactionStatus.css';

interface TransactionStatusProps {
  txHash?: Hex;
  attestationId?: Hex;
  chainId?: number;
  truncateHexString: (hexString: string) => string;
}

const TransactionStatus = ({ txHash, attestationId, chainId, truncateHexString }: TransactionStatusProps) => {
  if (!txHash) return null;
  
  return (
    <>
      <div className="message">
        Transaction Hash:{' '}
        <a
          href={`${chainId === 59144 ? 'https://lineascan.build/tx/' : 'https://sepolia.lineascan.build/tx/'}${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {truncateHexString(txHash)}
        </a>
      </div>
      
      {!attestationId && <div className="message pending">Transaction pending...</div>}
      
      {attestationId && (
        <div className="message success">
          Attestation ID:{' '}
          <a
            href={`${chainId === 59144 ? 'https://explorer.ver.ax/linea/attestations/' : 'https://explorer.ver.ax/linea-sepolia/attestations/'}${attestationId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {truncateHexString(attestationId)}
          </a>
        </div>
      )}
    </>
  );
};

export default TransactionStatus; 