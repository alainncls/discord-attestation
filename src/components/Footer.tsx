import './Footer.css';
import {FaGithub} from 'react-icons/fa';
import LogoVerax from "../assets/logo-verax.svg";

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <p className={'copyright'}>Made with <span>❤️</span> by {' '}
                    <a className={'underline white'} href="https://alainnicolas.fr/en/" target="_blank"
                       rel="noopener noreferrer">Alain Nicolas</a>
                </p>
                <div>
                    <a href="https://www.ver.ax" target="_blank" rel="noopener noreferrer"
                       className="link"><img src={LogoVerax} alt={'Logo Verax'} height={24}/></a>
                    <a href="https://github.com/alainncls/discord-attestation" target="_blank" rel="noopener noreferrer"
                       className="link white"><FaGithub size={24}/></a>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
