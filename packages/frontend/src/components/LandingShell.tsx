import Header from './Header';
import Footer from './Footer';
import LoginWithDiscord from './LoginWithDiscord';
import { SkipLink } from './SkipLink';
import './LandingShell.css';

interface LandingShellProps {
  isRuntimeLoading: boolean;
  onConnectWallet: () => void;
}

export const LandingShell = ({ isRuntimeLoading, onConnectWallet }: LandingShellProps) => {
  return (
    <div className="app-container">
      <SkipLink />
      <Header />
      <main id="main-content" className="main-wrapper">
        <div className="main-content">
          <section className="landing-summary" aria-labelledby="landing-summary-title">
            <h2 id="landing-summary-title">Verify Discord server membership on Linea</h2>
            <p>
              Create Verax attestations for Discord server memberships and keep a reusable on-chain
              proof tied to your wallet.
            </p>
          </section>
          <div className="connect-button-container">
            <button
              type="button"
              className="btn"
              onClick={onConnectWallet}
              disabled={isRuntimeLoading}
              aria-busy={isRuntimeLoading}
            >
              {isRuntimeLoading ? 'Loading wallet...' : 'Connect Wallet'}
            </button>
          </div>
          <div className="centered-content">
            <LoginWithDiscord />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};
