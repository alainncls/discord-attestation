import './Footer.css';
import { FaGithub } from 'react-icons/fa';
import LogoVerax from '../assets/logo-verax.svg';
import { BsTwitterX } from 'react-icons/bs';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="copyright">
          Made with <span aria-label="love">❤️</span> by{' '}
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
            aria-label="Visit Verax website"
          >
            <img src={LogoVerax} alt="Verax logo" height={24} width={24} />
          </a>
          <a
            href="https://github.com/alainncls/discord-attestation"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="View source code on GitHub"
          >
            <FaGithub size={24} aria-hidden="true" />
          </a>
          <a
            href="https://x.com/Alain_Ncls"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="View my X profile"
          >
            <BsTwitterX size={24} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
