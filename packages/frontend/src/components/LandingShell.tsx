import Header from './Header';
import Footer from './Footer';
import { Intro } from './Intro';
import LoginWithDiscord from './LoginWithDiscord';
import { SkipLink } from './SkipLink';

interface LandingShellProps {
  isRuntimeLoading: boolean;
  onConnectWallet: () => void;
}

export const LandingShell = ({ isRuntimeLoading, onConnectWallet }: LandingShellProps) => {
  return (
    <div className="app-container">
      <SkipLink />
      <Header>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConnectWallet}
          disabled={isRuntimeLoading}
          aria-busy={isRuntimeLoading}
        >
          {isRuntimeLoading ? 'Loading…' : 'Connect wallet'}
        </button>
      </Header>
      <main id="main-content" className="main-wrapper">
        <Intro />
        <LoginWithDiscord />
      </main>
      <Footer />
    </div>
  );
};
