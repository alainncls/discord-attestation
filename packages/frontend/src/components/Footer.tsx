import './Footer.css';
import LogoVerax from '../assets/logo-verax.svg';
import { GithubIcon, XIcon } from './icons';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="copyright">
          By{' '}
          <a href="https://alainnicolas.fr/en/" target="_blank" rel="noopener noreferrer">
            Alain Nicolas
          </a>
        </p>
        <nav className="footer-links" aria-label="External links">
          <a
            href="https://www.ver.ax"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="Verax"
          >
            <img src={LogoVerax} alt="" height={20} width={20} />
          </a>
          <a
            href="https://github.com/alainncls/discord-attestation"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="GitHub"
          >
            <GithubIcon size={20} aria-hidden="true" />
          </a>
          <a
            href="https://x.com/Alain_Ncls"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="X"
          >
            <XIcon size={20} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
